-- Publish missing 2026 schedules in the shared synthetic demo after seeding.
-- Keep existing schedules and assignments intact, including changes from requests.
BEGIN;
SELECT pg_advisory_xact_lock(814,1);

DO $$
DECLARE
 demo_manager_id integer;
 new_month record;
 slot_count integer;
 staff_count integer;
BEGIN
 SELECT u.user_id INTO STRICT demo_manager_id
 FROM public.users u JOIN public.roles r USING (role_id)
 WHERE u.demo_profile='manager' AND u.identity_source='DEMO' AND u.is_active AND r.role_name='MANAGER';

 SELECT count(*) INTO staff_count
 FROM public.employees e JOIN public.teams t USING (team_id)
 WHERE e.department='DEMO' AND e.employee_code ~ '^DEMO-[ABCD][0-9]+$'
   AND e.employment_status='ACTIVE' AND t.team_code IN ('A','B','C','D');

 IF staff_count=0
    OR NOT EXISTS (SELECT 1 FROM public.schedules WHERE year=2026 AND month=8 AND status='PUBLISHED')
    OR EXISTS (
     SELECT 1 FROM public.schedules s JOIN public.shift_assignments a USING (schedule_id)
     JOIN public.employees e USING (employee_id)
     WHERE s.year=2026 AND (e.department IS DISTINCT FROM 'DEMO' OR e.employee_code !~ '^DEMO-[ABCD][0-9]+$')
    ) THEN
  RAISE EXCEPTION 'Expected an existing synthetic demo roster with an August 2026 baseline';
 END IF;

 FOR new_month IN
  INSERT INTO public.schedules (month,year,status,created_by)
  SELECT month,2026,'PUBLISHED',demo_manager_id FROM generate_series(1,12) month
  ON CONFLICT (year,month) DO NOTHING
  RETURNING schedule_id,month
 LOOP
  INSERT INTO public.shift_assignments (schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT new_month.schedule_id,e.employee_id,st.shift_type_id,days.work_date,'ACTIVE',demo_manager_id
  FROM public.employees e JOIN public.teams base USING (team_id)
  CROSS JOIN LATERAL (
   SELECT make_date(2026,new_month.month,1) + day AS work_date
   FROM generate_series(0, (make_date(2026,new_month.month,1) + interval '1 month')::date
     - make_date(2026,new_month.month,1) - 1) day
  ) days
  JOIN public.teams effective
   ON effective.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,days.work_date)
  JOIN public.shift_types st ON st.shift_code=(ARRAY['M','M','O','O','N','N','O','O'])[
   1+mod(8+mod(days.work_date-date '2026-08-01'+CASE effective.team_code
     WHEN 'A' THEN 7 WHEN 'B' THEN 5 WHEN 'C' THEN 3 WHEN 'D' THEN 1 END,8),8)]
  WHERE e.department='DEMO' AND e.employee_code ~ '^DEMO-[ABCD][0-9]+$'
    AND e.employment_status='ACTIVE' AND base.team_code IN ('A','B','C','D');

  GET DIAGNOSTICS slot_count = ROW_COUNT;
  IF slot_count<>staff_count*((make_date(2026,new_month.month,1) + interval '1 month')::date
     - make_date(2026,new_month.month,1)) THEN
   RAISE EXCEPTION 'Incomplete synthetic roster for 2026 month %', new_month.month;
  END IF;

  INSERT INTO public.audit_logs (user_id,action,entity_type,entity_id,new_value)
  VALUES (demo_manager_id,'DEMO_ROSTER_PUBLISHED','SCHEDULE',new_month.schedule_id,
   jsonb_build_object('year',2026,'month',new_month.month,'assignments',slot_count,
     'rotationAnchor','2026-08-01','databaseActor',session_user));
 END LOOP;
END $$;

COMMIT;
