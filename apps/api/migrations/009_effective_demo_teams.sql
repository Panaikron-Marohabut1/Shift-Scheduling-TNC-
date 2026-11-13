ALTER TABLE public.employees ADD COLUMN people_version integer NOT NULL DEFAULT 1 CHECK (people_version > 0);

-- The existing employee team stays the baseline for dates before the first recorded transfer.
CREATE TABLE shiftflow_policy.employee_team_transfers (
 employee_id integer NOT NULL REFERENCES public.employees,
 effective_on date NOT NULL,
 team_id integer NOT NULL REFERENCES public.teams,
 PRIMARY KEY (employee_id, effective_on)
);
ALTER TABLE shiftflow_policy.employee_team_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shiftflow_policy.employee_team_transfers FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE shiftflow_policy.employee_team_transfers TO shiftflow_app;
CREATE POLICY backend_read_team_transfers ON shiftflow_policy.employee_team_transfers
 FOR SELECT TO shiftflow_app USING (true);
CREATE POLICY backend_write_team_transfers ON shiftflow_policy.employee_team_transfers
 FOR INSERT TO shiftflow_app WITH CHECK (true);

CREATE FUNCTION shiftflow_policy.employee_team_on(person_id integer, baseline_team integer, work_day date)
 RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT COALESCE((
  SELECT transfer.team_id FROM shiftflow_policy.employee_team_transfers transfer
  WHERE transfer.employee_id = person_id AND transfer.effective_on <= work_day
  ORDER BY transfer.effective_on DESC LIMIT 1
 ), baseline_team)
$$;
REVOKE ALL ON FUNCTION shiftflow_policy.employee_team_on(integer,integer,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shiftflow_policy.employee_team_on(integer,integer,date) TO shiftflow_app;
