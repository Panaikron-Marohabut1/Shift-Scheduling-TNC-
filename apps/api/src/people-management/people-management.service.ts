import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { demoPeopleAccess } from '../admin-access/demo-access';
import { Database } from '../database/database.service';
import { bangkokWorkDate, pendingSwapClosure } from '../requests/swap-request-time';
import { id } from '../shared/input';
import { Actor } from '../shared/types';

type StaffRole='EMPLOYEE'|'SUPERVISOR';
type Position='FIELD_OPERATOR'|'BOARDMAN'|'SUPERVISOR';
type Transfer={teamCode:string;effectiveOn:string};
type Person={employeeId:number;employeeCode:string;name:string;teamCode:string;position:Position;role:StaffRole;version:number;
 hasAccount:boolean;scheduledTransfer:Transfer|null};
type PersonRow=Person & {userId:number|null;teamId:number};
type RelatedRequest={requestId:number;status:'APPROVED'|'PENDING';workDate:string;quotaMonth:string|null;submittedAt:Date};

const personSelect=`SELECT e.employee_id AS "employeeId",e.employee_code AS "employeeCode",
 e.first_name||' '||e.last_name AS name,t.team_code AS "teamCode",t.team_id AS "teamId",e.position,
 COALESCE(r.role_name,CASE WHEN e.position='SUPERVISOR' THEN 'SUPERVISOR' ELSE 'EMPLOYEE' END) AS role,
 e.people_version AS version,u.user_id AS "userId",
 COALESCE(u.is_active AND u.initial_access_state IS DISTINCT FROM 'PENDING',false) AS "hasAccount",
 (SELECT jsonb_build_object('teamCode',destination.team_code,'effectiveOn',move.effective_on)
  FROM shiftflow_policy.employee_team_transfers move JOIN teams destination ON destination.team_id=move.team_id
  WHERE move.employee_id=e.employee_id AND move.effective_on>$1::date ORDER BY move.effective_on LIMIT 1) AS "scheduledTransfer"
 FROM employees e JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$1::date)
 LEFT JOIN users u ON u.employee_id=e.employee_id LEFT JOIN roles r ON r.role_id=u.role_id
 WHERE e.department='DEMO' AND e.employee_code ~ '^DEMO-[ABCD][0-9]+$' AND e.employment_status='ACTIVE'
  AND t.is_active AND t.team_code IN ('A','B','C','D')
  AND (u.user_id IS NULL OR (u.identity_source='DEMO' AND r.role_name IN ('EMPLOYEE','SUPERVISOR')))`;

function publicPerson(row:PersonRow):Person {
 const {userId,teamId,...person}=row;
 return person;
}

function parseUpdate(body:Record<string,unknown>|undefined) {
 const {teamCode,position,role,effectiveOn,expectedVersion}=body??{};
 if(typeof teamCode!=='string'||!['A','B','C','D'].includes(teamCode)
  || (role!=='EMPLOYEE'&&role!=='SUPERVISOR')
  || (role==='SUPERVISOR' ? position!=='SUPERVISOR' : position!=='FIELD_OPERATOR'&&position!=='BOARDMAN')
  || typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) {
  throw new BadRequestException({code:'INVALID_INPUT',message:'กรุณาเลือกทีม ตำแหน่ง บทบาท และวันที่ให้ถูกต้อง'});
 }
 const date=new Date(`${effectiveOn}T00:00:00Z`);
 if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<2000||date.getUTCFullYear()>2200||date.toISOString().slice(0,10)!==effectiveOn) {
  throw new BadRequestException({code:'INVALID_INPUT',message:'วันที่มีผลไม่ถูกต้อง'});
 }
 return {teamCode,position,role,effectiveOn,version:id(expectedVersion,'เวอร์ชันข้อมูล')};
}

@Injectable()
export class PeopleManagementService {
 constructor(@Inject(Database) private readonly db:Database) {}

 async list(actor:Actor) {
  this.requireDemoManager(actor);
  return this.db.transaction(async c=>{
   await this.requireActiveDemoManager(c,actor);
   const today=bangkokWorkDate(new Date());
   const {rows}=await c.query<PersonRow>(`${personSelect} ORDER BY t.team_code,e.employee_code`,[today]);
   return {people:rows.map(publicPerson),today};
  });
 }

 async update(actor:Actor,employeeId:number,body:Record<string,unknown>) {
  this.requireDemoManager(actor);
  const input=parseUpdate(body);
  return this.db.transaction(async c=>{
   // Swap operations share this lock before reading team/role and choosing approvers.
   await c.query('SELECT pg_advisory_xact_lock(814,1)');
   await this.requireActiveDemoManager(c,actor);
   await c.query('SELECT pg_advisory_xact_lock(810,$1)',[employeeId]);
   const now=new Date();
   const today=bangkokWorkDate(now);
   const {rows:[before]}=await c.query<PersonRow>(`${personSelect} AND e.employee_id=$2 FOR UPDATE OF e`,[today,employeeId]);
   if(!before) throw new NotFoundException({code:'PERSON_NOT_FOUND',message:'ไม่พบพนักงานเดโม่ที่จัดการได้'});
   if(input.version!==before.version) throw new ConflictException({code:'PEOPLE_CHANGED',message:'ข้อมูลพนักงานเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด'});
   const moving=input.teamCode!==before.teamCode;
   const changingRole=input.role!==before.role;
   const changingPosition=input.position!==before.position;
   if(changingRole&&!before.hasAccount) throw new ConflictException({code:'PEOPLE_ACCESS_PENDING',message:'ให้ Admin เปิดสิทธิ์ครั้งแรกก่อนเปลี่ยนบทบาท'});
   if(!moving&&!changingRole&&!changingPosition) return {person:publicPerson(before),today};
   if(moving&&input.effectiveOn<today) throw new BadRequestException({code:'TRANSFER_IN_PAST',message:'ย้ายทีมย้อนหลังไม่ได้'});
   if(moving&&before.scheduledTransfer) throw new ConflictException({code:'TRANSFER_ALREADY_SCHEDULED',message:'มีการย้ายทีมในอนาคตอยู่แล้ว กรุณารอให้การย้ายครั้งเดิมมีผล'});

   const conflicts=await this.relatedRequests(c,before,moving?input.effectiveOn:null,changingRole||changingPosition,now);
   if(conflicts.length) throw new ConflictException({code:'PEOPLE_REQUEST_CONFLICT',
    message:'มีคำขอที่ได้รับผล กรุณาจัดการคำขอเหล่านี้ก่อนเปลี่ยนข้อมูลพนักงาน',conflicts});
   if(moving) {
    const result=await c.query(`INSERT INTO shiftflow_policy.employee_team_transfers(employee_id,effective_on,team_id)
     SELECT $1,$2,team_id FROM teams WHERE team_code=$3 AND is_active ON CONFLICT DO NOTHING`,
    [employeeId,input.effectiveOn,input.teamCode]);
    if(result.rowCount!==1) throw new ConflictException({code:'TRANSFER_UNAVAILABLE',message:'ไม่สามารถบันทึกการย้ายทีมในวันที่เลือกได้'});
   }
   if(changingRole) await c.query(`UPDATE users SET role_id=(SELECT role_id FROM roles WHERE role_name=$1),updated_at=now() WHERE user_id=$2`,[input.role,before.userId]);
   await c.query('UPDATE employees SET position=$2,people_version=people_version+1,updated_at=now() WHERE employee_id=$1',[employeeId,input.position]);
   const {rows:[after]}=await c.query<PersonRow>(`${personSelect} AND e.employee_id=$2`,[today,employeeId]);
   await c.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value)
    VALUES($1,'DEMO_PERSON_UPDATED','EMPLOYEE',$2,$3,$4)`,[actor.userId,employeeId,
    JSON.stringify({teamCode:before.teamCode,role:before.role,position:before.position,version:before.version}),
    JSON.stringify({teamCode:input.teamCode,role:after.role,position:after.position,version:after.version,
     ...(moving?{effectiveOn:input.effectiveOn}:{})})]);
   return {person:publicPerson(after),today};
  });
 }

 private async relatedRequests(c:PoolClient,person:PersonRow,transferDate:string|null,changesAccess:boolean,now:Date) {
  const today=bangkokWorkDate(now);
  const {rows}=await c.query<RelatedRequest>(`SELECT DISTINCT r.request_id AS "requestId",r.status,
    d.work_date::text AS "workDate",r.quota_month AS "quotaMonth",r.submitted_at AS "submittedAt"
   FROM requests r JOIN change_requests ch USING(request_id)
   JOIN shift_assignments a ON a.assignment_id=ch.assignment_id
   JOIN shift_assignments b ON b.assignment_id=ch.target_assignment_id
   CROSS JOIN LATERAL (VALUES (a.work_date),(b.work_date),
    ((ch.snapshot#>>'{secondSwap,source,work_date}')::date),((ch.snapshot#>>'{secondSwap,target,work_date}')::date)) d(work_date)
   WHERE d.work_date IS NOT NULL AND (
    (r.status='PENDING' AND d.work_date>=$4::date AND (
     (($1 IN (r.requester_id,ch.target_employee_id)) AND ($3 OR d.work_date>=$2::date))
     OR (EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$5 AND ap.status='PENDING')
      AND ($3 OR d.work_date>=$2::date))))
    OR (r.status='APPROVED' AND $2::date IS NOT NULL AND d.work_date>=$2::date AND $1 IN (r.requester_id,ch.target_employee_id)))
   ORDER BY "workDate","requestId"`,[person.employeeId,transferDate,changesAccess,`${today.slice(0,7)}-01`,person.userId]);
  return rows.filter(row=>row.status==='APPROVED'||!row.quotaMonth||!pendingSwapClosure(row.quotaMonth,row.submittedAt,now))
   .map(({requestId,status,workDate})=>({requestId,status,workDate}));
 }

 private requireDemoManager(actor:Actor) {
  if(actor.role!=='MANAGER'||!demoPeopleAccess(this.db)) this.denied();
 }

 private async requireActiveDemoManager(c:PoolClient,actor:Actor) {
  const current=await c.query(`SELECT 1 FROM users u JOIN roles r USING(role_id)
   WHERE u.user_id=$1 AND u.is_active AND u.identity_source='DEMO' AND r.role_name='MANAGER'`,[actor.userId]);
  if(!current.rowCount) this.denied();
 }

 private denied():never {
  throw new ForbiddenException({code:'ACTION_DENIED',message:'เฉพาะผู้จัดการเดโม่ที่จัดการข้อมูลพนักงานได้'});
 }
}
