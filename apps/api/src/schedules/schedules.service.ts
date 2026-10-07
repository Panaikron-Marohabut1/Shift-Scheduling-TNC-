import { Injectable, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Database } from '../database/database.service';
import { Actor, Assignment } from '../shared/types';
export const assignmentSelect=`SELECT a.*, e.team_id, e.position, e.first_name||' '||e.last_name AS name,
 t.team_code, t.team_name, e.employee_code, st.shift_code, st.shift_name, st.is_working, st.start_time, st.end_time
 FROM shift_assignments a JOIN employees e USING(employee_id) JOIN shift_types st USING(shift_type_id) JOIN teams t USING(team_id)`;
@Injectable()
export class SchedulesService {
 constructor(@Inject(Database) private readonly db:Database) {}
 async month(actor:Actor,month:string) {
  if(!['EMPLOYEE','SUPERVISOR','MANAGER','HR'].includes(actor.role))throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์อ่านตารางภายใน'});
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException({code:'INVALID_MONTH',message:'เดือนต้องอยู่ในรูปแบบ YYYY-MM'});
  const [year,number]=month.split('-').map(Number);
  return this.db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  const assignments=(await c.query(`${assignmentSelect} WHERE a.schedule_id IN
   (SELECT schedule_id FROM schedules WHERE year=$1 AND month=$2 AND ($3<>'HR' OR status='PUBLISHED')) ORDER BY e.employee_id,a.work_date`,[year,number,actor.role])).rows;
  const schedule=(await c.query("SELECT schedule_id,month,year,status,version,updated_at FROM schedules WHERE year=$1 AND month=$2 AND ($3<>'HR' OR status='PUBLISHED')",[year,number,actor.role])).rows[0]??null;
  await this.attachAppliedSwaps(c,assignments);
  await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'SCHEDULE_VIEWED','USER',$1,$2)",[actor.userId,JSON.stringify({month,scope:'ORGANIZATION',teamId:actor.teamId,scheduleVersion:schedule?.version??null})]);
  return {month,schedule,assignments,scope:'ORGANIZATION',dataSource:'SYNTHETIC'};
  });
 }
 private async attachAppliedSwaps(c:PoolClient,assignments:Assignment[]) {
  if(!assignments.length)return;
  // Derive provenance from protected final-application evidence in the same read snapshot.
  // Only a minimal summary is exposed; request access and raw audit access stay separate.
  const rows=(await c.query(`SELECT r.request_id,al.created_at AS applied_at,al.old_value,al.new_value
   FROM audit_logs al JOIN requests r ON r.request_id=al.entity_id
   WHERE al.entity_type='REQUEST' AND al.action='SCHEDULE_SWAP_APPLIED' AND r.status='APPROVED'
    AND (SELECT count(*) FROM approvals ap WHERE ap.request_id=r.request_id AND ap.status='APPROVED')=2
    AND ((al.new_value->'source'->>'assignment_id')::int=ANY($1::int[])
      OR (al.new_value->'target'->>'assignment_id')::int=ANY($1::int[]))
   ORDER BY al.audit_id DESC`,[assignments.map(a=>a.assignment_id)])).rows;
  const visible=new Map(assignments.map(a=>[a.assignment_id,a]));
  for(const row of rows)for(const [side,other] of [['source','target'],['target','source']]) {
   const before=row.old_value?.[side],after=row.new_value?.[side],partnerAfter=row.new_value?.[other];
   if(!before||!after||!partnerAfter)continue;
   const current=visible.get(after.assignment_id),partner=visible.get(partnerAfter.assignment_id);
   if(!current||!partner||current.swap||current.status!=='ACTIVE'||current.version!==after.version||current.shift_type_id!==after.shift_type_id||current.work_date!==after.work_date||current.work_date!==partner.work_date)continue;
   current.swap={requestId:row.request_id,appliedAt:row.applied_at.toISOString(),originalShiftCode:before.shift_code,receivedShiftCode:after.shift_code,
    partner:{employeeId:partner.employee_id,name:partner.name,teamCode:partner.team_code,teamName:partnerAfter.team_name??partner.team_code}};
  }
 }
 async pair(c:PoolClient,ids:number[],lock=false):Promise<Assignment[]> {
  if(lock) await c.query('SELECT assignment_id FROM shift_assignments WHERE assignment_id=ANY($1::int[]) ORDER BY assignment_id FOR UPDATE',[ids]);
  return (await c.query(`${assignmentSelect} WHERE a.assignment_id=ANY($1::int[]) ORDER BY a.assignment_id`,[ids])).rows;
 }
}
