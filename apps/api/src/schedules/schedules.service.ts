import { Injectable, BadRequestException, ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { centralSchedulingEnabled, isLocalSchedulingDatabase, isSharedDemoDatabase, projectRoot } from '../config';
import { Database } from '../database/database.service';
import { Actor, Assignment } from '../shared/types';
import { allocateHolidayOvertime } from '../shared/holiday-roster-rules';
import { bangkokWorkDate } from '../requests/request-time';
import { rosterRequestConflicts } from '../requests/roster-request-conflicts';
import { restoredRosterVersions } from '../requests/restored-roster-versions';
type ClosedRosterRow={employeeCode:string;team:string;workDate:string;shiftCode:string};
type SchedulePeriod={year:number;month:number};
type CalendarHoliday={date:string;name:string;is_active:boolean};
type DemoHoliday={date:string;through?:string};
type UsedHoliday={employee_id:number;assignment_id:number;holiday_date:string;base_code:string;ot_work_date:string};
const demoHolidays: DemoHoliday[]=JSON.parse(readFileSync(resolve(projectRoot,'apps/web/src/shared/scheduling/demo-holidays.json'),'utf8'));
function demoHolidayDates(month:string) {
 return demoHolidays.filter(holiday=>holiday.date.startsWith(`${month}-`)).flatMap(({date,through})=>{
  const first=Number(date.slice(-2)), last=through ? Number(through.slice(-2)) : first;
  return Array.from({length:last-first+1},(_,index)=>`${month}-${String(first+index).padStart(2,'0')}`);
 });
}
const monthKey=(period:SchedulePeriod)=>`${period.year}-${String(period.month).padStart(2,'0')}`;
function previousMonth(current:string) {
 const [year,month]=current.split('-').map(Number);
 return monthKey(month===1?{year:year-1,month:12}:{year,month:month-1});
}
const csvCell=(value:string)=>{
 const safe=/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(value)?`'${value}`:value;
 return `"${safe.replace(/"/g,'""')}"`;
};
const assignmentSelect=`SELECT a.*, t.team_id, e.position, e.first_name||' '||e.last_name AS name,
 t.team_code, t.team_name, e.employee_code, st.shift_code, st.shift_name, st.is_working, st.start_time, st.end_time
 FROM shift_assignments a JOIN employees e USING(employee_id) JOIN shift_types st USING(shift_type_id)`;
@Injectable()
export class SchedulesService {
 constructor(@Inject(Database) private readonly db:Database) {}
 effectiveTeamsEnabled() { return centralSchedulingEnabled(new URL(this.db.pool.options.connectionString!)); }
 async leaveEnabled(c?:PoolClient) {
  if(!this.effectiveTeamsEnabled())return false;
  const {rows:[row]}=await (c??this.db).query("SELECT to_regclass('shiftflow_policy.leave_requests') IS NOT NULL AS available");
  return row.available as boolean;
 }
 async holidayEnabled(c?:PoolClient) {
  if(!this.effectiveTeamsEnabled())return false;
  return ((await (c??this.db).query(
   "SELECT 1 FROM schema_migrations WHERE name='015_public_holiday_requests.sql'")).rowCount === 1);
 }
 private async calendarHolidayRecords(c:PoolClient,year:number,month:number) {
  return (await c.query<CalendarHoliday>(`
   SELECT holiday_date::text AS date,holiday_name AS name,is_active FROM public.holidays
   WHERE holiday_date >= make_date(NULLIF($1,0),$2,1)
    AND holiday_date < make_date(NULLIF($1,0),$2,1)+interval '1 month'
   ORDER BY holiday_date
  `,[year,month])).rows;
 }
 private async usedHolidays(c:PoolClient,scheduleId:number,employeeId:number|null=null) {
  return (await c.query<UsedHoliday>(`
   SELECT r.requester_id AS employee_id,l.assignment_id,l.holiday_date::text,
    l.source_snapshot->>'shift_code' AS base_code,l.holiday_ot_snapshot->>'work_date' AS ot_work_date
   FROM shiftflow_policy.leave_requests l JOIN requests r USING(request_id)
   JOIN shift_assignments a ON a.assignment_id=l.assignment_id
   WHERE a.schedule_id=$1 AND l.holiday_date IS NOT NULL AND r.status='APPROVED'
    AND ($2::int IS NULL OR r.requester_id=$2)
  `,[scheduleId,employeeId])).rows;
 }
 private holidayAllocations(dates:string[],assignments:Assignment[],used:UsedHoliday[],restoring?:UsedHoliday) {
  const usedDates=new Set(used.map(row=>row.holiday_date));
  return allocateHolidayOvertime(dates.filter(date=>!usedDates.has(date)),assignments.filter(slot=>slot.status==='ACTIVE').map(slot=>({
   workDate:slot.work_date,
   shiftCode:slot.assignment_id===restoring?.assignment_id ? restoring.base_code : slot.shift_code,
  })),used.map(row=>row.ot_work_date));
 }
 private historicalHolidayOvertime(actor:Actor,month:string,assignments:Assignment[]) {
  if(!['EMPLOYEE','SUPERVISOR'].includes(actor.role) || actor.employeeId===null ||
   month>=bangkokWorkDate(new Date()).slice(0,7)) return [];
  const database=new URL(this.db.pool.options.connectionString!);
  if(!isSharedDemoDatabase(database) && !isLocalSchedulingDatabase(database)) return [];
  const dates=demoHolidayDates(month);
  if(!dates.length) return [];
  return this.holidayAllocations(dates,assignments.filter(slot=>slot.employee_id===actor.employeeId),[])
   .map(({workDate,holidayDate,overtimeShiftCode})=>({workDate,holidayDate,shiftCode:overtimeShiftCode}));
 }
 async holidayRoster(c:PoolClient,scheduleId:number,employeeId:number,restoreHolidayDate?:string) {
  const {rows:[period]}=await c.query<SchedulePeriod>('SELECT year,month FROM schedules WHERE schedule_id=$1',[scheduleId]);
  const records=period ? await this.calendarHolidayRecords(c,period.year,period.month) : [];
  const holidays=records.filter(holiday=>holiday.is_active).map(({date,name})=>({date,name}));
  const dates=holidays.map(holiday=>holiday.date);
  const assignments=(await c.query<Assignment>(`${this.assignmentSelect()} WHERE a.schedule_id=$1 AND a.employee_id=$2 ORDER BY a.work_date`,[scheduleId,employeeId])).rows;
  const allUsed=await this.usedHolidays(c,scheduleId,employeeId);
  const restoring=allUsed.find(row=>row.holiday_date===restoreHolidayDate);
  const used=allUsed.filter(row=>row!==restoring);
  const usedDates=new Set(used.map(row=>row.holiday_date));
  return {dates,holidays,assignments,allocations:this.holidayAllocations(dates,assignments,used,restoring),
   activeHolidayDates:new Set(dates.filter(date=>!usedDates.has(date)))};
 }
 async otEnabled() {
  return this.effectiveTeamsEnabled() && (await this.db.query(
   "SELECT 1 FROM schema_migrations WHERE name='012_individual_ot_requests.sql'")).rowCount === 1;
 }
 assignmentTeamJoin() {
  return this.effectiveTeamsEnabled()
   ? 'JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,a.work_date)'
   : 'JOIN teams t ON t.team_id=e.team_id';
 }
 assignmentSelect() { return `${assignmentSelect} ${this.assignmentTeamJoin()}`; }
 localMonthCloseEnabled() {
  if(process.env.ENABLE_LOCAL_MONTH_CLOSE==='false') return false;
  return this.effectiveTeamsEnabled();
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
    FROM shift_assignments a JOIN employees e USING(employee_id) JOIN shift_types st USING(shift_type_id) ${this.assignmentTeamJoin()}
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
  const assignments=(await c.query<Assignment>(`${this.assignmentSelect()} WHERE a.schedule_id IN
   (SELECT schedule_id FROM schedules WHERE year=$1 AND month=$2 AND ($3<>'HR' OR status='PUBLISHED')) ORDER BY e.employee_id,a.work_date`,[year,number,actor.role])).rows;
  const schedule=(await c.query("SELECT schedule_id,month,year,status,version,updated_at FROM schedules WHERE year=$1 AND month=$2 AND ($3<>'HR' OR status='PUBLISHED')",[year,number,actor.role])).rows[0]??null;
  const holidayRecords=await this.calendarHolidayRecords(c,year,number);
  const holidays=holidayRecords.filter(holiday=>holiday.is_active).map(({date,name})=>({date,name}));
  const holidayCalendarActive=await this.holidayEnabled(c);
  if(schedule?.status==='PUBLISHED' && holidayCalendarActive) {
   const used=await this.usedHolidays(c,schedule.schedule_id);
   this.attachHolidayOvertime(holidays.map(holiday=>holiday.date),assignments,used);
  }
  const holidayOvertimePreview=schedule?.status==='PUBLISHED' && !holidayRecords.length
   ? this.historicalHolidayOvertime(actor,month,assignments)
   : [];
  await this.attachAppliedSwaps(c,assignments);
  if(schedule?.status==='PUBLISHED'&&['EMPLOYEE','SUPERVISOR'].includes(actor.role)) {
   const conflicts=await rosterRequestConflicts(c,assignments.map(slot=>slot.assignment_id),new Date(),await this.leaveEnabled(c));
   const slots=new Map(assignments.map(slot=>[slot.assignment_id,slot]));
   for(const conflict of conflicts) {
    const slot=slots.get(conflict.assignment_id);
    if(!slot||slot.requestConflict)continue;
    const canSeeRequest=slot.employee_id===actor.employeeId
     &&(conflict.request_type!=='SWAP'||actor.role==='EMPLOYEE'||conflict.requester_id===actor.employeeId);
    slot.requestConflict={
     status:conflict.status,
     ...(canSeeRequest?{
      requestId:conflict.request_id,
      ...(conflict.expiresAt?{expiresAt:conflict.expiresAt.toISOString()}:{}),
     }:{}),
    };
   }
  }
  await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'SCHEDULE_VIEWED','USER',$1,$2)",[actor.userId,JSON.stringify({month,scope:'ORGANIZATION',teamId:actor.teamId,scheduleVersion:schedule?.version??null})]);
  return {month,schedule,assignments,holidays,holidayOvertimePreview,scope:'ORGANIZATION',dataSource:'SYNTHETIC'};
  });
 }
 private attachHolidayOvertime(holidayDates:string[],assignments:Assignment[],used:UsedHoliday[]) {
  const usedBySlot=new Map(used.map(row=>[row.assignment_id,row]));
  const usedByEmployee=new Map<number,UsedHoliday[]>();
  for(const row of used) {
   const forEmployee=usedByEmployee.get(row.employee_id)??[];
   forEmployee.push(row);
   usedByEmployee.set(row.employee_id,forEmployee);
  }
  const employeeSlots=new Map<number,Map<string,Assignment>>();
  for(const slot of assignments) {
   if(slot.status!=='ACTIVE')continue;
   const consumed=usedBySlot.get(slot.assignment_id);
   if(consumed && slot.shift_code==='L')slot.holidayLeave={holidayDate:consumed.holiday_date};
   if(!holidayDates.length)continue;
   let slots=employeeSlots.get(slot.employee_id);
   if(!slots) employeeSlots.set(slot.employee_id,slots=new Map());
   slots.set(slot.work_date,slot);
  }
  for(const [employeeId,slots] of employeeSlots) {
   const consumed=usedByEmployee.get(employeeId)??[];
   for(const overtime of this.holidayAllocations(holidayDates,[...slots.values()],consumed)) {
    slots.get(overtime.workDate)!.holidayOvertime={holidayDate:overtime.holidayDate,shiftCode:overtime.overtimeShiftCode};
   }
  }
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
  if(!rows.length)return;
  const visible=new Map(assignments.map(a=>[a.assignment_id,a]));
  const evidenceVersions=await restoredRosterVersions(c,assignments);
  for(const row of rows) for(const [oldPair,newPair] of [[row.old_value,row.new_value],[row.old_value?.secondSwap,row.new_value?.secondSwap]]) {
   for(const [side,other] of [['source','target'],['target','source']]) {
   const before=oldPair?.[side],after=newPair?.[side],partnerAfter=newPair?.[other];
   if(!before||!after||!partnerAfter)continue;
   const current=visible.get(after.assignment_id),partner=visible.get(partnerAfter.assignment_id);
   if(!current||!partner||current.swap||current.status!=='ACTIVE'||(evidenceVersions.get(current.assignment_id)??current.version)!==after.version||current.shift_type_id!==after.shift_type_id||current.work_date!==after.work_date||current.work_date!==partner.work_date)continue;
   current.swap={requestId:row.request_id,appliedAt:row.applied_at.toISOString(),originalShiftCode:before.shift_code,receivedShiftCode:after.shift_code,
    partner:{employeeId:partner.employee_id,name:partner.name,teamCode:partner.team_code,teamName:partnerAfter.team_name??partner.team_code}};
   }
  }
 }
 async pair(c:PoolClient,ids:number[],lock=false):Promise<Assignment[]> {
  if(lock) await c.query('SELECT assignment_id FROM shift_assignments WHERE assignment_id=ANY($1::int[]) ORDER BY assignment_id FOR UPDATE',[ids]);
  return (await c.query(`${this.assignmentSelect()} WHERE a.assignment_id=ANY($1::int[]) ORDER BY a.assignment_id`,[ids])).rows;
 }
}
