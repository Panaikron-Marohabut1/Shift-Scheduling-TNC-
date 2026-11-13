import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ActorRequest, DemoAdminAllowed } from '../auth/access.guard';
import { Database } from '../database/database.service';
import { bangkokWorkDate } from '../requests/swap-request-time';
import { pathId } from '../shared/input';
import { isDemoAdmin, localDemoAccess, onboardingDemoProfile } from './demo-access';

const initialRoles=new Set(['EMPLOYEE','SUPERVISOR','MANAGER']);
const pendingAccount=`u.identity_source='DEMO' AND u.demo_profile=$1 AND u.is_active
 AND u.azure_object_id IS NOT NULL AND u.initial_access_state='PENDING' AND u.initial_access_requested_at IS NOT NULL
 AND e.department='DEMO' AND e.employee_code='DEMO-B2' AND e.employment_status='ACTIVE'`;

@DemoAdminAllowed()
@Controller('api/admin/access')
export class AdminAccessController {
 constructor(@Inject(Database) private readonly db:Database) {}

 private authorize(req:ActorRequest) {
  if(!isDemoAdmin(req.actor)||!localDemoAccess(this.db)) {
   throw new ForbiddenException({code:'ACTION_DENIED',message:'เฉพาะ Admin เดโม่ในเครื่องที่จัดการการเข้าใช้งานครั้งแรกได้'});
  }
 }

 @Get('pending') async pending(@Req() req:ActorRequest) {
  this.authorize(req);
  const result=await this.db.query(`SELECT u.user_id AS "userId",e.employee_code AS "employeeCode",
   e.first_name||' '||e.last_name AS name,t.team_code AS "teamCode",u.initial_access_requested_at AS "requestedAt"
   FROM users u JOIN employees e USING(employee_id)
   JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$2::date)
   WHERE ${pendingAccount} AND t.is_active AND t.team_code IN ('A','B','C','D')
   ORDER BY u.initial_access_requested_at,u.user_id`,[onboardingDemoProfile,bangkokWorkDate(new Date())]);
  return {users:result.rows};
 }

 @Get('accounts') async accounts(@Req() req:ActorRequest) {
  this.authorize(req);
  return this.db.transaction(async c=>{
   const {rows:[directory]}=await c.query(`WITH accounts AS (
    SELECT u.user_id AS "userId", e.employee_code AS "employeeCode", t.team_code AS "teamCode",
     COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS name,
     CASE WHEN u.initial_access_state IS DISTINCT FROM 'PENDING' THEN r.role_name END AS role,
     CASE WHEN NOT u.is_active OR (e.team_id IS NOT NULL AND t.is_active IS DISTINCT FROM true) THEN 'INACTIVE'
      WHEN u.azure_object_id IS NULL THEN 'UNLINKED'
      WHEN u.initial_access_state='PENDING' AND u.initial_access_requested_at IS NULL THEN 'WAITING_LOGIN'
      WHEN u.initial_access_state='PENDING' THEN 'PENDING' ELSE 'ACTIVE' END AS status
    FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id)
    LEFT JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$1::date)
    WHERE u.identity_source='DEMO'
   ), grants AS (
    SELECT a.audit_id AS id, target."userId", target.name, target."employeeCode",
     a.new_value->>'role' AS role, actor.name AS "grantedBy", a.created_at AS "grantedAt"
    FROM audit_logs a JOIN accounts target ON target."userId"=a.entity_id
    JOIN accounts actor ON actor."userId"=a.user_id
    WHERE a.entity_type='USER' AND a.action='INITIAL_ACCESS_ASSIGNED'
    ORDER BY a.created_at DESC,a.audit_id DESC LIMIT 50
   ) SELECT
    COALESCE((SELECT json_agg(accounts ORDER BY name,"userId") FROM accounts),'[]') AS accounts,
    COALESCE((SELECT json_agg(grants ORDER BY "grantedAt" DESC,id DESC) FROM grants),'[]') AS grants`,[bangkokWorkDate(new Date())]);
   await c.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id)
    VALUES($1,'ADMIN_ACCOUNT_DIRECTORY_VIEWED','USER',$1)`,[req.actor.userId]);
   return directory;
  });
 }

 @Post(':userId/assign') async assign(@Req() req:ActorRequest,@Param('userId') userIdValue:string,@Body() input:{role?:unknown}) {
  this.authorize(req);
  const userId=pathId(userIdValue),role=input?.role;
  if(typeof role!=='string'||!initialRoles.has(role)) {
   throw new BadRequestException({code:'INVALID_INITIAL_ROLE',message:'เลือกบทบาทเริ่มต้นเป็น Manager, Supervisor หรือ Employee'});
  }
  return this.db.transaction(async c=>{
   // Keep the same lock order as team, role, and swap mutations.
   await c.query('SELECT pg_advisory_xact_lock(814,1)');
   const today=bangkokWorkDate(new Date());
   const {rows:[candidate]}=await c.query<{employee_id:number;position:string|null}>(`SELECT u.employee_id,e.position FROM users u
    JOIN employees e USING(employee_id)
    JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$3::date)
    WHERE ${pendingAccount} AND u.user_id=$2 AND t.is_active AND t.team_code IN ('A','B','C','D')`,[onboardingDemoProfile,userId,today]);
   if(!candidate) throw this.notPending();
   await c.query('SELECT pg_advisory_xact_lock(810,$1)',[candidate.employee_id]);
   const updated=await c.query(`UPDATE users u SET role_id=r.role_id,initial_access_state='ASSIGNED',updated_at=now()
    FROM roles r WHERE u.user_id=$1 AND u.employee_id=$2 AND u.initial_access_state='PENDING'
    AND u.identity_source='DEMO' AND u.demo_profile=$3 AND u.is_active AND u.azure_object_id IS NOT NULL
    AND u.initial_access_requested_at IS NOT NULL AND r.role_name=$4`,[userId,candidate.employee_id,onboardingDemoProfile,role]);
   if(!updated.rowCount) throw this.notPending();
   const {rows:[employee]}=await c.query<{position:string|null}>(`UPDATE employees SET
    position=CASE WHEN $2='SUPERVISOR' THEN 'SUPERVISOR' ELSE position END,
    people_version=people_version+1,updated_at=now()
    WHERE employee_id=$1 AND department='DEMO' AND employee_code='DEMO-B2' AND employment_status='ACTIVE'
    RETURNING position`,[candidate.employee_id,role]);
   if(!employee) throw this.notPending();
   await c.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value)
    VALUES($1,'INITIAL_ACCESS_ASSIGNED','USER',$2,$3,$4)`,[req.actor.userId,userId,
    JSON.stringify({initialAccess:'PENDING',position:candidate.position}),
    JSON.stringify({initialAccess:'ASSIGNED',role,position:employee.position})]);
   return {userId,role};
  });
 }

 private notPending() {
  return new ConflictException({code:'ACCESS_NOT_PENDING',message:'บัญชีนี้ไม่ได้อยู่ในคิวรอกำหนดบทบาทแล้ว กรุณาโหลดรายการล่าสุด'});
 }
}
