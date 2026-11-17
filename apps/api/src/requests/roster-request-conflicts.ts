import { PoolClient } from 'pg';
import { bangkokWorkDate, requestApprovalDeadline } from './request-time';

export const swapSlots = `(VALUES
 (ch.assignment_id,(ch.snapshot->'source'->>'version')::int),
 (ch.target_assignment_id,(ch.snapshot->'target'->>'version')::int),
 ((ch.snapshot->'secondSwap'->'source'->>'assignment_id')::int,(ch.snapshot->'secondSwap'->'source'->>'version')::int),
 ((ch.snapshot->'secondSwap'->'target'->>'assignment_id')::int,(ch.snapshot->'secondSwap'->'target'->>'version')::int)
) AS slots(assignment_id,version)`;

export const staleSlots = `EXISTS (SELECT 1 FROM ${swapSlots}
 LEFT JOIN shift_assignments live ON live.assignment_id=slots.assignment_id
 WHERE slots.assignment_id IS NOT NULL AND live.version IS DISTINCT FROM slots.version)`;

type ConflictRow = {
 assignment_id: number;
 request_id: number;
 requester_id: number;
 request_type: 'SWAP' | 'LEAVE' | 'OT';
 status: 'APPROVED' | 'PENDING';
 submitted_at: Date;
 quota_month: string | null;
 expires_at: Date | null;
 is_holiday: boolean;
};

function pendingExpiresAt(row: ConflictRow) {
 if (row.status !== 'PENDING') return null;
 if (row.is_holiday) return row.expires_at;
 if (row.expires_at) {
  const deadline = requestApprovalDeadline(bangkokWorkDate(row.submitted_at), row.submitted_at);
  return row.expires_at < deadline ? row.expires_at : deadline;
 }
 return row.quota_month ? requestApprovalDeadline(row.quota_month, row.submitted_at) : null;
}

// A request covers both partners' assignments on each selected date. For leave
// it also covers the replacement's assignment. Approved history can contain
// more than one request per slot, so keep blocking until all have been undone.
export async function rosterRequestConflicts(
 client: PoolClient, assignmentIds: number[], checkedAt: Date, includeLeave: boolean, excludeRequestId: number | null = null,
) {
 if (!assignmentIds.length) return [];
 const { rows } = await client.query<ConflictRow>(`
  SELECT slots.assignment_id, r.request_id, r.requester_id, r.request_type, r.status, r.submitted_at, to_jsonb(r)->>'quota_month' AS quota_month,
   NULL::timestamptz AS expires_at, false AS is_holiday, r.updated_at
  FROM requests r JOIN change_requests ch USING(request_id)
  CROSS JOIN LATERAL ${swapSlots}
  WHERE slots.assignment_id=ANY($1::int[]) AND r.request_id IS DISTINCT FROM $2::int
    AND (r.status='APPROVED' OR (r.status='PENDING' AND NOT ${staleSlots}))
  ${includeLeave ? `
  UNION ALL
  SELECT slots.assignment_id, r.request_id, r.requester_id, r.request_type, r.status, r.submitted_at, NULL::text, l.expires_at,
   h.evidence IS NOT NULL AS is_holiday, r.updated_at
  FROM requests r JOIN shiftflow_policy.leave_requests l USING(request_id)
  LEFT JOIN LATERAL (SELECT to_jsonb(l)->'holiday_ot_snapshot' AS evidence
   WHERE to_jsonb(l)->>'holiday_date' IS NOT NULL) h ON true
  CROSS JOIN LATERAL (VALUES (l.assignment_id), (l.cover_assignment_id),
   (NULLIF((h.evidence->>'assignment_id')::int,l.assignment_id))) AS slots(assignment_id)
  WHERE slots.assignment_id=ANY($1::int[]) AND r.request_id IS DISTINCT FROM $2::int
    AND (r.status='APPROVED' OR (r.status='PENDING' AND l.expires_at>$3
      AND EXISTS (SELECT 1 FROM shift_assignments a
       WHERE a.assignment_id=l.assignment_id AND a.version=(l.source_snapshot->>'version')::int)
      AND (l.cover_assignment_id IS NULL OR EXISTS (SELECT 1 FROM shift_assignments a
       WHERE a.assignment_id=l.cover_assignment_id AND a.version=(l.cover_snapshot->>'version')::int))
      AND (h.evidence IS NULL OR EXISTS (SELECT 1 FROM shift_assignments a
       WHERE a.assignment_id=(h.evidence->>'assignment_id')::int AND a.version=(h.evidence->>'version')::int))))
  ` : ''}
  ORDER BY status, updated_at DESC NULLS LAST, request_id DESC
 `, includeLeave ? [assignmentIds, excludeRequestId, checkedAt] : [assignmentIds, excludeRequestId]);
 return rows.flatMap(row => {
  const expiresAt = pendingExpiresAt(row);
  return !expiresAt || checkedAt < expiresAt
   ? [{ ...row, expiresAt }]
   : [];
 });
}
