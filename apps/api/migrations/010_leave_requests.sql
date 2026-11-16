ALTER TABLE public.requests DROP CONSTRAINT requests_request_type_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_request_type_check
 CHECK (request_type IN ('SWAP','LEAVE'));

CREATE TABLE shiftflow_policy.leave_requests (
 request_id integer PRIMARY KEY REFERENCES public.requests,
 assignment_id integer NOT NULL REFERENCES public.shift_assignments,
 cover_assignment_id integer REFERENCES public.shift_assignments,
 cover_employee_id integer REFERENCES public.employees,
 source_snapshot jsonb NOT NULL,
 cover_snapshot jsonb,
 leave_code varchar(2) CHECK (leave_code IN ('V','B','S')),
 reason text,
 rejection_reason text,
 shift_starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK (expires_at <= shift_starts_at),
 finished_at timestamptz,
 CHECK ((leave_code IS NULL) = (reason IS NULL)),
 CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 1000),
 CHECK (num_nonnulls(cover_assignment_id,cover_employee_id,cover_snapshot) IN (0,3)),
 CHECK (assignment_id <> cover_assignment_id)
);
CREATE INDEX leave_requests_cover_employee_idx ON shiftflow_policy.leave_requests(cover_employee_id);
CREATE INDEX leave_requests_assignment_idx ON shiftflow_policy.leave_requests(assignment_id);
CREATE INDEX leave_requests_cover_assignment_idx ON shiftflow_policy.leave_requests(cover_assignment_id);
ALTER TABLE shiftflow_policy.leave_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shiftflow_policy.leave_requests FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE (finished_at,rejection_reason) ON TABLE shiftflow_policy.leave_requests TO shiftflow_app;
CREATE POLICY backend_leave_read ON shiftflow_policy.leave_requests FOR SELECT TO shiftflow_app USING (true);
CREATE POLICY backend_leave_insert ON shiftflow_policy.leave_requests FOR INSERT TO shiftflow_app WITH CHECK (true);
CREATE POLICY backend_leave_finish ON shiftflow_policy.leave_requests FOR UPDATE TO shiftflow_app USING (true);

-- The generic roster symbol avoids revealing the type of leave in the shared schedule.
INSERT INTO public.shift_types(shift_code,shift_name,start_time,end_time,is_working)
VALUES ('L','ลา',NULL,NULL,false), ('MT','ทำงานล่วงเวลากะเช้า','07:30','19:30',true),
       ('NT','ทำงานล่วงเวลากะดึก','19:30','07:30',true)
ON CONFLICT (shift_code) DO NOTHING;

CREATE FUNCTION shiftflow_policy.purge_leave_details()
RETURNS integer LANGUAGE sql SET search_path = '' AS $$
 WITH removed AS (
  UPDATE shiftflow_policy.leave_requests
   SET leave_code=NULL, reason=NULL, rejection_reason=NULL
   WHERE reason IS NOT NULL
     AND (COALESCE(finished_at,expires_at) AT TIME ZONE 'Asia/Bangkok') + interval '12 months'
         <= clock_timestamp() AT TIME ZONE 'Asia/Bangkok'
   RETURNING 1
 )
 SELECT count(*)::integer FROM removed
$$;
REVOKE ALL ON FUNCTION shiftflow_policy.purge_leave_details() FROM PUBLIC;

-- Managed PostgreSQL runs this even when the app is offline. Local installations
-- can run the same function with the migration account during maintenance.
DO $$
BEGIN
 IF current_database()='postgres' AND to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
 END IF;
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
  PERFORM cron.schedule('shiftflow-purge-leave-details','0 18 * * *','SELECT shiftflow_policy.purge_leave_details()');
 END IF;
END
$$;
