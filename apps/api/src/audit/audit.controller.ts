import { Controller, Get, Req, Query, Inject, ForbiddenException } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
import { SchedulesService } from '../schedules/schedules.service';

type ShiftEvidence = { employee_id: number; work_date: string; shift_code: string };
type SwapEvidence = {
 source?: ShiftEvidence; target?: ShiftEvidence;
 secondSwap?: { source?: ShiftEvidence; target?: ShiftEvidence };
 assignments?: ShiftEvidence[];
 level?: number;
};
type EmployeeHistoryRow = {
 audit_id: number; user_id: number; entity_type: string; entity_id: number; action: string;
 actor_name: string; created_at: Date; old_value: SwapEvidence | null; new_value: SwapEvidence | null;
 request_type: string;
};

function swapShifts(value: SwapEvidence | null) {
 return value?.assignments ?? [value?.source,value?.target,value?.secondSwap?.source,value?.secondSwap?.target]
  .filter((shift): shift is ShiftEvidence=>!!shift);
}

function ownShiftChanges(before: SwapEvidence | null,after: SwapEvidence | null,employeeId: number | null) {
 const previous=new Map(swapShifts(before).filter(shift=>shift.employee_id===employeeId)
  .map(shift=>[shift.work_date,shift.shift_code]));
 return swapShifts(after).filter(shift=>shift.employee_id===employeeId&&previous.has(shift.work_date)
   &&previous.get(shift.work_date)!==shift.shift_code)
  .map(shift=>({workDate:shift.work_date,from:previous.get(shift.work_date),to:shift.shift_code}))
  .sort((a,b)=>a.workDate.localeCompare(b.workDate));
}

@Controller('api/audit')
export class AuditController {
 constructor(@Inject(Database) private readonly db:Database,@Inject(SchedulesService) private readonly schedules:SchedulesService) {}
 @Get() async list(@Req() req:ActorRequest,@Query('view') view?:string) {
  const actor=req.actor;
  if(actor.role==='EXTERNAL')throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์อ่านประวัติภายใน'});
  if(view==='personal'&&actor.role==='EMPLOYEE')return this.employeeHistory(actor.employeeId);
  return (await this.db.query(`SELECT al.*,COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS actor_name,
   CASE WHEN al.entity_type='REQUEST' THEN (SELECT r.request_type FROM requests r WHERE r.request_id=al.entity_id) END AS request_type
   FROM audit_logs al JOIN users u ON u.user_id=al.user_id LEFT JOIN employees e USING(employee_id)
   WHERE (al.user_id=$1 OR (al.entity_type='REQUEST' AND EXISTS(SELECT 1 FROM requests r WHERE r.request_id=al.entity_id AND
    (r.requester_id=$2 OR ($3='SUPERVISOR' AND EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$1))))))
   AND ($4 NOT IN ('activity','personal') OR (al.entity_type='REQUEST' AND al.action IN ('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED','SCHEDULE_SWAP_APPLIED','SWAP_CUTOVER_CLOSED','SCHEDULE_LEAVE_APPLIED','SCHEDULE_LEAVE_REVERSED','SCHEDULE_OT_APPLIED','SCHEDULE_OT_REVERSED')))
   AND ($4<>'personal' OR (al.user_id=$1 AND al.action IN ('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED')))
   ORDER BY al.audit_id DESC LIMIT 100`,[actor.userId,actor.employeeId,actor.role,view??'audit'])).rows;
 }

 private async employeeHistory(employeeId: number | null) {
  const leaveEnabled=await this.schedules.leaveEnabled();
  const rows: EmployeeHistoryRow[]=(await this.db.query(
   `SELECT al.audit_id,al.user_id,al.entity_type,al.entity_id,al.action,al.created_at,al.old_value,al.new_value,r.request_type,
   COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS actor_name
   FROM audit_logs al JOIN requests r ON al.entity_type='REQUEST' AND r.request_id=al.entity_id
   LEFT JOIN change_requests ch USING(request_id)
   ${leaveEnabled?'LEFT JOIN shiftflow_policy.leave_requests l USING(request_id)':''}
   JOIN users u ON u.user_id=al.user_id LEFT JOIN employees e ON e.employee_id=u.employee_id
   WHERE ((r.request_type='SWAP' AND (r.requester_id=$1 OR ch.target_employee_id=$1))
          ${leaveEnabled?"OR (r.request_type IN ('LEAVE','OT') AND (r.requester_id=$1 OR l.cover_employee_id=$1))":''})
    AND al.action IN ('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED',
                      'SWAP_CUTOVER_CLOSED','SCHEDULE_SWAP_APPLIED','SCHEDULE_SWAP_REVERSED',
                      'SCHEDULE_LEAVE_APPLIED','SCHEDULE_LEAVE_REVERSED','SCHEDULE_OT_APPLIED','SCHEDULE_OT_REVERSED')
   ORDER BY al.audit_id DESC LIMIT 100`,[employeeId])).rows;
  return rows.map(({old_value,new_value,...event})=>{
   if(/^SCHEDULE_(SWAP|LEAVE|OT)_(APPLIED|REVERSED)$/.test(event.action)) {
    return {...event,new_value:{changes:ownShiftChanges(old_value,new_value,employeeId)}};
   }
   return {...event,new_value:event.action==='REQUEST_APPROVED'?{level:new_value?.level}:{}};
  });
 }
}
