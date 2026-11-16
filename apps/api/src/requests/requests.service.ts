import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Database } from '../database/database.service';
import { SchedulesService } from '../schedules/schedules.service';
import { crossDateCoverChecks, ValidationService } from '../validation/validation.service';
import { Actor, Assignment, SwapPair } from '../shared/types';
import { hash } from '../auth/auth.service';
import { SwapQuotaService } from './swap-quota.service';
import { bangkokWorkDate, pendingRequestClosure, requestApprovalDeadline, requireOpenSubmission, requireOpenApproval } from './request-time';
import { AppliedSwapEvidence, cancellationConflict, cancellationDeadlineIssue, cancellationPlan, cancellationSlotsMatch } from './approved-swap-cancellation';
import { leaveCoverCode, leaveReason, leaveShiftStart } from './leave-policy';
import { rosterRequestConflicts, staleSlots, swapSlots } from './roster-request-conflicts';
import { restoredRosterVersions } from './restored-roster-versions';
type SwapLeg={assignmentId:number;targetAssignmentId:number;assignmentVersion:number;targetVersion:number};
export type SwapInput=SwapLeg&{secondSwap?:SwapLeg};
export type DecisionInput={decision:'APPROVE'|'REJECT';expectedVersion:number;reason:string};
type AssignmentInput={assignmentId:number;assignmentVersion:number};
type LeaveInput=AssignmentInput&{cover:{id:number;version:number}|null;leaveCode:unknown;reason:unknown};
type OTCode='MT'|'NT';
type OTInput=AssignmentInput&{otCode:unknown};
type RosterRequestDetail={kind:'leave';code:string;reason:string;cover:LeaveInput['cover']}|{kind:'ot';code:OTCode;cover:null};
type LeaveRow={request_id:number;requester_id:number;version:number;status:string;submitted_at:Date;expires_at:Date;shift_starts_at:Date;
 source_snapshot:Assignment;cover_snapshot:Assignment|null;ot_code?:OTCode|null};
const leaveSlots=(row:LeaveRow)=>row.cover_snapshot?[row.source_snapshot,row.cover_snapshot]:[row.source_snapshot];
const leaveRole=(slot:Assignment)=>slot.position==='SUPERVISOR'?'SUPERVISOR':'EMPLOYEE';
const leaveCoverShift=(a:Assignment,b:Assignment)=>leaveCoverCode(
 {role:leaveRole(a),teamId:a.team_id,shiftCode:a.shift_code},{role:leaveRole(b),teamId:b.team_id,shiftCode:b.shift_code});
const leaveExpired=()=>new ConflictException({code:'LEAVE_EXPIRED',message:'คำขอลาหมดอายุแล้ว'});
const leavePendingClosure=(request:Pick<LeaveRow,'submitted_at'|'expires_at'|'ot_code'>,now:Date)=>
 pendingRequestClosure(bangkokWorkDate(request.submitted_at),request.submitted_at,now,request.ot_code?'ot':'leave')
 ?? (now>=request.expires_at?{status:'EXPIRED',code:'REQUEST_EXPIRED',message:'คำขอลาหมดอายุแล้ว'}:null);
function requireOpenLeave(request:Pick<LeaveRow,'submitted_at'|'expires_at'|'ot_code'>,now:Date) {
 const closure=leavePendingClosure(request,now);
 if(closure)throw new ConflictException({code:closure.code,message:closure.message});
}
const leaveChanged=()=>new ConflictException({code:'SCHEDULE_CHANGED',message:'ตารางกะเปลี่ยนไป กรุณาตรวจตารางล่าสุด'});
const demoTeam=(code:string)=>['A','B','C','D'].includes(code);
const managerApproval=(snapshot:{approvalRoute?:string})=>snapshot.approvalRoute==='MANAGER';
const parallelApprovals=(snapshot:{approvalRoute?:string})=>snapshot.approvalRoute==='TWO_SUPERVISORS';
const invalidCrossDate=(snapshot:{source:Assignment;target:Assignment;secondSwap?:{source:Assignment;target:Assignment}})=>
 snapshot.secondSwap&&crossDateCoverChecks([snapshot.source,snapshot.target],
  [snapshot.secondSwap.source,snapshot.secondSwap.target]).some(check=>check.status==='FAIL');
const crossDateApprovalBlocked='คำขอนี้ใช้รูปแบบสลับคนละวันเดิม ให้ปิดคำขอแล้วเลือกวันที่ที่คนมาทำแทนหยุดอยู่';
const legacyApprovalBlocked='คำขอนี้ยื่นก่อนเริ่มใช้กติกาใหม่ กรุณาปิดรายการเดิมและยื่นคำขอใหม่';
const rosterDates=(snapshot:{source:Assignment;target:Assignment;secondSwap?:{source:Assignment;target:Assignment}})=>
 [snapshot.source.work_date,snapshot.target.work_date,...(snapshot.secondSwap?[snapshot.secondSwap.source.work_date,snapshot.secondSwap.target.work_date]:[])];
const validApprovalSteps=(steps:{approver_level:number}[],manager:boolean)=>
 steps.length===(manager?1:2)&&steps.every((step,index)=>step.approver_level===index+1);
type ApprovalStep={approver_id:number;approver_level:number;status:string;request_version:number;approval_id:number};
const pendingStep=(steps:ApprovalStep[],userId:number,parallel:boolean)=>
 steps.find(step=>step.status==='PENDING'&&(!parallel||step.approver_id===userId));
const appliedSwapEvidence=(requestId:string)=>`SELECT jsonb_build_object('before',old_value,'after',new_value) AS evidence
 FROM audit_logs WHERE entity_type='REQUEST' AND action='SCHEDULE_SWAP_APPLIED' AND entity_id=${requestId}
 ORDER BY audit_id DESC LIMIT 1`;
const cancellationAssignmentIds=(change:{assignment_id:number;target_assignment_id:number;
 snapshot:{secondSwap?:{source:Assignment;target:Assignment}}})=>[change.assignment_id,change.target_assignment_id,
 ...(change.snapshot.secondSwap?[change.snapshot.secondSwap.source.assignment_id,change.snapshot.secondSwap.target.assignment_id]:[])];
@Injectable()
export class RequestsService {
 constructor(@Inject(Database) private readonly db:Database,@Inject(SchedulesService) private readonly schedules:SchedulesService,@Inject(ValidationService) private readonly validation:ValidationService,@Inject(SwapQuotaService) private readonly quota:SwapQuotaService) {}
 async createLeave(actor:Actor,input:LeaveInput,key:string) {
  if(!['EMPLOYEE','SUPERVISOR'].includes(actor.role))this.denied();
  if(!await this.schedules.leaveEnabled())throw new NotFoundException({code:'LEAVE_UNAVAILABLE',message:'ยังไม่เปิดรับคำขอลา'});
  const reason=leaveReason(input.reason);
  if(!reason||reason.length>1000||typeof input.leaveCode!=='string'||!['V','S','B','VG'].includes(input.leaveCode))
   throw new BadRequestException({code:'INVALID_LEAVE',message:'กรุณาระบุประเภทและเหตุผลการลาไม่เกิน 1,000 ตัวอักษร'});
  return this.createRosterRequest(actor,input,key,{kind:'leave',code:input.leaveCode,reason,cover:input.cover});
 }
 private async requireOT(actor:Actor,code:unknown):Promise<OTCode> {
  if(!['EMPLOYEE','SUPERVISOR'].includes(actor.role))this.denied();
  if(!await this.schedules.otEnabled())throw new NotFoundException({code:'OT_UNAVAILABLE',message:'ยังไม่เปิดรับคำขอทำงานล่วงเวลา'});
  if(code!=='MT'&&code!=='NT')throw new BadRequestException({code:'INVALID_OT',message:'เลือก OT กะเช้า (MT) หรือ OT กะดึก (NT)'});
  return code;
 }
 async createOT(actor:Actor,input:OTInput,key:string) {
  const code=await this.requireOT(actor,input.otCode);
  return this.createRosterRequest(actor,input,key,{kind:'ot',code,cover:null});
 }
 async validateOT(actor:Actor,input:OTInput) {
  const code=await this.requireOT(actor,input.otCode);
  return this.db.transaction(async c=>{
   const [slot]=await this.schedules.pair(c,[input.assignmentId]);
   this.requireRosterSubmissionSlot(actor,slot,input.assignmentVersion);
   this.requireOTDayOff(slot);
   await this.requirePublishedRoster(c,slot);
   const now=new Date();
   requireOpenSubmission(slot.work_date,now,'ot');
   this.schedules.requireWritable([],[slot.work_date],now);
   await this.requireFreeAssignments(c,[slot.assignment_id],now,true);
   const [replacement]=await this.rosterReplacements(c,[slot],false,code);
   if(!leaveShiftStart(slot.work_date,replacement.start_time))throw new ConflictException({code:'SHIFT_START_UNAVAILABLE',message:'ยังไม่มีเวลาเริ่มกะสำหรับวันที่เลือก'});
   return this.validation.checkOT(c,replacement);
  });
 }
 private requireRosterSubmissionSlot(actor:Actor,slot:Assignment|undefined,version:number):asserts slot is Assignment {
  if(!slot||slot.employee_id!==actor.employeeId||actor.role!==leaveRole(slot))this.denied();
  this.demoScope(slot);
  if(slot.version!==version)throw leaveChanged();
 }
 private requireOTDayOff(slot:Assignment) {
  if(slot.is_working||!['O','-'].includes(slot.shift_code)||slot.status!=='ACTIVE')
   throw new BadRequestException({code:'OT_DAY_OFF_REQUIRED',message:'ยื่นขอ OT ได้เฉพาะวันหยุดของคุณ'});
 }
 private async requirePublishedRoster(c:PoolClient,slot:Assignment,lock=false) {
  const scheduled=(await c.query(`SELECT status FROM schedules WHERE schedule_id=$1${lock?' FOR UPDATE':''}`,[slot.schedule_id])).rows[0];
  if(scheduled?.status!=='PUBLISHED')throw new ConflictException({code:'SCHEDULE_UNAVAILABLE',message:'ตารางกะยังไม่ประกาศใช้'});
 }
 private async createRosterRequest(actor:Actor,input:AssignmentInput,key:string,detail:RosterRequestDetail) {
  const ot=detail.kind==='ot';
  const type=ot?'OT':'LEAVE';
  const {cover}=detail;
  // Keep the payload for existing leave receipts stable across upgrades.
  const receipt=detail.kind==='leave'
   ? {action:'CREATE_LEAVE',assignmentId:input.assignmentId,assignmentVersion:input.assignmentVersion,cover,leaveCode:detail.code,reason:detail.reason}
   : {action:'CREATE_OT',assignmentId:input.assignmentId,assignmentVersion:input.assignmentVersion,otCode:detail.code};
  return this.operation(actor,key,receipt,async(c,beforeCommit)=>{
   const ids=[input.assignmentId,...(cover?[cover.id]:[])];
   const initial=await this.schedules.pair(c,ids);
   const live=await this.lockAssignments(c,ids,initial.map(slot=>slot.employee_id));
   const a=live.find(slot=>slot.assignment_id===input.assignmentId);
   const b=live.find(slot=>slot.assignment_id===cover?.id)??null;
   this.requireRosterSubmissionSlot(actor,a,input.assignmentVersion);
   if(b)this.demoScope(b);
   if(cover&&(!b||cover.version!==b.version))throw leaveChanged();
   if(ot)this.requireOTDayOff(a);
   if(!ot&&(!a.is_working||a.status!=='ACTIVE'||(b&&(b.status!=='ACTIVE'||b.work_date!==a.work_date||!leaveCoverShift(a,b)))))
    throw new BadRequestException({code:'INVALID_LEAVE_ASSIGNMENTS',message:'เลือกกะทำงานของคุณและผู้ทำแทนต่างทีมที่หยุดอยู่ในวันนั้น'});
   await this.requirePublishedRoster(c,a,true);
   const now=new Date();
   requireOpenSubmission(a.work_date,now,detail.kind);
   const shift=ot?(await c.query('SELECT start_time FROM shift_types WHERE shift_code=$1 AND is_active AND is_working',[detail.code])).rows[0]:a;
   const start=leaveShiftStart(a.work_date,shift?.start_time??null);
   if(!start)throw new ConflictException({code:'SHIFT_START_UNAVAILABLE',message:'ยังไม่มีเวลาเริ่มกะสำหรับวันที่เลือก'});
   this.schedules.requireWritable([],[a.work_date],now);
   const deadline=requestApprovalDeadline(a.work_date,now);
   const check=()=>{
    const checked=new Date();
    requireOpenApproval(a.work_date,now,checked,detail.kind);
    this.schedules.requireWritable([],[a.work_date],checked);
   };
   await this.requireFreeAssignments(c,ids,now,true);
   await this.leaveReplacements(c,b?[a,b]:[a],false,ot?detail.code:null);
   const approvers=await this.approversFor(c,a,b,actor.role==='SUPERVISOR');
   const {rows:[row]}=await c.query("INSERT INTO requests(requester_id,request_type,status,submitted_at) VALUES($1,$2,'PENDING',$3) RETURNING request_id",[actor.employeeId,type,now]);
   const requestId=row.request_id;
   if(ot)await c.query(`INSERT INTO shiftflow_policy.leave_requests(request_id,assignment_id,source_snapshot,ot_code,shift_starts_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6)`,[requestId,a.assignment_id,a,detail.code,start,deadline]);
   else await c.query(`INSERT INTO shiftflow_policy.leave_requests
    (request_id,assignment_id,cover_assignment_id,cover_employee_id,source_snapshot,cover_snapshot,leave_code,reason,shift_starts_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[requestId,a.assignment_id,b?.assignment_id,b?.employee_id,a,b,detail.code,detail.reason,start,deadline]);
   for(const [index,userId] of approvers.entries()) {
    await c.query("INSERT INTO approvals(request_id,approver_id,approver_level,status) VALUES($1,$2,$3,'PENDING')",[requestId,userId,index+1]);
    await this.notify(c,userId,requestId,'มีคำขอใหม่','เปิดรายการคำขอเพื่อตรวจสอบ');
   }
   if(b)await this.notifyLeaveParties(c,requestId,[b.employee_id],'มีคำขอที่เกี่ยวข้องกับคุณ');
   await this.audit(c,actor,'REQUEST_SUBMITTED',requestId,null,{status:'PENDING',requestVersion:1});
   beforeCommit(check);
   return {requestId,status:'PENDING',version:1};
  });
 }
 private async notifyLeaveParties(c:PoolClient,requestId:number,employees:number[],title:string) {
  const {rows}=await c.query('SELECT user_id FROM users WHERE employee_id=ANY($1::int[]) AND is_active',[employees]);
  for(const user of rows)await this.notify(c,user.user_id,requestId,title,'เปิดรายการคำขอเพื่อดูข้อมูลตามสิทธิ์');
 }
 private async requireFreeAssignments(
  c:PoolClient,ids:number[],checkedAt:Date,includeLeave:boolean,excludeRequestId?:number,
 ) {
  const [conflict]=await rosterRequestConflicts(c,ids,checkedAt,includeLeave,excludeRequestId);
  if(conflict?.status==='APPROVED') {
   throw new ConflictException({code:'APPROVED_REQUEST',message:'กะที่เลือกมีคำขอที่อนุมัติแล้ว กรุณายกเลิกคำขอเดิมและคืนกะก่อน'});
  }
  if(conflict?.status==='PENDING') {
   throw new ConflictException({code:'PENDING_REQUEST',message:'กะที่เลือกมีคำขอรออนุมัติอยู่ กรุณายกเลิกคำขอเดิมก่อนยื่นใหม่'});
  }
 }
 private async leaveRow(c:PoolClient,request:any):Promise<LeaveRow> {
  const {rows:[leave]}=await c.query('SELECT * FROM shiftflow_policy.leave_requests WHERE request_id=$1',[request.request_id]);
  if(!leave)throw new NotFoundException({code:'NOT_FOUND',message:'ไม่พบคำขอ'});
  return {...request,...leave};
 }
 private async leaveRoster(c:PoolClient,request:LeaveRow,reversing:boolean) {
  const slots=leaveSlots(request);
  const live=await this.lockAssignments(c,slots.map(a=>a.assignment_id),slots.map(a=>a.employee_id));
  const ordered=slots.map(a=>live.find(b=>b.assignment_id===a.assignment_id));
  const restored=reversing?await restoredRosterVersions(c,live):null;
  if(ordered.some((a,i)=>{
   const expectedVersion=slots[i].version+Number(reversing);
   return !a||(a.version!==expectedVersion&&restored?.get(a.assignment_id)!==expectedVersion)
    ||a.team_id!==slots[i].team_id||a.position!==slots[i].position||a.status!=='ACTIVE';
  }))throw leaveChanged();
  const [source,cover]=slots;
  const codes=[request.ot_code??'L',...(cover?[leaveCoverShift(source,cover)]:[])];
  if(reversing&&ordered.some((a,i)=>a?.shift_code!==codes[i]))throw leaveChanged();
  const replacements=await this.leaveReplacements(c,slots,reversing,request.ot_code);
  const workDates=slots.map(s=>s.work_date);
  const scheduleIds=[...new Set(slots.map(s=>s.schedule_id))];
  const periods=(await c.query('SELECT year,month FROM schedules WHERE schedule_id=ANY($1::int[]) ORDER BY schedule_id FOR UPDATE',[scheduleIds])).rows;
  this.schedules.requireWritable(periods,workDates,new Date());
  return {before:ordered as Assignment[],after:replacements,scheduleIds,periods,workDates};
 }
 private async leaveReplacements(c:PoolClient,slots:Assignment[],reversing:boolean,otCode?:OTCode|null) {
  const replacements=await this.rosterReplacements(c,slots,reversing,otCode);
  const conflict=await this.validation.rosterConflict(c,replacements);
  if(conflict)throw new ConflictException({code:otCode?'OT_ROSTER_INVALID':'LEAVE_ROSTER_INVALID',message:conflict});
  return replacements;
 }
 private async rosterReplacements(c:PoolClient,slots:Assignment[],reversing:boolean,otCode?:OTCode|null) {
  const [source,cover]=slots;
  const codes=[otCode??'L',...(cover?[leaveCoverShift(source,cover)]:[])];
  const types=reversing?slots:(await c.query('SELECT * FROM shift_types WHERE is_active AND shift_code=ANY($1::text[])',[codes])).rows;
  return slots.map((slot,i)=>{
   const shift=reversing?slots[i]:types.find(type=>type.shift_code===codes[i]);
   if(!shift)throw leaveChanged();
   return {...slot,shift_code:shift.shift_code,shift_type_id:shift.shift_type_id,shift_name:shift.shift_name,
    is_working:shift.is_working,start_time:shift.start_time,end_time:shift.end_time};
  });
 }
 private async writeLeaveRoster(c:PoolClient,actor:Actor,request:LeaveRow,roster:Awaited<ReturnType<RequestsService['leaveRoster']>>,reversing:boolean) {
  for(const slot of roster.after)await c.query('UPDATE shift_assignments SET shift_type_id=$1,assigned_by=$2,version=version+1,updated_at=now() WHERE assignment_id=$3',
   [slot.shift_type_id,reversing?(slot as Assignment&{assigned_by:number}).assigned_by:actor.userId,slot.assignment_id]);
  await c.query('UPDATE schedules SET version=version+1,updated_at=now() WHERE schedule_id=ANY($1::int[])',[roster.scheduleIds]);
  const evidence=({employee_id,work_date,shift_code}:Assignment)=>({employee_id,work_date,shift_code});
  const after=roster.after.map((slot,index)=>reversing?{
   ...evidence(slot),assignment_id:slot.assignment_id,shift_type_id:slot.shift_type_id,
   restoredFromVersion:slot.version,version:roster.before[index].version+1,
  }:evidence(slot));
  await this.audit(c,actor,`SCHEDULE_${request.ot_code?'OT':'LEAVE'}_${reversing?'REVERSED':'APPLIED'}`,request.request_id,
   {assignments:roster.before.map(evidence)},{assignments:after});
 }
 private async decideLeave(c:PoolClient,actor:Actor,request:LeaveRow,input:DecisionInput,approvals:ApprovalStep[],beforeCommit:(check:()=>void)=>void) {
  const step=approvals.find(item=>item.approver_id===actor.userId&&item.status==='PENDING');
  if(!step||actor.role!==(leaveRole(request.source_snapshot)==='SUPERVISOR'?'MANAGER':'SUPERVISOR'))this.denied();
  if(request.status!=='PENDING')throw new ConflictException({code:'REQUEST_CLOSED',message:'คำขอนี้สิ้นสุดแล้ว'});
  requireOpenLeave(request,new Date());
  if(actor.role==='SUPERVISOR'&&await this.approverTeam(c,actor)!==leaveSlots(request)[step.approver_level-1]?.team_id)this.denied();
  const otherApproved=approvals.length===2&&input.expectedVersion===1&&request.version===2
   &&approvals.some(item=>item.approver_id!==actor.userId&&item.status==='APPROVED'&&item.request_version===1);
  if(request.version!==input.expectedVersion&&!otherApproved)throw new ConflictException({code:'VERSION_CONFLICT',message:'กรุณาโหลดคำขอล่าสุด'});
  const reject=input.decision==='REJECT';
  if(reject&&!input.reason.trim())throw new BadRequestException({code:'INVALID_REASON',message:'กรุณาระบุเหตุผลที่ไม่อนุมัติ'});
  const status=reject?'REJECTED':approvals.every(item=>item===step||item.status==='APPROVED')?'APPROVED':'PENDING';
  const roster=reject?null:await this.leaveRoster(c,request,false);
  if(status==='APPROVED'&&roster) {
   await this.requireFreeAssignments(c,leaveSlots(request).map(slot=>slot.assignment_id),new Date(),true,request.request_id);
   await this.writeLeaveRoster(c,actor,request,roster,false);
  }
  const now=new Date();
  await c.query('UPDATE approvals SET status=$1,request_version=$2,approved_at=$3,comment=$5 WHERE approval_id=$4',[reject?'REJECTED':'APPROVED',input.expectedVersion,now,step.approval_id,request.ot_code&&reject?input.reason:null]);
  await this.finishLeave(c,request,status,now,!request.ot_code&&reject?input.reason:null);
  await this.audit(c,actor,reject?'REQUEST_REJECTED':'REQUEST_APPROVED',request.request_id,{status:'PENDING'},
   {status,requestVersion:request.version+1,approvedRequestVersion:input.expectedVersion,level:step.approver_level});
  await this.notifyLeaveParties(c,request.request_id,leaveSlots(request).map(slot=>slot.employee_id),'สถานะคำขอเปลี่ยนแปลง');
  beforeCommit(()=>{
   const checked=new Date();
   requireOpenLeave(request,checked);
   this.schedules.requireWritable(roster?.periods??[],[request.source_snapshot.work_date],checked);
  });
  return {requestId:request.request_id,status,version:request.version+1};
 }
 private async finishLeave(c:PoolClient,request:LeaveRow,status:string,now:Date,rejectionReason:string|null=null) {
  await c.query('UPDATE requests SET status=$1,version=version+1,updated_at=$2 WHERE request_id=$3',[status,now,request.request_id]);
  if(status!=='PENDING')await c.query('UPDATE shiftflow_policy.leave_requests SET finished_at=$1,rejection_reason=$2 WHERE request_id=$3',
   [now,rejectionReason,request.request_id]);
 }
 private async cancelLeave(c:PoolClient,actor:Actor,request:LeaveRow,expectedVersion:number,beforeCommit:(check:()=>void)=>void) {
  if(request.version!==expectedVersion)throw new ConflictException({code:'VERSION_CONFLICT',message:'กรุณาโหลดคำขอล่าสุด'});
  if(!['PENDING','APPROVED'].includes(request.status))throw leaveExpired();
  const approved=request.status==='APPROVED';
  const checkDeadline=(now:Date)=>{
   if(!approved)requireOpenLeave(request,now);
   else if(now>=request.shift_starts_at) {
    if(!request.ot_code)throw leaveExpired();
    throw new ConflictException({code:'CANCELLATION_CLOSED',message:'กะ OT เริ่มแล้ว จึงยกเลิกไม่ได้'});
   }
  };
  checkDeadline(new Date());
  if(!approved&&(await c.query("SELECT 1 FROM approvals WHERE request_id=$1 AND status<>'PENDING'",[request.request_id])).rowCount)
   throw new ConflictException({code:'CANCELLATION_CLOSED',message:'คำขอผ่านการตรวจแล้ว'});
  const roster=approved?await this.leaveRoster(c,request,true):null;
  if(roster)await this.writeLeaveRoster(c,actor,request,roster,true);
  await this.finishLeave(c,request,'CANCELLED',new Date());
  await this.audit(c,actor,'REQUEST_CANCELLED',request.request_id,{status:request.status},{status:'CANCELLED',requestVersion:request.version+1});
  await this.notifyLeaveParties(c,request.request_id,leaveSlots(request).map(slot=>slot.employee_id),'คำขอถูกยกเลิก');
  beforeCommit(()=>{
   const checked=new Date();
   checkDeadline(checked);
   this.schedules.requireWritable(roster?.periods??[],[request.source_snapshot.work_date],checked);
  });
  return {requestId:request.request_id,status:'CANCELLED',version:request.version+1};
 }
 async candidates(actor:Actor,assignmentId:number) {
  return this.db.transaction(async c=>{
   const a=(await this.schedules.pair(c,[assignmentId]))[0];
   if(!a||!this.canSubmit(actor,a)) this.denied();
   this.demoScope(a);
   const rows=(await c.query(`${this.schedules.assignmentSelect()} WHERE a.work_date=$1 AND t.team_id<>$2 AND e.position=$3 AND t.team_code IN ('A','B','C','D') AND a.status='ACTIVE' AND st.is_active AND t.is_active ORDER BY t.team_id,e.employee_id`,[a.work_date,a.team_id,a.position])).rows;
   const candidates=[];
   for(const b of rows) candidates.push({...b,validation:await this.validation.check(c,actor,a,b)});
   return {assignment:a,candidates};
  });
 }
 async validate(actor:Actor,input:SwapInput) {
  const leaveEnabled=await this.schedules.leaveEnabled();
  return this.db.transaction(async c=>{
   const pairs=await this.getPairs(c,actor,input,false);
   this.checkVersions(pairs,input);
   const validation=await this.validation.checkPairs(c,actor,pairs);
   const source=pairs[0][0];
   const quotaMonth=this.quota.localPilotMonth(source.work_date);
   if(validation.valid) {
    const checkedAt=new Date();
    this.schedules.requireWritable([],pairs.flat().map(slot=>slot.work_date),checkedAt);
    if(quotaMonth) this.checkSubmissionDates(pairs,checkedAt);
    await this.requireFreeAssignments(c,pairs.flat().map(slot=>slot.assignment_id),checkedAt,leaveEnabled);
   }
   if(!quotaMonth) return validation;
   const checks=validation.checks.filter(check=>check.rule!=='SWAP_QUOTA'&&check.rule!=='REQUEST_WINDOW');
   if(validation.valid) checks.push({
    rule:'REQUEST_WINDOW',label:'ช่วงเวลายื่นคำขอ',status:'PASS',
    message:'เลือกวันสลับได้ตั้งแต่วันนี้ถึงวันสุดท้ายของเดือนนี้ตามเวลาไทย ยื่นได้แม้กะของวันนี้เริ่มแล้ว ยื่นย้อนหลังหรือข้ามเดือนไม่ได้'
   });
   const quota=await this.quota.readRequesterQuota(c,source.employee_id,quotaMonth);
   return {...validation,checks,quota};
  });
 }
 async create(actor:Actor,input:SwapInput,key:string) {
  if(!['EMPLOYEE','SUPERVISOR'].includes(actor.role)) this.denied();
  const leaveEnabled=await this.schedules.leaveEnabled();
  return this.operation(actor,key,{action:'CREATE',...input},async (c,beforeCommit)=>{
   const pairs=await this.getPairs(c,actor,input,true);
   const [a,b]=pairs[0];
   this.checkVersions(pairs,input);
   const result=await this.validation.checkPairs(c,actor,pairs);
   if(!result.valid) throw new BadRequestException({code:'VALIDATION_FAILED',message:'คำขอไม่ผ่านเงื่อนไข กรุณาตรวจรายการที่ระบุ',validation:result});
   const quotaMonth=this.quota.localPilotMonth(a.work_date);
   const checkedAt=new Date();
   const workDates=pairs.flat().map(slot=>slot.work_date);
   this.schedules.requireWritable([],workDates,checkedAt);
   if(quotaMonth) this.checkSubmissionDates(pairs,checkedAt);
   const assignmentIds=pairs.flat().map(slot=>slot.assignment_id);
   await this.requireFreeAssignments(c,assignmentIds,checkedAt,leaveEnabled);
   const needsManager=actor.role==='SUPERVISOR';
   const approvers=await this.approversFor(c,a,b,needsManager,pairs[1]?.[0].work_date);
   const submittedAt=new Date();
   if(quotaMonth) this.checkSubmissionDates(pairs,submittedAt);
   const {rows:[created]}=quotaMonth
    ? await c.query("INSERT INTO requests(requester_id,request_type,status,quota_month,submitted_at,created_at) VALUES($1,'SWAP','PENDING',$2,$3,$3) RETURNING request_id",[actor.employeeId,quotaMonth,submittedAt])
    : await c.query("INSERT INTO requests(requester_id,request_type,status) VALUES($1,'SWAP','PENDING') RETURNING request_id",[actor.employeeId]);
   const requestId=created.request_id;
   const approvalRoute=needsManager?'MANAGER':quotaMonth?'TWO_SUPERVISORS':null;
   const second=pairs[1];
   const snapshot={source:a,target:b,validation:result,requestVersion:1,...(approvalRoute?{approvalRoute}:{}),
    ...(second?{secondSwap:{source:second[0],target:second[1]}}:{})};
   await c.query('INSERT INTO change_requests(request_id,assignment_id,target_employee_id,target_assignment_id,snapshot) VALUES($1,$2,$3,$4,$5)',[requestId,a.assignment_id,b.employee_id,b.assignment_id,JSON.stringify(snapshot)]);
   for(let i=0;i<approvers.length;i++) await c.query("INSERT INTO approvals(request_id,approver_id,approver_level,status) VALUES($1,$2,$3,'PENDING')",[requestId,approvers[i],i+1]);
   await this.audit(c,actor,'REQUEST_SUBMITTED',requestId,null,{snapshot,status:'PENDING',requestVersion:1});
   for(const approverId of parallelApprovals(snapshot)?approvers:approvers.slice(0,1)) {
    await this.notify(c,approverId,requestId,'คำขอสลับกะใหม่','มีคำขอที่ต้องตรวจสอบและอนุมัติ');
   }
   beforeCommit(()=>this.schedules.requireWritable([],workDates,new Date()));
   return {requestId,status:'PENDING',version:1};
  });
 }
 async decision(actor:Actor,requestId:number,input:DecisionInput,key:string) {
  if(!['SUPERVISOR','MANAGER'].includes(actor.role)) this.denied();
  const leaveEnabled=await this.schedules.leaveEnabled();
  return this.operation(actor,key,{action:'DECISION',requestId,...input},async (c,beforeCommit)=>{
   const request=(await c.query('SELECT * FROM requests WHERE request_id=$1 FOR UPDATE',[requestId])).rows[0];
   if(!request) throw new NotFoundException({code:'NOT_FOUND',message:'ไม่พบคำขอ'});
   const approvals=(await c.query<ApprovalStep>('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[requestId])).rows;
   if(!approvals.some(a=>a.approver_id===actor.userId)) this.denied();
   if(['LEAVE','OT'].includes(request.request_type))return this.decideLeave(c,actor,await this.leaveRow(c,request),input,approvals,beforeCommit);
   const change=(await c.query('SELECT * FROM change_requests WHERE request_id=$1',[requestId])).rows[0];
   const needsManager=managerApproval(change.snapshot);
   const parallel=parallelApprovals(change.snapshot);
   if(actor.role!==(needsManager?'MANAGER':'SUPERVISOR')) this.denied();
   if(!validApprovalSteps(approvals,needsManager))throw new ConflictException({code:'APPROVER_UNRESOLVED',message:'คำขอนี้มีขั้นอนุมัติไม่ครบ กรุณาเริ่มคำขอใหม่'});
   if(request.status!=='PENDING') throw new ConflictException({code:'REQUEST_CLOSED',message:'คำขอนี้สิ้นสุดแล้ว ไม่สามารถตัดสินซ้ำ'});
   // Both approvers may open the original, immutable request before either acts.
   // Accept its original version only if the other approval was the sole change.
   const otherApprovedOriginal=parallel&&request.version===2&&input.expectedVersion===1&&change.snapshot.requestVersion===1
    &&approvals.some(a=>a.approver_id!==actor.userId&&a.status==='APPROVED'&&a.request_version===1);
   if(request.version!==input.expectedVersion&&!otherApprovedOriginal) throw new ConflictException({code:'VERSION_CONFLICT',message:'คำขอมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุด'});
   const step=pendingStep(approvals,actor.userId,parallel);
   if(!step||step.approver_id!==actor.userId) this.denied();
   requireOpenApproval(request.quota_month,request.submitted_at,new Date());
   if(input.decision==='APPROVE'&&invalidCrossDate(change.snapshot)) {
    throw new ConflictException({code:'CROSS_DATE_RESUBMISSION_REQUIRED',message:crossDateApprovalBlocked});
   }
   const snapshotTeams=(await c.query('SELECT team_id,team_code FROM teams WHERE team_id=ANY($1::int[])',[[change.snapshot.source.team_id,change.snapshot.target.team_id]])).rows;
   for(const side of ['source','target']) {
    const team=snapshotTeams.find(t=>t.team_id===change.snapshot[side].team_id);
    if(!team||!demoTeam(team.team_code))throw new ForbiddenException({code:'DEMO_SCOPE',message:'เดโมนี้ทดลองสลับข้ามทีม A–D เท่านั้น'});
   }
   const original=change.snapshot;
   const second=original.secondSwap;
   const stored:SwapInput={assignmentId:change.assignment_id,targetAssignmentId:change.target_assignment_id,
    assignmentVersion:original.source.version,targetVersion:original.target.version,
    ...(second?{secondSwap:{assignmentId:second.source.assignment_id,targetAssignmentId:second.target.assignment_id,
      assignmentVersion:second.source.version,targetVersion:second.target.version}}:{})};
   const pairs=await this.getPairs(c,actor,stored,true,false);
   const [a,b]=pairs[0];
   const workDates=pairs.flat().map(slot=>slot.work_date);
   this.schedules.requireWritable([],workDates,new Date());
   if(input.decision==='APPROVE'&&request.quota_month===null&&this.quota.localPilotEnabled()) {
    throw new ConflictException({code:'SWAP_POLICY_RESUBMISSION_REQUIRED',message:legacyApprovalBlocked});
   }
   const snapshots=[original,second];
   if(pairs.some(([source,target],index)=>{
    const previous=snapshots[index];
    return source.employee_id!==previous.source.employee_id||target.employee_id!==previous.target.employee_id
     ||source.team_id!==previous.source.team_id||target.team_id!==previous.target.team_id;
   })) {
    throw new ConflictException({code:'SWAP_PARTICIPANTS_CHANGED',message:'ผู้เกี่ยวข้องหรือทีมเปลี่ยนไป กรุณาสร้างคำขอใหม่'});
   }
   if(!needsManager&&(await this.approverTeam(c,actor))!==(step.approver_level===1?a.team_id:b.team_id)) this.denied();
   if(needsManager&&pairs.flat().some(slot=>slot.position!=='SUPERVISOR')) {
    throw new ConflictException({code:'VALIDATION_CHANGED',message:'ตำแหน่งของคู่สลับเปลี่ยนไป กรุณาสร้างคำขอใหม่'});
   }
   this.checkVersions(pairs,stored);
   if(input.decision==='REJECT'&&!input.reason) throw new BadRequestException({code:'REASON_REQUIRED',message:'กรุณาระบุเหตุผลที่ไม่อนุมัติ'});
   const validation=input.decision==='APPROVE'?await this.validation.checkPairs(c,actor,pairs,false):null;
   if(validation&&!validation.valid) {
    const shortRest=validation.checks.find(check=>check.status==='FAIL'&&check.rule.startsWith('MIN_SHIFT_REST_'));
    const message=shortRest
     ? `${shortRest.employeeName} ${shortRest.message}`
     : 'ตารางปัจจุบันไม่ผ่านเงื่อนไข กรุณาสร้างคำขอใหม่';
    throw new ConflictException({code:'VALIDATION_CHANGED',message,validation});
   }
   const status=input.decision==='APPROVE'?'APPROVED':'REJECTED';
   const final=input.decision==='APPROVE'&&approvals.every(a=>a.approval_id===step.approval_id||a.status==='APPROVED');
   const newStatus=input.decision==='REJECT'?'REJECTED':final?'APPROVED':'PENDING';
   let quota;
   const scheduleIds=[...new Set(pairs.flat().map(slot=>slot.schedule_id))];
   let lockedPeriods:{year:number;month:number}[]=[];
   if(final) {
    // The employee advisory locks cover all adjacent-day reads; row locks protect both assignments.
    lockedPeriods=(await c.query<{year:number;month:number}>('SELECT year,month FROM schedules WHERE schedule_id=ANY($1::int[]) ORDER BY schedule_id FOR UPDATE',[scheduleIds])).rows;
    this.schedules.requireWritable(lockedPeriods,workDates,new Date());
    await this.requireFreeAssignments(c,pairs.flat().map(slot=>slot.assignment_id),new Date(),leaveEnabled,requestId);
    if(request.quota_month) {
     if(a.employee_id!==request.requester_id) throw new ConflictException({code:'REQUESTER_CHANGED',message:'เจ้าของกะไม่ตรงกับผู้ยื่นคำขอ'});
     quota=await this.quota.requireAvailableSlot(c,request.requester_id,request.quota_month);
    }
   }
   const decidedAt=new Date();
   requireOpenApproval(request.quota_month,request.submitted_at,decidedAt);
   await c.query('UPDATE approvals SET status=$1,comment=$2,approved_at=COALESCE($5::timestamptz,now()),request_version=$3 WHERE approval_id=$4',[status,input.reason||null,input.expectedVersion,step.approval_id,request.quota_month?decidedAt:null]);
   if(final) {
    for(const [source,target] of pairs) for(const [own,incoming] of [[source,target],[target,source]]) {
     await c.query('UPDATE shift_assignments SET shift_type_id=$1,assigned_by=$2,version=version+1,updated_at=now() WHERE assignment_id=$3',[incoming.shift_type_id,actor.userId,own.assignment_id]);
    }
    await c.query('UPDATE schedules SET version=version+1,updated_at=now() WHERE schedule_id=ANY($1::int[])',[scheduleIds]);
    const after=(own:Assignment,incoming:Assignment)=>({...own,shift_type_id:incoming.shift_type_id,shift_code:incoming.shift_code,shift_name:incoming.shift_name,is_working:incoming.is_working,start_time:incoming.start_time,end_time:incoming.end_time,assigned_by:actor.userId,version:own.version+1});
    const extra=pairs[1];
    await this.audit(c,actor,'SCHEDULE_SWAP_APPLIED',requestId,
     {source:a,target:b,...(extra?{secondSwap:{source:extra[0],target:extra[1]}}:{})},
     {source:after(a,b),target:after(b,a),requestVersion:request.version,validation,...(quota?{quota}:{}),
      ...(extra?{secondSwap:{source:after(extra[0],extra[1]),target:after(extra[1],extra[0])}}:{})});
   }
   await c.query('UPDATE requests SET status=$1,version=version+1,updated_at=now() WHERE request_id=$2',[newStatus,requestId]);
   await this.audit(c,actor,`REQUEST_${status}`,requestId,{status:request.status,requestVersion:request.version},{status:newStatus,requestVersion:request.version+1,approvedRequestVersion:input.expectedVersion,originalPayloadVersion:1,level:step.approver_level,reason:input.reason||null});
   if(!final&&input.decision==='APPROVE'&&!parallel) await this.notify(c,approvals[step.approver_level].approver_id,requestId,'คำขอรอการอนุมัติของคุณ','หัวหน้าทีมผู้ขออนุมัติแล้ว กรุณาตรวจสอบคำขอ');
   const recipients=(await c.query('SELECT user_id FROM users WHERE employee_id=ANY($1::int[]) AND is_active',[[a.employee_id,b.employee_id]])).rows;
   for(const user of recipients) await this.notify(c,user.user_id,requestId,newStatus==='APPROVED'?'สลับกะเรียบร้อย':newStatus==='REJECTED'?'คำขอไม่อนุมัติ':'ผ่านการอนุมัติฝ่ายแรก','เปิดคำขอเพื่อดูสถานะและรายละเอียดที่อนุญาต');
   // Recheck after writing the receipt so even a delayed final write rolls back.
   beforeCommit(()=>{
    const checkedAt=new Date();
    requireOpenApproval(request.quota_month,request.submitted_at,checkedAt);
    this.schedules.requireWritable(lockedPeriods,workDates,checkedAt);
   });
   return {requestId,status:newStatus,version:request.version+1};
  });
 }
 async cancel(actor:Actor,requestId:number,expectedVersion:number,key:string) {
  if(!['EMPLOYEE','SUPERVISOR'].includes(actor.role))this.denied();
  return this.operation(actor,key,{action:'CANCEL',requestId,expectedVersion},async (c,beforeCommit)=>{
   // Decisions acquire this same row lock before reading/updating approval steps.
   const request=(await c.query('SELECT * FROM requests WHERE request_id=$1 FOR UPDATE',[requestId])).rows[0];
   if(!request)throw new NotFoundException({code:'NOT_FOUND',message:'ไม่พบคำขอ'});
   if(request.requester_id!==actor.employeeId)this.denied();
   if(['LEAVE','OT'].includes(request.request_type))return this.cancelLeave(c,actor,await this.leaveRow(c,request),expectedVersion,beforeCommit);
   if(request.status==='APPROVED'&&request.request_type==='SWAP'&&request.quota_month) {
    if(request.version!==expectedVersion)throw new ConflictException({code:'VERSION_CONFLICT',message:'คำขอมีการเปลี่ยนแปลง กรุณาโหลดสถานะล่าสุด'});
    return this.cancelApprovedSwap(c,actor,request,beforeCommit);
   }
   if(actor.role!=='EMPLOYEE')this.denied();
   if(request.status!=='PENDING')throw new ConflictException({code:'REQUEST_CLOSED',message:'คำขอนี้สิ้นสุดแล้ว กรุณาโหลดสถานะล่าสุด'});
   requireOpenApproval(request.quota_month,request.submitted_at,new Date());
   if(request.version!==expectedVersion)throw new ConflictException({code:'VERSION_CONFLICT',message:'คำขอมีการเปลี่ยนแปลง กรุณาโหลดสถานะล่าสุด'});
   const approvals=(await c.query('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[requestId])).rows;
   if(approvals.some(step=>step.status!=='PENDING'))throw new ConflictException({code:'CANCELLATION_CLOSED',message:'หัวหน้าบันทึกคำตัดสินแล้ว จึงยกเลิกคำขอนี้ไม่ได้ กรุณาโหลดสถานะล่าสุด'});
   const change=(await c.query('SELECT * FROM change_requests WHERE request_id=$1',[requestId])).rows[0];
   const workDates=rosterDates(change.snapshot);
   this.schedules.requireWritable([],workDates,new Date());
   beforeCommit(()=>{
    const checkedAt=new Date();
    requireOpenApproval(request.quota_month,request.submitted_at,checkedAt);
    this.schedules.requireWritable([],workDates,checkedAt);
   });
   await c.query("UPDATE requests SET status='CANCELLED',version=version+1,updated_at=now() WHERE request_id=$1",[requestId]);
   await this.audit(c,actor,'REQUEST_CANCELLED',requestId,{status:request.status,requestVersion:request.version},{status:'CANCELLED',requestVersion:request.version+1,workDate:change.snapshot.source.work_date,assignmentId:change.assignment_id,targetAssignmentId:change.target_assignment_id});
   if(approvals[0])await this.notify(c,approvals[0].approver_id,requestId,'คำขอถูกยกเลิก','ผู้ยื่นยกเลิกคำขอก่อนมีคำตัดสิน ตารางกะยังคงเดิม');
   return {requestId,status:'CANCELLED',version:request.version+1};
  });
 }
 private async cancelApprovedSwap(c:PoolClient,actor:Actor,
  request:{request_id:number;requester_id:number;quota_month:string;version:number},beforeCommit:(check:()=>void)=>void) {
  const requestId=request.request_id;
  const {rows:[change]}=await c.query('SELECT * FROM change_requests WHERE request_id=$1',[requestId]);
  const {rows:[applied]}=await c.query<{evidence:AppliedSwapEvidence}>(appliedSwapEvidence('$1'),[requestId]);
  const ids=change?cancellationAssignmentIds(change):[];
  const plan=cancellationPlan(applied?.evidence??null,request.quota_month,request.requester_id,ids);
  if(plan.issue)throw new ConflictException(plan.issue);

  const workDates=plan.changes.map(({before})=>before.work_date);
  const checkDeadline=()=>{
   const issue=cancellationDeadlineIssue(plan.deadline,new Date());
   if(issue)throw new ConflictException(issue);
  };
  this.schedules.requireWritable([],workDates,new Date());
  checkDeadline();
  // Keep the same employee -> assignment -> schedule lock order used by final approval.
  const current=await this.lockAssignments(c,ids,plan.changes.map(({before})=>before.employee_id));
  const scheduleIds=[...new Set(plan.changes.map(({before})=>before.schedule_id))];
  const {rows:periods}=await c.query<{year:number;month:number}>(
   'SELECT year,month FROM schedules WHERE schedule_id=ANY($1::int[]) ORDER BY schedule_id FOR UPDATE',[scheduleIds]);
  const checkWritable=()=>{
   this.schedules.requireWritable(periods,workDates,new Date());
   checkDeadline();
  };
  checkWritable();
  const restored=await restoredRosterVersions(c,current);
  if(!cancellationSlotsMatch(plan.changes,current as (Assignment & {assigned_by:number})[],restored))throw new ConflictException(cancellationConflict);
  const conflict=await this.validation.rosterConflict(c,plan.changes.map(({before})=>before));
  if(conflict) {
   throw new ConflictException({code:'SWAP_CANCELLATION_SCHEDULE_INVALID',message:`คืนกะเดิมไม่ได้ ${conflict}`});
  }

  for(const {before} of plan.changes) {
   await c.query('UPDATE shift_assignments SET shift_type_id=$1,assigned_by=$2,version=version+1,updated_at=now() WHERE assignment_id=$3',
    [before.shift_type_id,before.assigned_by,before.assignment_id]);
  }
  await c.query('UPDATE schedules SET version=version+1,updated_at=now() WHERE schedule_id=ANY($1::int[])',[scheduleIds]);
  // Usage is counted from APPROVED requests in the original month. This transition refunds exactly one slot.
  await c.query("UPDATE requests SET status='CANCELLED',version=version+1,updated_at=now() WHERE request_id=$1",[requestId]);
  const currentById=new Map(current.map(slot=>[slot.assignment_id,slot]));
  await this.audit(c,actor,'SCHEDULE_SWAP_REVERSED',requestId,
   {assignments:plan.changes.map(({after})=>({...after,version:currentById.get(after.assignment_id)!.version}))},
   {assignments:plan.changes.map(({before})=>({...before,restoredFromVersion:before.version,version:currentById.get(before.assignment_id)!.version+1})),quota:{month:request.quota_month,returned:1}});
  await this.audit(c,actor,'REQUEST_CANCELLED',requestId,{status:'APPROVED',requestVersion:request.version},
   {status:'CANCELLED',requestVersion:request.version+1});
  const recipients=(await c.query('SELECT user_id FROM users WHERE employee_id=ANY($1::int[]) AND is_active',
   [plan.changes.map(({before})=>before.employee_id)])).rows;
  for(const user of recipients)await this.notify(c,user.user_id,requestId,'คำขอสลับกะถูกยกเลิก','คืนกะเดิมแล้ว กรุณาตรวจตารางล่าสุด');
  beforeCommit(checkWritable);
  return {requestId,status:'CANCELLED',version:request.version+1};
 }
 async list(actor:Actor) {
  if(!['EMPLOYEE','SUPERVISOR','MANAGER'].includes(actor.role))this.denied();
  const rows=(await this.db.query(`SELECT r.*,ch.snapshot,ch.assignment_id,ch.target_assignment_id,
   source_team.team_code AS source_snapshot_team_code,target_team.team_code AS target_snapshot_team_code,
   aa.version AS source_current_version, bb.version AS target_current_version, ${staleSlots} AS stale_schedule,
   applied.evidence AS cancellation_evidence, live.slots AS cancellation_slots
   FROM requests r JOIN change_requests ch USING(request_id)
   JOIN shift_assignments aa ON aa.assignment_id=ch.assignment_id JOIN shift_assignments bb ON bb.assignment_id=ch.target_assignment_id
   LEFT JOIN teams source_team ON source_team.team_id=(ch.snapshot->'source'->>'team_id')::int
   LEFT JOIN teams target_team ON target_team.team_id=(ch.snapshot->'target'->>'team_id')::int
   LEFT JOIN LATERAL (${appliedSwapEvidence('r.request_id')}) applied
    ON r.request_type='SWAP' AND r.status='APPROVED' AND r.quota_month IS NOT NULL AND r.requester_id=$1
   LEFT JOIN LATERAL (SELECT jsonb_agg(slot) AS slots FROM (
    ${this.schedules.assignmentSelect()} WHERE a.assignment_id IN (SELECT slots.assignment_id FROM ${swapSlots})
   ) slot) live ON applied.evidence IS NOT NULL
   WHERE $2='MANAGER' OR r.requester_id=$1
    OR ($2='EMPLOYEE' AND r.request_type='SWAP' AND ch.target_employee_id=$1)
    OR ($2='SUPERVISOR' AND EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$3))
   ORDER BY r.request_id DESC`,[actor.employeeId,actor.role,actor.userId])).rows;
  const approvedSlots=rows.flatMap(row=>row.cancellation_slots??[]);
  const restored=await restoredRosterVersions(this.db,approvedSlots);
  const checkedAt=new Date();
  for(const row of rows) {
   if(row.status==='PENDING'&&row.quota_month) {
    const closure=pendingRequestClosure(row.quota_month,row.submitted_at,checkedAt);
    if(closure) row.status=closure.status;
   }
   if(row.status==='PENDING'&&this.schedules.isClosed([],rosterDates(row.snapshot),checkedAt)) row.status='MONTH_CLOSED';
   const needsManager=managerApproval(row.snapshot);
   row.approvals=(await this.db.query(`SELECT a.*,COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS name,t.team_name
    FROM approvals a JOIN users u ON u.user_id=a.approver_id LEFT JOIN employees e USING(employee_id)
    LEFT JOIN teams t ON t.team_id=CASE WHEN $2::boolean THEN e.team_id
     ELSE COALESCE(CASE WHEN a.approver_level=1 THEN $3::int ELSE $4::int END,e.team_id) END
    WHERE a.request_id=$1 ORDER BY approver_level`,[row.request_id,needsManager,row.snapshot.source.team_id,row.snapshot.target.team_id])).rows;
   row.hasConflict=row.status==='PENDING'&&row.stale_schedule;
   if(row.status==='PENDING') {
    if(invalidCrossDate(row.snapshot)) row.approvalBlockReason=crossDateApprovalBlocked;
    else if(row.quota_month===null&&this.quota.localPilotEnabled()) row.approvalBlockReason=legacyApprovalBlocked;
   }
   delete row.stale_schedule;
   // Older snapshots keep stable team IDs but predate team_code. Do not rewrite approved payloads.
   row.demoSupported=demoTeam(row.source_snapshot_team_code)&&demoTeam(row.target_snapshot_team_code);
   row.approvalRouteConfirmed=validApprovalSteps(row.approvals,needsManager);
   row.canDecide=row.demoSupported&&row.approvalRouteConfirmed&&!row.hasConflict&&row.status==='PENDING'&&actor.role===(needsManager?'MANAGER':'SUPERVISOR')&&pendingStep(row.approvals,actor.userId,parallelApprovals(row.snapshot))?.approver_id===actor.userId;
   row.canCancel=actor.role==='EMPLOYEE'&&row.requester_id===actor.employeeId&&row.status==='PENDING'&&row.approvals.every((step:any)=>step.status==='PENDING');
   if(actor.role==='EMPLOYEE'&&row.requester_id===actor.employeeId&&row.status==='PENDING'&&!row.canCancel)
    row.cancelBlockReason='หัวหน้าบันทึกคำตัดสินแล้ว จึงยกเลิกคำขอนี้ไม่ได้';
   if(['EMPLOYEE','SUPERVISOR'].includes(actor.role)&&row.status==='APPROVED'&&row.request_type==='SWAP'&&row.quota_month&&row.requester_id===actor.employeeId) {
    const plan=cancellationPlan(row.cancellation_evidence,row.quota_month,row.requester_id,cancellationAssignmentIds(row));
    if(plan.issue)row.cancelBlockReason=plan.issue.message;
    else if(this.schedules.isClosed([],plan.changes.map(({before})=>before.work_date),checkedAt))row.cancelBlockReason='ตารางเดือนนี้ปิดแล้ว แก้ไขไม่ได้';
    else {
     const deadlineIssue=cancellationDeadlineIssue(plan.deadline,checkedAt);
     if(deadlineIssue)row.cancelBlockReason=deadlineIssue.message;
     else if(!cancellationSlotsMatch(plan.changes,row.cancellation_slots??[],restored))row.cancelBlockReason=cancellationConflict.message;
     else row.canCancel=true;
    }
   }
   delete row.cancellation_evidence;
   delete row.cancellation_slots;
   if(actor.role==='EMPLOYEE'&&row.requester_id!==actor.employeeId) {
    for(const approval of row.approvals) delete approval.comment;
   }
  }
  if(!await this.schedules.leaveEnabled())return rows;
  return [...rows,...await this.listLeave(actor)].sort((a,b)=>b.request_id-a.request_id);
 }
 private async listLeave(actor:Actor) {
  const {rows}=await this.db.query(`SELECT r.request_id,r.requester_id,r.request_type,r.version,r.submitted_at,r.status,
   l.source_snapshot,l.cover_snapshot,l.shift_starts_at,l.expires_at,to_jsonb(l)->>'ot_code' AS ot_code,
   CASE WHEN (COALESCE(l.finished_at,l.expires_at) AT TIME ZONE 'Asia/Bangkok')+interval '12 months'
      > $4::timestamptz AT TIME ZONE 'Asia/Bangkok' THEN l.leave_code END AS leave_code,
   CASE WHEN (COALESCE(l.finished_at,l.expires_at) AT TIME ZONE 'Asia/Bangkok')+interval '12 months'
      > $4::timestamptz AT TIME ZONE 'Asia/Bangkok' THEN l.reason END AS reason,
   CASE WHEN (COALESCE(l.finished_at,l.expires_at) AT TIME ZONE 'Asia/Bangkok')+interval '12 months'
      > $4::timestamptz AT TIME ZONE 'Asia/Bangkok' THEN l.rejection_reason END AS rejection_reason,
   a.version AS live_version,a.shift_type_id AS live_shift_type,
   b.version AS live_cover_version,b.shift_type_id AS live_cover_shift_type
   FROM requests r JOIN shiftflow_policy.leave_requests l USING(request_id)
   JOIN shift_assignments a ON a.assignment_id=l.assignment_id
   LEFT JOIN shift_assignments b ON b.assignment_id=l.cover_assignment_id
   WHERE r.requester_id=$1 OR l.cover_employee_id=$1
    OR ($2 IN ('MANAGER','SUPERVISOR') AND EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$3))`,
   [actor.employeeId,actor.role,actor.userId,new Date()]);
  const approvedSlots=rows.filter(row=>row.status==='APPROVED'&&row.requester_id===actor.employeeId)
   .flatMap(row=>leaveSlots(row).map(({assignment_id,work_date},i)=>({
    assignment_id,work_date,version:i===0?row.live_version:row.live_cover_version,
    shift_type_id:i===0?row.live_shift_type:row.live_cover_shift_type,
   })));
  const restored=await restoredRosterVersions(this.db,approvedSlots);
  const now=new Date();
  for(const row of rows) {
   const {rows:approvals}=await this.db.query(`SELECT a.approver_id,a.approver_level,a.status,a.approved_at,a.comment,
    COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS name,t.team_name
    FROM approvals a JOIN users u ON u.user_id=a.approver_id LEFT JOIN employees e USING(employee_id)
    LEFT JOIN teams t ON t.team_id=CASE WHEN a.approver_level=1 THEN $2::int ELSE $3::int END
    WHERE a.request_id=$1 ORDER BY a.approver_level`,[row.request_id,row.source_snapshot.team_id,row.cover_snapshot?.team_id??null]);
   const shifts=leaveSlots(row);
   const closed=this.schedules.isClosed([],shifts.map(a=>a.work_date),now);
   const offset=Number(row.status==='APPROVED');
   const changed=shifts.some(({assignment_id,version},i)=>{
    const liveVersion=i===0?row.live_version:row.live_cover_version;
    return liveVersion!==version+offset&&(!offset||restored.get(assignment_id)!==version+offset);
   });
   if(row.status==='PENDING')row.status=leavePendingClosure(row,now)?.status??(closed?'MONTH_CLOSED':'PENDING');
   row.approvals=approvals;
   const supervisor=leaveRole(shifts[0])==='SUPERVISOR';
   row.canDecide=row.status==='PENDING'&&actor.role===(supervisor?'MANAGER':'SUPERVISOR')
    &&approvals.some(a=>a.approver_id===actor.userId&&a.status==='PENDING'
      &&(supervisor||actor.teamId===shifts[a.approver_level-1]?.team_id));
   if(row.status==='PENDING'&&changed)row.approvalBlockReason='ตารางกะเปลี่ยนไป กรุณาตรวจตารางล่าสุด';
   row.canCancel=row.requester_id===actor.employeeId&&!closed&&(
    (row.status==='PENDING'&&approvals.every(a=>a.status==='PENDING'))
    || (row.status==='APPROVED'&&!changed&&now<row.shift_starts_at));
   if(row.requester_id===actor.employeeId&&!row.canCancel) {
    if(row.status==='APPROVED') {
     if(closed)row.cancelBlockReason='ตารางเดือนนี้ปิดแล้ว แก้ไขไม่ได้';
     else if(now>=row.shift_starts_at)row.cancelBlockReason='กะเริ่มแล้ว จึงยกเลิกคำขอนี้ไม่ได้';
     else if(changed)row.cancelBlockReason='ตารางกะเปลี่ยนไป จึงคืนกะตามคำขอนี้ไม่ได้';
    } else if(row.status==='PENDING') {
     row.cancelBlockReason='คำขอผ่านการตรวจแล้ว จึงยกเลิกคำขอนี้ไม่ได้';
    }
   }
   row.coverOtCode=shifts[1]?leaveCoverShift(shifts[0],shifts[1]):null;
   row.snapshot={source:row.source_snapshot,target:row.cover_snapshot,
    approvalRoute:leaveRole(shifts[0])==='SUPERVISOR'?'MANAGER':shifts[1]?'TWO_SUPERVISORS':'ONE_SUPERVISOR'};
   delete row.source_snapshot;
   delete row.cover_snapshot;
   delete row.live_version;
   delete row.live_shift_type;
   delete row.live_cover_version;
   delete row.live_cover_shift_type;
  }
  return rows;
 }
 private async getPairs(c:PoolClient,actor:Actor,input:SwapInput,lock:boolean,submission=true):Promise<[SwapPair,...SwapPair[]]> {
  const ids=[input.assignmentId,input.targetAssignmentId];
  if(input.secondSwap) ids.push(input.secondSwap.assignmentId,input.secondSwap.targetAssignmentId);
  if(new Set(ids).size!==ids.length) throw new BadRequestException({code:'DISTINCT_ASSIGNMENTS',message:'เลือกช่องกะที่แตกต่างกัน'});
  let slots=await this.schedules.pair(c,ids);
  if(slots.length!==ids.length) throw new NotFoundException({code:'ASSIGNMENT_NOT_FOUND',message:'ไม่พบรายการกะที่ระบุ'});
  this.demoScope(...slots);
  const source=slots.find(slot=>slot.assignment_id===input.assignmentId)!;
  if(submission&&!this.canSubmit(actor,source)) this.denied();
  if(submission&&input.secondSwap&&!this.quota.localPilotMonth(source.work_date)) this.denied();
  if(lock)slots=await this.lockAssignments(c,ids,slots.map(a=>a.employee_id));
  const find=(id:number)=>slots.find(slot=>slot.assignment_id===id)!;
  if(slots.length!==ids.length) throw new NotFoundException({code:'ASSIGNMENT_NOT_FOUND',message:'ไม่พบรายการกะที่ระบุ'});
  const pairs:[SwapPair,...SwapPair[]]=[[find(input.assignmentId),find(input.targetAssignmentId)]];
  if(input.secondSwap) pairs.push([find(input.secondSwap.assignmentId),find(input.secondSwap.targetAssignmentId)]);
  if(submission&&pairs[1]&&pairs[1].some((slot,index)=>slot.team_id!==pairs[0][index].team_id)) {
   throw new ConflictException({code:'SWAP_PARTICIPANTS_CHANGED',message:'ทีมของผู้เกี่ยวข้องเปลี่ยนระหว่างวันที่เลือก กรุณาส่งคำขอแยกกัน'});
  }
  return pairs;
 }
 private async lockAssignments(c:PoolClient,ids:number[],employeeIds:number[]) {
  const employees=[...new Set(employeeIds)].sort((a,b)=>a-b);
  for(const employeeId of employees)await c.query('SELECT pg_advisory_xact_lock(810,$1)',[employeeId]);
  // Keep team/participant data stable while checking and applying this decision.
  await c.query('SELECT employee_id FROM employees WHERE employee_id=ANY($1::int[]) ORDER BY employee_id FOR SHARE',[employees]);
  return this.schedules.pair(c,ids,true);
 }
 private canSubmit(actor:Actor,assignment:Assignment) {
  if(assignment.employee_id!==actor.employeeId) return false;
  if(actor.role==='EMPLOYEE') return assignment.position!=='SUPERVISOR'||!this.quota.localPilotMonth(assignment.work_date);
  return actor.role==='SUPERVISOR'&&assignment.position==='SUPERVISOR'&&Boolean(this.quota.localPilotMonth(assignment.work_date));
 }
 private async approverTeam(c:PoolClient,actor:Actor) {
  if(!this.schedules.effectiveTeamsEnabled()) return actor.teamId;
  const {rows:[row]}=await c.query<{teamId:number}>(`SELECT shiftflow_policy.employee_team_on(employee_id,team_id,$2::date) AS "teamId"
   FROM employees WHERE employee_id=$1`,[actor.employeeId,bangkokWorkDate(new Date())]);
  return row?.teamId;
 }
 private async approversFor(c:PoolClient,a:Assignment,b:Assignment|null,needsManager:boolean,secondDate?:string):Promise<number[]> {
  const effectiveTeams=this.schedules.effectiveTeamsEnabled();
  if(needsManager) {
   const {rows}=await c.query<{user_id:number;designated:boolean}>(`SELECT u.user_id,(u.demo_profile='manager') AS designated FROM users u JOIN roles r USING(role_id)
    WHERE r.role_name='MANAGER' AND u.is_active AND u.identity_source='DEMO'
    ${effectiveTeams?"AND u.initial_access_state IS DISTINCT FROM 'PENDING'":''}`);
   const selected=this.selectApprover(rows,effectiveTeams);
   if(!selected) throw new ConflictException({code:'APPROVER_UNRESOLVED',message:'ยังระบุผู้จัดการคนเดียวสำหรับคำขอนี้ไม่ได้'});
   return [selected];
  }
  const approvers:number[]=[];
  for(const team of b?[a.team_id,b.team_id]:[a.team_id]) {
   const {rows}=await c.query<{user_id:number;designated:boolean}>(`SELECT u.user_id,(u.demo_order IS NOT NULL) AS designated
    FROM users u JOIN employees e USING(employee_id) JOIN roles r USING(role_id)
    WHERE r.role_name='SUPERVISOR' AND u.is_active AND u.identity_source='DEMO'
    ${effectiveTeams?`AND u.initial_access_state IS DISTINCT FROM 'PENDING'
     AND shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$2::date)=$1
     AND shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$3::date)=$1
     AND shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$4::date)=$1`:'AND e.team_id=$1 AND u.demo_order IS NOT NULL'}`,
   effectiveTeams?[team,bangkokWorkDate(new Date()),a.work_date,secondDate??a.work_date]:[team]);
   const selected=this.selectApprover(rows,effectiveTeams);
   if(!selected) throw new ConflictException({code:'APPROVER_UNRESOLVED',message:'ยังระบุหัวหน้าทีมที่รับผิดชอบไม่ได้ ต้องยืนยันก่อนยื่นคำขอ'});
   approvers.push(selected);
  }
  return approvers;
 }
 private selectApprover(rows:{user_id:number;designated:boolean}[],preferDesignated:boolean) {
  const designated=preferDesignated?rows.filter(row=>row.designated):[];
  if(designated.length===1)return designated[0].user_id;
  return rows.length===1?rows[0].user_id:null;
 }
 private checkVersions(pairs:[SwapPair,...SwapPair[]],input:SwapInput) {
  const expected=[input,input.secondSwap];
  if(pairs.some(([a,b],i)=>a.version!==expected[i]?.assignmentVersion||b.version!==expected[i]?.targetVersion)) {
   throw new ConflictException({code:'SCHEDULE_CHANGED',message:'ตารางกะเปลี่ยนหลังยื่นคำขอ กรุณาโหลดล่าสุดและสร้างคำขอใหม่'});
  }
 }
 private checkSubmissionDates(pairs:SwapPair[],checkedAt:Date) {
  for(const [source] of pairs) requireOpenSubmission(source.work_date,checkedAt);
 }
 private denied():never { throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับรายการนี้'}); }
 private demoScope(...assignments:Assignment[]) {
  if(assignments.some(a=>!demoTeam(a.team_code)))throw new ForbiddenException({code:'DEMO_SCOPE',message:'เดโมนี้ทดลองสลับข้ามทีม A–D เท่านั้น'});
 }
 private async operation(actor:Actor,key:string,input:unknown,run:(c:PoolClient,beforeCommit:(check:()=>void)=>void)=>Promise<unknown>) {
  if(!key||! /^[a-zA-Z0-9-]{8,100}$/.test(key)) throw new BadRequestException({code:'IDEMPOTENCY_REQUIRED',message:'คำสั่งไม่มีรหัสป้องกันรายการซ้ำ กรุณาโหลดหน้าใหม่'});
  const inputHash=hash(JSON.stringify(input));
  return this.db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(811,hashtext($1))',[`${actor.userId}:${key}`]);
   if(this.schedules.effectiveTeamsEnabled()) {
    await c.query('SELECT pg_advisory_xact_lock_shared(814,1)');
    const current=await c.query(`SELECT 1 FROM users u JOIN roles r USING(role_id)
     WHERE u.user_id=$1 AND u.employee_id IS NOT DISTINCT FROM $2::int AND u.is_active AND r.role_name=$3`,
    [actor.userId,actor.employeeId,actor.role]);
    if(!current.rowCount)this.denied();
   }
   const old=(await c.query('SELECT * FROM operation_receipts WHERE user_id=$1 AND operation_key=$2',[actor.userId,key])).rows[0];
   if(old) { if(old.input_hash!==inputHash) throw new ConflictException({code:'KEY_REUSED',message:'รหัสรายการถูกใช้กับคำสั่งอื่นแล้ว'}); return old.response; }
   let commitCheck=()=>{};
   const result=await run(c,check=>{commitCheck=check;});
   await c.query('INSERT INTO operation_receipts(user_id,operation_key,input_hash,response) VALUES($1,$2,$3,$4)',[actor.userId,key,inputHash,JSON.stringify(result)]);
   commitCheck();
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
