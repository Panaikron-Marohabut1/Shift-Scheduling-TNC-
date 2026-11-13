ALTER TABLE public.users
 ADD COLUMN initial_access_state varchar(10),
 ADD COLUMN initial_access_requested_at timestamptz,
 ADD CONSTRAINT users_demo_initial_access CHECK (
  (initial_access_state IS NULL AND initial_access_requested_at IS NULL)
  OR (
   initial_access_state IS NOT NULL AND initial_access_state IN ('PENDING','ASSIGNED')
   AND identity_source='DEMO' AND demo_profile IS NOT NULL AND demo_profile='employee-b2-onboarding'
   AND employee_id IS NOT NULL AND demo_order IS NULL
   AND (initial_access_state='PENDING' OR initial_access_requested_at IS NOT NULL)
  )
 );

CREATE OR REPLACE FUNCTION public.enforce_demo_identity() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE role_name_value text;
BEGIN
 SELECT role_name INTO role_name_value FROM public.roles WHERE role_id=NEW.role_id;
 IF role_name_value='ADMIN' AND (
  NEW.identity_source IS DISTINCT FROM 'DEMO' OR NEW.demo_profile IS DISTINCT FROM 'admin-demo'
  OR NEW.employee_id IS NOT NULL OR NEW.demo_order IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Admin access is restricted to the reserved demo profile';
 END IF;
 IF NEW.employee_id IS NULL AND role_name_value NOT IN ('MANAGER','EXTERNAL','ADMIN') THEN
  RAISE EXCEPTION 'Only Manager, External and reserved Admin demo profiles may omit employee identity';
 END IF;
 RETURN NEW;
END $$;
