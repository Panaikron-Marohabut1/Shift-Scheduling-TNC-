-- Shared synthetic demo only. These dates are calendar fixtures, not the TNC calendar.
WITH demo_manager AS (
 SELECT u.user_id FROM public.users u JOIN public.roles r USING(role_id)
 WHERE u.demo_profile='manager' AND u.identity_source='DEMO' AND u.is_active AND r.role_name='MANAGER'
), fixtures(holiday_date,holiday_name) AS (
 VALUES
  (date '2026-12-05','วันพ่อแห่งชาติ'),
  (date '2026-12-07','ชดเชยวันพ่อแห่งชาติ'),
  (date '2026-12-10','วันรัฐธรรมนูญ'),
  (date '2026-12-31','วันสิ้นปี')
), inserted AS (
 INSERT INTO public.holidays(holiday_date,holiday_name,created_by)
 SELECT f.holiday_date,f.holiday_name,m.user_id FROM fixtures f CROSS JOIN demo_manager m
 WHERE EXISTS (SELECT 1 FROM public.schedules WHERE year=2026 AND month=12 AND status='PUBLISHED')
 AND NOT EXISTS (
  SELECT 1 FROM public.schedules s JOIN public.shift_assignments a USING(schedule_id)
  JOIN public.employees e USING(employee_id)
  WHERE s.year=2026 AND s.month=12 AND e.department IS DISTINCT FROM 'DEMO'
 )
 ON CONFLICT (holiday_date) DO NOTHING
 RETURNING holiday_id,holiday_date,created_by
)
INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,new_value)
SELECT created_by,'DEMO_HOLIDAY_CALENDAR_SEEDED','HOLIDAY',holiday_id,
 jsonb_build_object('date',holiday_date,'source','synthetic demo calendar','databaseActor',session_user)
FROM inserted;
