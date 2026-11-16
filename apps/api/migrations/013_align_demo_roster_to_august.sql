-- Coordinate with request decisions and team changes while correcting the synthetic roster.
SELECT pg_advisory_xact_lock(814,1);

-- The August reference is the same eight-day cycle used by the demo seed and
-- calendar preview. Shared demo installations previously started in September.
WITH demo_manager AS (
 SELECT u.user_id FROM public.users u JOIN public.roles r USING(role_id)
 WHERE u.demo_profile='manager' AND u.identity_source='DEMO' AND u.is_active AND r.role_name='MANAGER'
), demo_staff AS (
 SELECT e.employee_id,e.team_id FROM public.employees e JOIN public.teams t USING(team_id)
 WHERE e.department='DEMO' AND e.employee_code ~ '^DEMO-[ABCD][0-9]+$'
  AND e.employment_status='ACTIVE' AND t.team_code IN ('A','B','C','D')
), august AS (
 INSERT INTO public.schedules(month,year,status,created_by)
 SELECT 8,2026,'PUBLISHED',user_id FROM demo_manager
 WHERE (SELECT count(DISTINCT team_id) FROM demo_staff)=4
 ON CONFLICT(year,month) DO NOTHING
 RETURNING schedule_id,created_by
)
INSERT INTO public.shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
SELECT s.schedule_id,e.employee_id,st.shift_type_id,d.work_date,'ACTIVE',s.created_by
FROM august s CROSS JOIN demo_staff e
CROSS JOIN LATERAL (SELECT date '2026-08-01'+i AS work_date FROM generate_series(0,30) i) d
JOIN public.teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,d.work_date)
JOIN public.shift_types st ON st.shift_code=(ARRAY['M','M','O','O','N','N','O','O'])[
 1+mod(d.work_date-date '2026-08-01'+CASE t.team_code WHEN 'A' THEN 7 WHEN 'B' THEN 5 WHEN 'C' THEN 3 WHEN 'D' THEN 1 END,8)]
ON CONFLICT(employee_id,work_date) DO NOTHING;

WITH protected_slots AS MATERIALIZED (
 SELECT slots.assignment_id
 FROM public.requests r JOIN public.change_requests ch USING(request_id)
 CROSS JOIN LATERAL (VALUES (ch.assignment_id),(ch.target_assignment_id),
  ((ch.snapshot#>>'{secondSwap,source,assignment_id}')::integer),
  ((ch.snapshot#>>'{secondSwap,target,assignment_id}')::integer)) slots(assignment_id)
 WHERE r.status='APPROVED' OR (r.status='PENDING' AND
  (r.quota_month IS NULL OR (r.quota_month=date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')::date AND r.submitted_at+interval '24 hours'>now())))
 UNION
 SELECT slots.assignment_id FROM public.requests r JOIN shiftflow_policy.leave_requests l USING(request_id)
 CROSS JOIN LATERAL (VALUES (l.assignment_id),(l.cover_assignment_id)) slots(assignment_id)
 WHERE r.status='APPROVED' OR (r.status='PENDING' AND l.expires_at>now())
), baseline AS (
 SELECT a.assignment_id,a.schedule_id,a.work_date,a.version,old.shift_code AS old_code,
  next.shift_code AS new_code,next.shift_type_id,u.user_id
 FROM public.shift_assignments a JOIN public.employees e USING(employee_id)
 JOIN public.teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,a.work_date)
 JOIN public.shift_types old ON old.shift_type_id=a.shift_type_id
 JOIN public.shift_types next ON next.shift_code=(ARRAY['M','M','O','O','N','N','O','O'])[
  1+mod(a.work_date-date '2026-08-01'+CASE t.team_code WHEN 'A' THEN 7 WHEN 'B' THEN 5 WHEN 'C' THEN 3 WHEN 'D' THEN 1 END,8)]
 JOIN public.users u ON u.demo_profile='manager' AND u.identity_source='DEMO' AND u.is_active
 JOIN public.roles role ON role.role_id=u.role_id AND role.role_name='MANAGER'
 WHERE e.department='DEMO' AND e.employee_code ~ '^DEMO-[ABCD][0-9]+$'
  AND a.work_date BETWEEN '2026-08-01' AND '2026-11-30' AND a.status='ACTIVE' AND a.version=1
  AND old.shift_code IN ('M','N','O') AND old.shift_code<>next.shift_code
  AND NOT EXISTS (SELECT 1 FROM protected_slots p WHERE p.assignment_id=a.assignment_id)
), corrected AS (
 UPDATE public.shift_assignments a SET shift_type_id=b.shift_type_id,version=a.version+1,updated_at=now()
 FROM baseline b WHERE a.assignment_id=b.assignment_id AND a.version=b.version
 RETURNING b.*,a.version AS new_version
), audit AS (
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,old_value,new_value)
 SELECT user_id,'DEMO_ROSTER_REBASED','SHIFT_ASSIGNMENT',assignment_id,
  jsonb_build_object('workDate',work_date,'shiftCode',old_code,'version',version),
  jsonb_build_object('workDate',work_date,'shiftCode',new_code,'version',new_version,'migration','013_align_demo_roster_to_august','databaseActor',session_user)
 FROM corrected
)
UPDATE public.schedules s SET version=s.version+1,updated_at=now()
WHERE EXISTS (SELECT 1 FROM corrected c WHERE c.schedule_id=s.schedule_id);
