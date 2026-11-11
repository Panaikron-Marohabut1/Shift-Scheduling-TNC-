import { Injectable, BadRequestException, ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { isLocalSchedulingDatabase } from '../config';
import { Database } from '../database/database.service';
import { Actor, Assignment } from '../shared/types';
import { bangkokWorkDate } from '../requests/swap-request-time';
type ClosedRosterRow={employeeCode:string;team:string;workDate:string;shiftCode:string};
type SchedulePeriod={year:number;month:number};
const monthKey=(period:SchedulePeriod)=>`${period.year}-${String(period.month).padStart(2,'0')}`;
function previousMonth(current:string) {
 const [year,month]=current.split('-').map(Number);
 return monthKey(month===1?{year:year-1,month:12}:{year,month:month-1});
}
const csvCell=(value:string)=>{
 const safe=/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(value)?`'${value}`:value;
 return `"${safe.replace(/"/g,'""')}"`;
};
export const assignmentSelect=`SELECT a.*, e.team_id, e.position, e.first_name||' '||e.last_name AS name,
 t.team_code, t.team_name, e.employee_code, st.shift_code, st.shift_name, st.is_working, st.start_time, st.end_time
 FROM shift_assignments a JOIN employees e USING(employee_id) JOIN shift_types st USING(shift_type_id) JOIN teams t USING(team_id)`;
@Injectable()
export class SchedulesService {
 constructor(@Inject(Database) private readonly db:Database) {}
 localMonthCloseEnabled() {
  if(process.env.ENABLE_LOCAL_MONTH_CLOSE==='false') return false;
  return isLocalSchedulingDatabase(new URL(this.db.pool.options.connectionString!));
 }
 isClosed(periods:SchedulePeriod[],workDates:string[],checkedAt:Date) {
  if(!this.localMonthCloseEnabled()) return false;
  const current=bangkokWorkDate(checkedAt).slice(0,7);
  return periods.some(period=>monthKey(period)<current)||workDates.some(date=>date.slice(0,7)<current);
 }
 requireWritable(periods:SchedulePeriod[],workDates:string[],checkedAt:Date) {
  if(this.isClosed(periods,workDates,checkedAt)) {
   throw new ConflictException({code:'SCHEDULE_MONTH_CLOSED',message:'ตารางเดือนนี้ปิดแล้ว แก้ไขไม่ได้'});
  }
 }
 async closedRoster(actor:Actor,requestedMonth?:string) {
  return this.readClosedRoster(actor,requestedMonth,false);
 }
 async closedRosterCsv(actor:Actor,requestedMonth?:string) {
  return this.readClosedRoster(actor,requestedMonth,true);
 }
 private async readClosedRoster(actor:Actor,requestedMonth:string|undefined,exportCsv:boolean) {
  if(actor.role!=='HR') throw new ForbiddenException({code:'ACTION_DENIED',message:'เฉพาะ HR ที่เปิดตารางปิดเดือนจากหน้านี้ได้'});
  if(!this.localMonthCloseEnabled()) throw new NotFoundException({code:'CLOSED_ROSTER_UNAVAILABLE',message:'ยังไม่เปิดใช้งานตารางปิดเดือนส่วนกลาง'});
  const current=bangkokWorkDate(new Date()).slice(0,7);
  const month=requestedMonth??previousMonth(current);
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
   throw new BadRequestException({code:'INVALID_MONTH',message:'เดือนต้องอยู่ในรูปแบบ YYYY-MM'});
  }
  if(month>=current) throw new ConflictException({code:'ROSTER_MONTH_OPEN',message:'ตารางเดือนนี้ยังไม่ปิด'});
  const [year,number]=month.split('-').map(Number);
  return this.db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
   const {rows:[schedule]}=await c.query<{schedule_id:number;version:number}>(`
    SELECT schedule_id,version FROM schedules WHERE year=$1 AND month=$2 AND status='PUBLISHED'
   `,[year,number]);
   if(!schedule) throw new NotFoundException({code:'CLOSED_ROSTER_NOT_FOUND',message:'ไม่พบตารางที่ประกาศใช้แล้วสำหรับเดือนนี้'});
   const {rows}=await c.query<ClosedRosterRow>(`
    SELECT e.employee_code AS "employeeCode",t.team_code AS team,a.work_date::text AS "workDate",st.shift_code AS "shiftCode"
    FROM shift_assignments a JOIN employees e USING(employee_id) JOIN teams t USING(team_id) JOIN shift_types st USING(shift_type_id)
    WHERE a.schedule_id=$1 AND a.status='ACTIVE' AND a.work_date >= $2::date AND a.work_date < $2::date + interval '1 month'
    ORDER BY t.team_code,e.employee_code,a.work_date,a.assignment_id
   `,[schedule.schedule_id,`${month}-01`]);
   const metadata={month,scheduleVersion:schedule.version};
   const csv=exportCsv?Buffer.from('\uFEFF'+[
    ['รหัสพนักงาน','ทีม','วันที่','รหัสกะ'],
    ...rows.map(row=>[row.employeeCode,row.team,row.workDate,row.shiftCode]),
   ].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n','utf8'):null;
   await c.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,$2,'SCHEDULE',$3,$4)`,
    [actor.userId,exportCsv?'HR_CLOSED_ROSTER_EXPORTED':'HR_CLOSED_ROSTER_VIEWED',schedule.schedule_id,JSON.stringify(metadata)]);
   return {roster:{...metadata,rows},csv};
  });
 }
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
   FROM audit_logs al JOIN requests r ON r.request_id=al.entity_id JOIN change_requests ch ON ch.request_id=r.request_id
   WHERE al.entity_type='REQUEST' AND al.action='SCHEDULE_SWAP_APPLIED' AND r.status='APPROVED'
    AND (SELECT count(*) FROM approvals ap WHERE ap.request_id=r.request_id AND ap.status='APPROVED')=
      CASE WHEN ch.snapshot->>'approvalRoute'='MANAGER' THEN 1 ELSE 2 END
    AND ((al.new_value->'source'->>'assignment_id')::int=ANY($1::int[])
      OR (al.new_value->'target'->>'assignment_id')::int=ANY($1::int[])
      OR (al.new_value->'secondSwap'->'source'->>'assignment_id')::int=ANY($1::int[])
      OR (al.new_value->'secondSwap'->'target'->>'assignment_id')::int=ANY($1::int[]))
   ORDER BY al.audit_id DESC`,[assignments.map(a=>a.assignment_id)])).rows;
  const visible=new Map(assignments.map(a=>[a.assignment_id,a]));
  for(const row of rows) for(const [oldPair,newPair] of [[row.old_value,row.new_value],[row.old_value?.secondSwap,row.new_value?.secondSwap]]) {
   for(const [side,other] of [['source','target'],['target','source']]) {
   const before=oldPair?.[side],after=newPair?.[side],partnerAfter=newPair?.[other];
   if(!before||!after||!partnerAfter)continue;
   const current=visible.get(after.assignment_id),partner=visible.get(partnerAfter.assignment_id);
   if(!current||!partner||current.swap||current.status!=='ACTIVE'||current.version!==after.version||current.shift_type_id!==after.shift_type_id||current.work_date!==after.work_date||current.work_date!==partner.work_date)continue;
   current.swap={requestId:row.request_id,appliedAt:row.applied_at.toISOString(),originalShiftCode:before.shift_code,receivedShiftCode:after.shift_code,
    partner:{employeeId:partner.employee_id,name:partner.name,teamCode:partner.team_code,teamName:partnerAfter.team_name??partner.team_code}};
   }
  }
 }
 async pair(c:PoolClient,ids:number[],lock=false):Promise<Assignment[]> {
  if(lock) await c.query('SELECT assignment_id FROM shift_assignments WHERE assignment_id=ANY($1::int[]) ORDER BY assignment_id FOR UPDATE',[ids]);
  return (await c.query(`${assignmentSelect} WHERE a.assignment_id=ANY($1::int[]) ORDER BY a.assignment_id`,[ids])).rows;
 }
}
