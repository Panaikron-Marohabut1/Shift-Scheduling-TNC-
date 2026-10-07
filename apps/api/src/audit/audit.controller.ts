import { Controller, Get, Req, Query, Inject, ForbiddenException } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
@Controller('api/audit')
export class AuditController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Get() async list(@Req() req:ActorRequest,@Query('view') view?:string) {
  const actor=req.actor;
  if(actor.role==='EXTERNAL')throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์อ่านประวัติภายใน'});
  return (await this.db.query(`SELECT al.*,COALESCE(e.first_name||' '||e.last_name,u.demo_display_name) AS actor_name FROM audit_logs al JOIN users u ON u.user_id=al.user_id LEFT JOIN employees e USING(employee_id)
   WHERE (al.user_id=$1 OR (al.entity_type='REQUEST' AND EXISTS(SELECT 1 FROM requests r WHERE r.request_id=al.entity_id AND
    (r.requester_id=$2 OR ($3='SUPERVISOR' AND EXISTS(SELECT 1 FROM approvals ap WHERE ap.request_id=r.request_id AND ap.approver_id=$1))))))
   AND ($4 NOT IN ('activity','personal') OR (al.entity_type='REQUEST' AND al.action IN ('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED','SCHEDULE_SWAP_APPLIED')))
   AND ($4<>'personal' OR (al.user_id=$1 AND al.action IN ('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED')))
   ORDER BY al.audit_id DESC LIMIT 100`,[actor.userId,actor.employeeId,actor.role,view??'audit'])).rows;
 }
}
