CREATE SCHEMA shiftflow_policy;
REVOKE ALL ON SCHEMA shiftflow_policy FROM PUBLIC;
GRANT USAGE ON SCHEMA shiftflow_policy TO shiftflow_app;

CREATE TABLE shiftflow_policy.swap_quota_limits (
 effective_month date PRIMARY KEY CHECK (EXTRACT(DAY FROM effective_month) = 1),
 monthly_limit integer NOT NULL CHECK (monthly_limit > 0),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
REVOKE ALL ON TABLE shiftflow_policy.swap_quota_limits FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE shiftflow_policy.swap_quota_limits TO shiftflow_app;
ALTER TABLE shiftflow_policy.swap_quota_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_swap_quota ON shiftflow_policy.swap_quota_limits TO shiftflow_app
 USING (true) WITH CHECK (true);
