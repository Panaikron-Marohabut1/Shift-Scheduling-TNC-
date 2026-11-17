ALTER TABLE shiftflow_policy.leave_requests
 ADD COLUMN holiday_date date REFERENCES public.holidays(holiday_date),
 ADD COLUMN holiday_source_snapshot jsonb,
 ADD COLUMN holiday_ot_snapshot jsonb,
 ADD CONSTRAINT holiday_leave_evidence
 CHECK (
  (holiday_date IS NULL AND holiday_source_snapshot IS NULL AND holiday_ot_snapshot IS NULL)
  OR (holiday_date IS NOT NULL AND holiday_source_snapshot IS NOT NULL AND holiday_ot_snapshot IS NOT NULL
   AND cover_assignment_id IS NULL AND leave_code IS NULL AND reason IS NULL AND ot_code IS NULL)
 );

CREATE INDEX holiday_leave_date_idx ON shiftflow_policy.leave_requests(holiday_date)
 WHERE holiday_date IS NOT NULL;
CREATE INDEX holiday_leave_ot_assignment_idx
 ON shiftflow_policy.leave_requests(((holiday_ot_snapshot->>'assignment_id')::integer))
 WHERE holiday_date IS NOT NULL;

CREATE OR REPLACE FUNCTION shiftflow_policy.purge_leave_details()
RETURNS integer LANGUAGE sql SET search_path = '' AS $$
 WITH removed AS (
  UPDATE shiftflow_policy.leave_requests
   SET leave_code=NULL, reason=NULL, rejection_reason=NULL
   WHERE (reason IS NOT NULL OR rejection_reason IS NOT NULL)
     AND (COALESCE(finished_at,expires_at) AT TIME ZONE 'Asia/Bangkok') + interval '12 months'
        <= clock_timestamp() AT TIME ZONE 'Asia/Bangkok'
  RETURNING 1
 )
 SELECT count(*)::integer FROM removed
$$;
