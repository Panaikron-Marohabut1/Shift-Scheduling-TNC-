ALTER TABLE shiftflow_policy.leave_requests DROP CONSTRAINT leave_requests_check;

-- Preserve earlier deadlines for ended requests and do not reopen requests
-- that already expired under the original leave policy.
UPDATE shiftflow_policy.leave_requests l
SET expires_at=LEAST(
 r.submitted_at + interval '24 hours',
 (date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Bangkok') + interval '1 month') AT TIME ZONE 'Asia/Bangkok'
)
FROM public.requests r
WHERE r.request_id=l.request_id
 AND r.status='PENDING'
 AND l.expires_at>statement_timestamp();
