import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Database } from '../database/database.service';
import { SchedulesService, assignmentSelect } from '../schedules/schedules.service';
import { ValidationService } from '../validation/validation.service';
import { Actor, Assignment } from '../shared/types';
import { hash } from '../auth/auth.service';
export type SwapInput={assignmentId:number;targetAssignmentId:number;assignmentVersion:number;targetVersion:number};
export type DecisionInput={decision:'APPROVE'|'REJECT';expectedVersion:number;reason:string};
const demoTeam=(code:string)=>['A','B','C','D'].includes(code);
@Injectable()
export class RequestsService {
 constructor(@Inject(Database) private readonly db:Database,@Inject(SchedulesService) private readonly schedules:SchedulesService,@Inject(ValidationService) private readonly validation:ValidationService) {}
 async candidates(actor:Actor,assignmentId:number) {
  return this.db.transaction(async c=>{
   const a=(await this.schedules.pair(c,[assignmentId]))[0];
   if(actor.role!=='EMPLOYEE'||!a||a.employee_id!==actor.employeeId) this.denied();
   this.demoScope(a);
   const rows=(await c.query(`${assignmentSelect} WHERE a.work_date=$1 AND e.team_id<>$2 AND e.position=$3 AND t.team_code IN ('A','B','C','D') AND a.status='ACTIVE' AND st.is_active AND t.is_active ORDER BY e.team_id,e.employee_id`,[a.work_date,a.team_id,a.position])).rows;
   const candidates=[];
   for(const b of rows) candidates.push({...b,validation:await this.validation.check(c,actor,a,b)});
   return {assignment:a,candidates};
  });
 }
 async validate(actor:Actor,input:SwapInput) {
  return this.db.transaction(async c=>{ const [a,b]=await this.getPair(c,actor,input,false); this.versions(a,b,input); return this.validation.check(c,actor,a,b); });
 }
 async create(actor:Actor,input:SwapInput,key:string) {
  if(actor.role!=='EMPLOYEE') this.denied();
  return this.operation(actor,key,{action:'CREATE',...input},async c=>{
   const [a,b]=await this.getPair(c,actor,input,true);
   this.versions(a,b,input);
   const result=await this.validation.check(c,actor,a,b);
   if(!result.valid) throw new BadRequestException({code:'VALIDATION_FAILED',message:'คำขอไม่ผ่านเงื่อนไข กรุณาตรวจรายการที่ระบุ',validation:result});
   const duplicate=await c.query(`SELECT r.request_id FROM requests r JOIN change_requests ch USING(request_id)
    JOIN shift_assignments aa ON aa.assignment_id=ch.assignment_id JOIN shift_assignments bb ON bb.assignment_id=ch.target_assignment_id
    WHERE r.status='PENDING' AND (ch.assignment_id=ANY($1::int[]) OR ch.target_assignment_id=ANY($1::int[]))
    AND aa.version=(ch.snapshot->'source'->>'version')::int AND bb.version=(ch.snapshot->'target'->>'version')::int`,[[a.assignment_id,b.assignment_id]]);
   if(duplicate.rowCount) throw new ConflictException({code:'PENDING_REQUEST',message:'มีคำขอรออนุมัติสำหรับกะนี้อยู่แล้ว กรุณาดูสถานะก่อนยื่นใหม่'});
   const approvers=[];
   for(const team of [a.team_id,b.team_id]) {
    const rows=(await c.query(`SELECT u.user_id FROM users u JOIN employees e USING(employee_id) JOIN roles r USING(role_id)
     WHERE e.team_id=$1 AND r.role_name='SUPERVISOR' AND u.is_active AND u.identity_source='DEMO' AND u.demo_order IS NOT NULL`,[team])).rows;
    if(rows.length!==1) throw new ConflictException({code:'APPROVER_UNRESOLVED',message:'ยังระบุหัวหน้าทีมที่รับผิดชอบไม่ได้ ต้องยืนยันก่อนยื่นคำขอ'});
    approvers.push(rows[0].user_id);
   }
   const requestId=(await c.query("INSERT INTO requests(requester_id,request_type,status) VALUES($1,'SWAP','PENDING') RETURNING request_id",[actor.employeeId])).rows[0].request_id;
   const snapshot={source:a,target:b,validation:result,requestVersion:1};
   await c.query('INSERT INTO change_requests(request_id,assignment_id,target_employee_id,target_assignment_id,snapshot) VALUES($1,$2,$3,$4,$5)',[requestId,a.assignment_id,b.employee_id,b.assignment_id,JSON.stringify(snapshot)]);
   for(let i=0;i<approvers.length;i++) await c.query("INSERT INTO approvals(request_id,approver_id,approver_level,status) VALUES($1,$2,$3,'PENDING')",[requestId,approvers[i],i+1]);
   await this.audit(c,actor,'REQUEST_SUBMITTED',requestId,null,{snapshot,status:'PENDING',requestVersion:1});
   await this.notify(c,approvers[0],requestId,'คำขอสลับกะใหม่','มีคำขอที่ต้องตรวจสอบและอนุมัติ');
   return {requestId,status:'PENDING',version:1};
  });
 }
 async decision(actor:Actor,requestId:number,input:DecisionInput,key:string) {
  if(actor.role!=='SUPERVISOR') this.denied();
  return this.operation(actor,key,{action:'DECISION',requestId,...input},async c=>{
   const request=(await c.query('SELECT * FROM requests WHERE request_id=$1 FOR UPDATE',[requestId])).rows[0];
   if(!request) throw new NotFoundException({code:'NOT_FOUND',message:'ไม่พบคำขอ'});
   const approvals=(await c.query('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[requestId])).rows;
   if(!approvals.some(a=>a.approver_id===actor.userId)) this.denied();
   if(approvals.length!==2||approvals[0].approver_level!==1||approvals[1].approver_level!==2)throw new ConflictException({code:'APPROVER_UNRESOLVED',message:'คำขอนี้ยังไม่มีขั้นอนุมัติของหัวหน้าทั้งสองทีมครบ กรุณาเริ่มคำขอใหม่'});
   if(request.status!=='PENDING') throw new ConflictException({code:'REQUEST_CLOSED',message:'คำขอนี้สิ้นสุดแล้ว ไม่สามารถตัดสินซ้ำ'});
   if(request.version!==input.expectedVersion) throw new ConflictException({code:'VERSION_CONFLICT',message:'คำขอมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุด'});
   const step=approvals.find(a=>a.status==='PENDING');
   if(!step||step.approver_id!==actor.userId) this.denied();
   const change=(await c.query('SELECT * FROM change_requests WHERE request_id=$1',[requestId])).rows[0];
   const snapshotTeams=(await c.query('SELECT team_id,team_code FROM teams WHERE team_id=ANY($1::int[])',[[change.snapshot.source.team_id,change.snapshot.target.team_id]])).rows;
   for(const side of ['source','target']) {
    const team=snapshotTeams.find(t=>t.team_id===change.snapshot[side].team_id);
    if(!team||!demoTeam(team.team_code))throw new ForbiddenException({code:'DEMO_SCOPE',message:'เดโมนี้ทดลองสลับข้ามทีม A–D เท่านั้น'});
   }
   const [a,b]=await this.getPair(c,actor,{assignmentId:change.assignment_id,targetAssignmentId:change.target_assignment_id,assignmentVersion:0,targetVersion:0},true,false);
   const original=change.snapshot;
   if(actor.teamId!==(step.approver_level===1?a.team_id:b.team_id)) this.denied();
   this.versions(a,b,{assignmentVersion:original.source.version,targetVersion:original.target.version});
   if(input.decision==='REJECT'&&!input.reason) throw new BadRequestException({code:'REASON_REQUIRED',message:'กรุณาระบุเหตุผลที่ไม่อนุมัติ'});
   const validation=input.decision==='APPROVE'?await this.validation.check(c,actor,a,b,false):null;
   if(validation&&!validation.valid) throw new ConflictException({code:'VALIDATION_CHANGED',message:'ตารางปัจจุบันไม่ผ่านเงื่อนไข กรุณาสร้างคำขอใหม่',validation});
   const status=input.decision==='APPROVE'?'APPROVED':'REJECTED';
   await c.query('UPDATE approvals SET status=$1,comment=$2,approved_at=now(),request_version=$3 WHERE approval_id=$4',[status,input.reason||null,request.version,step.approval_id]);
   const final=input.decision==='APPROVE'&&step.approver_level===approvals.length;
   const newStatus=input.decision==='REJECT'?'REJECTED':final?'APPROVED':'PENDING';
   if(final) {
    // The employee advisory locks cover all adjacent-day reads; row locks protect both assignments.
    await c.query('SELECT schedule_id FROM schedules WHERE schedule_id=ANY($1::int[]) ORDER BY schedule_id FOR UPDATE',[[a.schedule_id,b.schedule_id]]);
    for(const [own,incoming] of [[a,b],[b,a]]) await c.query('UPDATE shift_assignments SET shift_type_id=$1,assigned_by=$2,version=version+1,updated_at=now() WHERE assignment_id=$3',[incoming.shift_type_id,actor.userId,own.assignment_id]);
    await c.query('UPDATE schedules SET version=version+1,updated_at=now() WHERE schedule_id=ANY($1::int[])',[[a.schedule_id,b.schedule_id]]);
    const after=(own:Assignment,incoming:Assignment)=>({...own,shift_type_id:incoming.shift_type_id,shift_code:incoming.shift_code,shift_name:incoming.shift_name,is_working:incoming.is_working,start_time:incoming.start_time,end_time:incoming.end_time,assigned_by:actor.userId,version:own.version+1});
    await this.audit(c,actor,'SCHEDULE_SWAP_APPLIED',requestId,{source:a,target:b},{source:after(a,b),target:after(b,a),requestVersion:request.version,validation});
   }
   await c.query('UPDATE requests SET status=$1,version=version+1,updated_at=now() WHERE request_id=$2',[newStatus,requestId]);
   await this.audit(c,actor,`REQUEST_${status}`,requestId,{status:request.status,requestVersion:request.version},{status:newStatus,requestVersion:request.version+1,approvedRequestVersion:request.version,originalPayloadVersion:1,level:step.approver_level,reason:input.reason||null});
   if(!final&&input.decision==='APPROVE') await this.notify(c,approvals[step.approver_level].approver_id,requestId,'คำขอรอการอนุมัติของคุณ','หัวหน้าทีมผู้ขออนุมัติแล้ว กรุณาตรวจสอบคำขอ');
   const recipients=(await c.query('SELECT user_id FROM users WHERE employee_id=ANY($1::int[]) AND is_active',[[a.employee_id,b.employee_id]])).rows;
   for(const user of recipients) await this.notify(c,user.user_id,requestId,newStatus==='APPROVED'?'สลับกะเรียบร้อย':newStatus==='REJECTED'?'คำขอไม่อนุมัติ':'ผ่านการอนุมัติฝ่ายแรก','เปิดคำขอเพื่อดูสถานะและรายละเอียดที่อนุญาต');
   return {requestId,status:newStatus,version:request.version+1};
  });
 }
 async cancel(actor:Actor,requestId:number,expectedVersion:number,key:string) {
  if(actor.role!=='EMPLOYEE')this.denied();
  return this.operation(actor,key,{action:'CANCEL',requestId,expectedVersion},async c=>{
   // Decisions acquire this same row lock before reading/updating approval steps.
   const request=(await c.query('SELECT * FROM requests WHERE request_id=$1 FOR UPDATE',[requestId])).rows[0];
   if(!request)throw new NotFoundException({code:'NOT_FOUND',message:'ไม่พบคำขอ'});
   if(request.requester_id!==actor.employeeId)this.denied();
   if(request.status!=='PENDING')throw new ConflictException({code:'REQUEST_CLOSED',message:'คำขอนี้สิ้นสุดแล้ว กรุณาโหลดสถานะล่าสุด'});
   if(request.version!==expectedVersion)throw new ConflictException({code:'VERSION_CONFLICT',message:'คำขอมีการเปลี่ยนแปลง กรุณาโหลดสถานะล่าสุด'});
   const approvals=(await c.query('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[requestId])).rows;
   if(approvals.some(step=>step.status!=='PENDING'))throw new ConflictException({code:'CANCELLATION_CLOSED',message:'หัวหน้าบันทึกคำตัดสินแล้ว จึงยกเลิกคำขอนี้ไม่ได้ กรุณาโหลดสถานะล่าสุด'});
   const change=(await c.query('SELECT * FROM change_requests WHERE request_id=$1',[requestId])).rows[0];
   await c.query("UPDATE requests SET status='CANCELLED',version=version+1,updated_at=now() WHERE request_id=$1",[requestId]);
   await this.audit(c,actor,'REQUEST_CANCELLED',requestId,{status:request.status,requestVersion:request.version},{status:'CANCELLED',requestVersion:request.version+1,workDate:change.snapshot.source.work_date,assignmentId:change.assignment_id,targetAssignmentId:change.target_assignment_id});
   if(approvals[0])await this.notify(c,approvals[0].approver_id,requestId,'คำขอถูกยกเลิก','ผู้ยื่นยกเลิกคำขอก่อนมีคำตัดสิน ตารางกะยังคงเดิม');
   return {requestId,status:'CANCELLED',version:request.version+1};
  });
 }
 async list(actor:Actor) {
  if(!['EMPLOYEE','SUPERVISOR','MANAGER'].includes(actor.role))this.denied();
  const rows=(await this.db.query(`SELECT r.*,ch.snapshot,ch.assignment_id,ch.target_assignment_id,
   source_team.team_code AS source_snapshot_team_code,target_team.team_code AS target_snapshot_team_code,
   aa.version AS source_current_version, bb.version AS target_current_version
   FROM requests r JOIN change_requests ch USING(request_id) JOIN shift_assignments aa ON aa.assignment_id=ch.assignment_id JOIN shift_assignments bb ON bb.assignment_id=ch.target_assignment_id
   LEFT JOIN teams source_team ON source_team.team_id=(ch.snapshot->'source'->>'team_id')::int
   LEFT JOIN teams target_team ON target_team.team_id=(ch.snapshot->'target'->>'team_id')::int
   WHERE $2='MANAGER' OR r.requester_id=$1 OR ($2='SUPERVISOR' AND EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$3))
   ORDER BY r.request_id DESC`,[actor.employeeId,actor.role,actor.userId])).rows;
  for(const row of rows) {
   row.approvals=(await this.db.query(`SELECT a.*,e.first_name||' '||e.last_name AS name,t.team_name FROM approvals a JOIN users u ON u.user_id=a.approver_id JOIN employees e USING(employee_id) JOIN teams t USING(team_id) WHERE a.request_id=$1 ORDER BY approver_level`,[row.request_id])).rows;
   row.hasConflict=row.status==='PENDING'&&(row.source_current_version!==row.snapshot.source.version||row.target_current_version!==row.snapshot.target.version);
   // Older snapshots keep stable team IDs but predate team_code. Do not rewrite approved payloads.
   row.demoSupported=demoTeam(row.source_snapshot_team_code)&&demoTeam(row.target_snapshot_team_code);
   row.approvalRouteConfirmed=row.approvals.length===2&&row.approvals[0].approver_level===1&&row.approvals[1].approver_level===2;
   row.canDecide=row.demoSupported&&row.approvalRouteConfirmed&&!row.hasConflict&&row.status==='PENDING'&&actor.role==='SUPERVISOR'&&row.approvals.find((s:any)=>s.status==='PENDING')?.approver_id===actor.userId;
   row.canCancel=actor.role==='EMPLOYEE'&&row.requester_id===actor.employeeId&&row.status==='PENDING'&&row.approvals.every((step:any)=>step.status==='PENDING');
  }
  return rows;
 }
 private async getPair(c:PoolClient,actor:Actor,input:SwapInput,lock:boolean,submission=true):Promise<[Assignment,Assignment]> {
  let pair=await this.schedules.pair(c,[input.assignmentId,input.targetAssignmentId]);
  if(pair.length!==2) throw new NotFoundException({code:'ASSIGNMENT_NOT_FOUND',message:'ไม่พบรายการกะทั้งสองคน'});
  this.demoScope(...pair);
  if(submission&&(actor.role!=='EMPLOYEE'||!pair.some(a=>a.assignment_id===input.assignmentId&&a.employee_id===actor.employeeId))) this.denied();
  if(lock) {
   for(const employeeId of [...new Set(pair.map(a=>a.employee_id))].sort((a,b)=>a-b)) await c.query('SELECT pg_advisory_xact_lock(810,$1)',[employeeId]);
   pair=await this.schedules.pair(c,[input.assignmentId,input.targetAssignmentId],true);
  }
  return [pair.find(a=>a.assignment_id===input.assignmentId)!,pair.find(a=>a.assignment_id===input.targetAssignmentId)!];
 }
 private versions(a:Assignment,b:Assignment,input:{assignmentVersion:number;targetVersion:number}) {
  if(a.version!==input.assignmentVersion||b.version!==input.targetVersion) throw new ConflictException({code:'SCHEDULE_CHANGED',message:'ตารางกะเปลี่ยนหลังยื่นคำขอ กรุณาโหลดล่าสุดและสร้างคำขอใหม่'});
 }
 private denied():never { throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับรายการนี้'}); }
 private demoScope(...assignments:Assignment[]) {
  if(assignments.some(a=>!demoTeam(a.team_code)))throw new ForbiddenException({code:'DEMO_SCOPE',message:'เดโมนี้ทดลองสลับข้ามทีม A–D เท่านั้น'});
 }
 private async operation(actor:Actor,key:string,input:unknown,run:(c:PoolClient)=>Promise<unknown>) {
  if(!key||! /^[a-zA-Z0-9-]{8,100}$/.test(key)) throw new BadRequestException({code:'IDEMPOTENCY_REQUIRED',message:'คำสั่งไม่มีรหัสป้องกันรายการซ้ำ กรุณาโหลดหน้าใหม่'});
  const inputHash=hash(JSON.stringify(input));
  return this.db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(811,hashtext($1))',[`${actor.userId}:${key}`]);
   const old=(await c.query('SELECT * FROM operation_receipts WHERE user_id=$1 AND operation_key=$2',[actor.userId,key])).rows[0];
   if(old) { if(old.input_hash!==inputHash) throw new ConflictException({code:'KEY_REUSED',message:'รหัสรายการถูกใช้กับคำสั่งอื่นแล้ว'}); return old.response; }
   const result=await run(c);
   await c.query('INSERT INTO operation_receipts(user_id,operation_key,input_hash,response) VALUES($1,$2,$3,$4)',[actor.userId,key,inputHash,JSON.stringify(result)]);
   return result;
  });
 }
 private async audit(c:PoolClient,actor:Actor,action:string,requestId:number,oldValue:unknown,newValue:unknown) {
  await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value) VALUES($1,$2,'REQUEST',$3,$4,$5)",[actor.userId,action,requestId,oldValue===null?null:JSON.stringify(oldValue),JSON.stringify(newValue)]);
 }
 private async notify(c:PoolClient,userId:number,requestId:number,title:string,message:string) {
  await c.query("INSERT INTO notifications(user_id,request_id,title,message,notification_type) VALUES($1,$2,$3,$4,'IN_APP')",[userId,requestId,title,message]);
 }
}
