-- A null destination ends production membership on the effective Bangkok date.
-- Keep this minimal record for date-based access and historical rosters.
ALTER TABLE shiftflow_policy.employee_team_transfers ALTER COLUMN team_id DROP NOT NULL;
CREATE UNIQUE INDEX employee_production_exit_idx
 ON shiftflow_policy.employee_team_transfers(employee_id) WHERE team_id IS NULL;

CREATE OR REPLACE FUNCTION shiftflow_policy.employee_team_on(person_id integer, baseline_team integer, work_day date)
 RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT CASE WHEN latest.effective_on IS NULL THEN baseline_team ELSE latest.team_id END
 FROM (VALUES (1)) seed(dummy)
 LEFT JOIN LATERAL (
  SELECT transfer.team_id, transfer.effective_on FROM shiftflow_policy.employee_team_transfers transfer
  WHERE transfer.employee_id=person_id AND transfer.effective_on<=work_day
  ORDER BY transfer.effective_on DESC LIMIT 1
 ) latest ON true
$$;

CREATE TABLE shiftflow_policy.production_exit_evidence (
 employee_id integer PRIMARY KEY,
 effective_on date NOT NULL,
 confirmed_by integer NOT NULL REFERENCES public.users,
 confirmed_at timestamptz NOT NULL,
 previous_team varchar(12) NOT NULL,
 previous_role varchar(20) NOT NULL,
 had_production_access boolean NOT NULL,
 previous_version integer NOT NULL CHECK (previous_version > 0),
 FOREIGN KEY (employee_id,effective_on) REFERENCES shiftflow_policy.employee_team_transfers(employee_id,effective_on)
);
CREATE INDEX production_exit_evidence_retention_idx ON shiftflow_policy.production_exit_evidence(confirmed_at);
ALTER TABLE shiftflow_policy.production_exit_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shiftflow_policy.production_exit_evidence FROM PUBLIC;
GRANT INSERT ON TABLE shiftflow_policy.production_exit_evidence TO shiftflow_app;
CREATE POLICY backend_record_production_exit ON shiftflow_policy.production_exit_evidence
 FOR INSERT TO shiftflow_app WITH CHECK (true);

CREATE FUNCTION shiftflow_policy.purge_production_exit_evidence()
 RETURNS integer LANGUAGE sql SET search_path = '' AS $$
 WITH removed AS (
  DELETE FROM shiftflow_policy.production_exit_evidence
   WHERE confirmed_at <= (((clock_timestamp() AT TIME ZONE 'Asia/Bangkok') - interval '12 months') AT TIME ZONE 'Asia/Bangkok')
  RETURNING 1
 )
 SELECT count(*)::integer FROM removed
$$;
REVOKE ALL ON FUNCTION shiftflow_policy.purge_production_exit_evidence() FROM PUBLIC;

DO $$
BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
  PERFORM cron.schedule('shiftflow-purge-production-exits','0 18 * * *','SELECT shiftflow_policy.purge_production_exit_evidence()');
 END IF;
END
$$;
