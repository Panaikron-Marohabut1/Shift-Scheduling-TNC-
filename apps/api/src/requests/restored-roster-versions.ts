import { Assignment } from '../shared/types';

type VersionedSlot = Pick<Assignment, 'assignment_id' | 'version' | 'work_date' | 'shift_type_id'>;
type RestoredSlot = VersionedSlot & { restoredFromVersion: number };
type RosterEvidenceReader = {
 query(text: string, values: unknown[]): Promise<{ rows: { slot: RestoredSlot }[] }>;
};

// Only committed, protected reversal evidence can link a newer physical
// version to a previous roster state. Unrelated edits break that chain.
export async function restoredRosterVersions(client: RosterEvidenceReader, assignments: VersionedSlot[]) {
 const versions = new Map<number, number>();
 if (!assignments.length) return versions;
 const currentSlots = new Map(assignments.map(slot => [slot.assignment_id, slot]));
 const { rows } = await client.query(`
  SELECT entry.slot
  FROM audit_logs al JOIN requests r ON r.request_id=al.entity_id
  CROSS JOIN LATERAL jsonb_array_elements(al.new_value->'assignments') AS entry(slot)
  WHERE al.entity_type='REQUEST' AND r.status='CANCELLED'
   AND al.action IN ('SCHEDULE_SWAP_REVERSED','SCHEDULE_LEAVE_REVERSED','SCHEDULE_OT_REVERSED')
   AND (entry.slot->>'assignment_id')::int=ANY($1::int[])
  ORDER BY al.audit_id DESC
 `, [[...currentSlots.keys()]]);
 for (const { slot } of rows) {
  const current = currentSlots.get(slot.assignment_id);
  if (current && current.work_date === slot.work_date && current.shift_type_id === slot.shift_type_id
   && (versions.get(slot.assignment_id) ?? current.version) === slot.version
   && Number.isSafeInteger(slot.restoredFromVersion) && slot.restoredFromVersion > 0
   && slot.restoredFromVersion < slot.version) {
   versions.set(slot.assignment_id, slot.restoredFromVersion);
  }
 }
 return versions;
}
