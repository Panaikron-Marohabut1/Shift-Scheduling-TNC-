CREATE TABLE shiftflow_policy.shift_absences (
 absence_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 assignment_id integer NOT NULL REFERENCES public.shift_assignments,
 shift_code varchar(12) NOT NULL,
 start_time time NOT NULL,
 end_time time NOT NULL CHECK (start_time <> end_time),
 holiday_date date,
 recorded_by integer NOT NULL REFERENCES public.users,
 recorded_at timestamptz NOT NULL,
 record_key varchar(100) NOT NULL,
 recorded_version integer NOT NULL CHECK (recorded_version > 0),
 cancelled_by integer REFERENCES public.users,
 cancelled_at timestamptz,
 cancel_key varchar(100),
 cancelled_version integer CHECK (cancelled_version > 0),
 UNIQUE (recorded_by, record_key),
 UNIQUE (cancelled_by, cancel_key),
 CHECK (num_nonnulls(cancelled_by, cancelled_at, cancel_key, cancelled_version) IN (0, 4)),
 CHECK (cancelled_at >= recorded_at)
);

CREATE UNIQUE INDEX shift_absences_active_assignment_idx
 ON shiftflow_policy.shift_absences(assignment_id) WHERE cancelled_at IS NULL;
CREATE INDEX shift_absences_assignment_idx ON shiftflow_policy.shift_absences(assignment_id);
CREATE INDEX shift_absences_retention_idx ON shiftflow_policy.shift_absences((COALESCE(cancelled_at, recorded_at)));

ALTER TABLE shiftflow_policy.shift_absences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shiftflow_policy.shift_absences FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE (cancelled_by, cancelled_at, cancel_key, cancelled_version)
 ON TABLE shiftflow_policy.shift_absences TO shiftflow_app;
CREATE POLICY backend_absence_read ON shiftflow_policy.shift_absences
 FOR SELECT TO shiftflow_app USING (true);
CREATE POLICY backend_absence_record ON shiftflow_policy.shift_absences
 FOR INSERT TO shiftflow_app WITH CHECK (cancelled_at IS NULL);
CREATE POLICY backend_absence_cancel ON shiftflow_policy.shift_absences
 FOR UPDATE TO shiftflow_app USING (cancelled_at IS NULL) WITH CHECK (cancelled_at IS NOT NULL);

-- Keep the operational absence and its attribution together for 12 calendar months
-- after the most recent action. PostgreSQL day rollover follows Bangkok time.
CREATE FUNCTION shiftflow_policy.purge_shift_absences()
RETURNS integer LANGUAGE sql SET search_path = '' AS $$
 WITH removed AS (
  DELETE FROM shiftflow_policy.shift_absences
   WHERE COALESCE(cancelled_at, recorded_at) <=
    (((clock_timestamp() AT TIME ZONE 'Asia/Bangkok') - interval '12 months') AT TIME ZONE 'Asia/Bangkok')
  RETURNING 1
 )
 SELECT count(*)::integer FROM removed
$$;
REVOKE ALL ON FUNCTION shiftflow_policy.purge_shift_absences() FROM PUBLIC;

-- The cloud runs this with the migration owner, even when the API is offline.
-- Local maintenance may run the same function with the migration account.
DO $$
BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
  PERFORM cron.schedule('shiftflow-purge-shift-absences','0 18 * * *','SELECT shiftflow_policy.purge_shift_absences()');
 END IF;
END
$$;
