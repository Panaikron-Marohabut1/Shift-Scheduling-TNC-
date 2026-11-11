ALTER TABLE public.requests DROP CONSTRAINT requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check
 CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','MONTH_CLOSED','POLICY_REPLACED'));

CREATE TABLE shiftflow_policy.swap_policy_activation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 effective_month date NOT NULL CHECK (EXTRACT(DAY FROM effective_month) = 1),
 activated_at timestamptz NOT NULL
);
REVOKE ALL ON TABLE shiftflow_policy.swap_policy_activation FROM PUBLIC;
GRANT SELECT ON TABLE shiftflow_policy.swap_policy_activation TO shiftflow_app;
ALTER TABLE shiftflow_policy.swap_policy_activation ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_read_swap_activation ON shiftflow_policy.swap_policy_activation
 FOR SELECT TO shiftflow_app USING (true);

CREATE FUNCTION shiftflow_policy.require_current_swap_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM shiftflow_policy.swap_policy_activation) THEN
  RAISE EXCEPTION 'Legacy swap requests cannot be created after cutover'
   USING ERRCODE = '55000';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION shiftflow_policy.require_current_swap_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shiftflow_policy.require_current_swap_policy() TO shiftflow_app;
CREATE TRIGGER require_current_swap_policy BEFORE INSERT ON public.requests
 FOR EACH ROW WHEN (NEW.request_type = 'SWAP' AND NEW.quota_month IS NULL)
 EXECUTE FUNCTION shiftflow_policy.require_current_swap_policy();
