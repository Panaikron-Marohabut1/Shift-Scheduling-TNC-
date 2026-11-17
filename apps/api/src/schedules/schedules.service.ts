import { Injectable, BadRequestException, ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { centralSchedulingEnabled, isLocalSchedulingDatabase, isSharedDemoDatabase, projectRoot } from '../config';
import { Database } from '../database/database.service';
import { Actor, Assignment, ShiftAbsence } from '../shared/types';
import { allocateHolidayOvertime } from '../shared/holiday-roster-rules';
import { bangkokWorkDate } from '../requests/request-time';
import { isHolidayDate } from '../requests/holiday-request-policy';
import { rosterRequestConflicts } from '../requests/roster-request-conflicts';
import { restoredRosterVersions } from '../requests/restored-roster-versions';
type ClosedRosterRow={employeeCode:string;team:string;workDate:string;shiftCode:string};
type SchedulePeriod={year:number;month:number};
type CalendarHoliday={date:string;name:string;is_active:boolean};
type DemoHoliday={date:string;through?:string};
type UsedHoliday={employee_id:number;assignment_id:number;holiday_date:string;base_code:string;ot_work_date:string};
type AbsenceRow={assignment_id:number;absence_id:number;shift_code:string;start_time:string;end_time:string;holiday_date:string|null};
type AbsenceInput={active:boolean;version:number;absenceId:number|null;holidayDate:string|null};
const absenceTable='shiftflow_policy.shift_absences';
const absenceFields='assignment_id,absence_id,shift_code,start_time,end_time,holiday_date';
const absenceCutoff=(timestamp:string)=>`(((${timestamp}::timestamptz AT TIME ZONE 'Asia/Bangkok') - interval '12 months') AT TIME ZONE 'Asia/Bangkok')`;
const validId=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>0&&value<=2147483647;
const absenceConflict=()=>new ConflictException({code:'ABSENCE_CHANGED',message:'ข้อมูลขาดงานเปลี่ยนแล้ว กรุณาโหลดตารางล่าสุด'});
function absenceView(row:AbsenceRow):ShiftAbsence {
 return {id:row.absence_id,shiftCode:row.shift_code,startTime:row.start_time,endTime:row.end_time,
  ...(row.holiday_date?{holidayDate:row.holiday_date}:{})};
}
const minuteMicros=60_000_000;
const dayMicros=1440*minuteMicros;
function clockMicros(time:string|null) {
 if(!time)return null;
 const clock=/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(time);
 if(!clock)return null;
 const [,hours,minutes,seconds='0',fraction='']=clock;
 const hour=Number(hours),minute=Number(minutes),second=Number(seconds);
 const micros=((hour*60+minute)*60+second)*1_000_000+Number(fraction.padEnd(6,'0'));
 return minute<60&&second<60&&micros<=dayMicros?micros:null;
}
function scheduledMinutes(start:string|null,end:string|null) {
 const from=clockMicros(start),to=clockMicros(end);
 if(from===null||to===null)return null;
 const elapsed=(to-from+dayMicros)%dayMicros;
 return elapsed>0&&elapsed%minuteMicros===0?elapsed/minuteMicros:null;
}
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
 async absenceEnabled(c?:PoolClient) {
  return this.effectiveTeamsEnabled() && (await (c??this.db).query(
   "SELECT 1 FROM schema_migrations WHERE name='016_shift_absences.sql'")).rowCount===1;
 }
 private requireAbsenceManager(isManager:boolean):void {
  if(!isManager) throw new ForbiddenException({code:'ACTION_DENIED',message:'เฉพาะผู้จัดการที่บันทึกหรือยกเลิกการขาดงานได้'});
 }
 async setAbsence(actor:Actor,assignmentId:string,key:string,body:unknown) {
  this.requireAbsenceManager(actor.role==='MANAGER');
  if(!await this.absenceEnabled()) throw new NotFoundException({code:'ABSENCE_UNAVAILABLE',message:'ยังไม่เปิดการบันทึกขาดงาน'});
  const id=Number(assignmentId);
  const fields=body&&typeof body==='object'?body as Partial<AbsenceInput>:{};
  const absenceId=fields.absenceId??null;
  if(!/^\d+$/.test(assignmentId)||!validId(id)||typeof fields.active!=='boolean'||!validId(fields.version)
   ||(fields.active?(absenceId!==null||!(fields.holidayDate===null||isHolidayDate(fields.holidayDate))):!validId(absenceId))) {
   throw new BadRequestException({code:'INVALID_ABSENCE_INPUT',message:'กรุณาเลือกกะและโหลดข้อมูลล่าสุดก่อนบันทึก'});
  }
  if(!key||!/^[a-zA-Z0-9-]{8,100}$/.test(key)) {
   throw new BadRequestException({code:'IDEMPOTENCY_REQUIRED',message:'คำสั่งไม่มีรหัสป้องกันรายการซ้ำ กรุณาโหลดหน้าใหม่'});
  }
  return this.db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(811,hashtext($1))',[`absence:${actor.userId}:${key}`]);
   await c.query('SELECT pg_advisory_xact_lock_shared(814,1)');
   const manager=await c.query(`SELECT 1 FROM users u JOIN roles r USING(role_id)
    WHERE u.user_id=$1 AND u.is_active AND r.role_name='MANAGER'`,[actor.userId]);
   this.requireAbsenceManager(Boolean(manager.rowCount));
   const {rows:[owner]}=await c.query<{employee_id:number}>('SELECT employee_id FROM shift_assignments WHERE assignment_id=$1',[id]);
   if(!owner) throw new NotFoundException({code:'ASSIGNMENT_NOT_FOUND',message:'ไม่พบกะที่ระบุ'});
   await c.query('SELECT pg_advisory_xact_lock(810,$1)',[owner.employee_id]);
   await c.query('SELECT employee_id FROM employees WHERE employee_id=$1 FOR SHARE',[owner.employee_id]);
   const [slot]=await this.pair(c,[id],true);
   if(!slot) throw new NotFoundException({code:'ASSIGNMENT_NOT_FOUND',message:'ไม่พบกะที่ระบุ'});
   const {rows:[period]}=await c.query<SchedulePeriod & {status:string}>(
    'SELECT year,month,status FROM schedules WHERE schedule_id=$1 FOR UPDATE',[slot.schedule_id]);
   if(!period||period.status!=='PUBLISHED' || slot.work_date.slice(0,7)!==monthKey(period)) {
    throw new ConflictException({code:'SCHEDULE_NOT_PUBLISHED',message:'บันทึกได้เฉพาะกะจากตารางที่ประกาศแล้ว'});
   }
   const checkedAt=new Date();
   this.requireWritable([period],[slot.work_date],checkedAt);
   const {rows:[current]}=await c.query<AbsenceRow & {fresh:boolean}>(`SELECT ${absenceFields},
    recorded_at > ${absenceCutoff('$2')} AS fresh FROM ${absenceTable}
    WHERE assignment_id=$1 AND cancelled_at IS NULL`,[id,checkedAt]);
   const {rows:[receipt]}=await c.query<{assignment_id:number;absence_id:number;active:boolean;version:number;holiday_date:string|null;fresh:boolean}>(`
    SELECT assignment_id,absence_id,holiday_date,(recorded_by=$1 AND record_key=$2) AS active,
     CASE WHEN recorded_by=$1 AND record_key=$2 THEN recorded_version ELSE cancelled_version END AS version,
     COALESCE(cancelled_at,recorded_at) > ${absenceCutoff('$3')} AS fresh FROM ${absenceTable}
    WHERE (recorded_by=$1 AND record_key=$2) OR (cancelled_by=$1 AND cancel_key=$2)`,[actor.userId,key,checkedAt]);
   if((current&&!current.fresh)||(receipt&&!receipt.fresh)) {
    throw new ConflictException({code:'ABSENCE_EXPIRED',message:'รายการขาดงานหมดอายุแล้ว กรุณาโหลดตารางล่าสุด'});
   }
   if(receipt) {
    if(receipt.assignment_id!==id||receipt.active!==fields.active||receipt.version!==fields.version
     ||(fields.active?receipt.holiday_date!==fields.holidayDate:receipt.absence_id!==absenceId)) {
     throw new ConflictException({code:'KEY_REUSED',message:'รหัสรายการถูกใช้กับคำสั่งอื่นแล้ว'});
    }
    return {absence:current?absenceView(current):null};
   }
   if(slot.version!==fields.version) throw absenceConflict();
   if(fields.active) {
    if(current)throw absenceConflict();
    if(slot.status!=='ACTIVE'||!slot.is_working||!scheduledMinutes(slot.start_time,slot.end_time)) {
     throw new ConflictException({code:'ABSENCE_SHIFT_INELIGIBLE',message:'เลือกกะทำงานที่มีเวลาเริ่มและสิ้นสุดครบถ้วน'});
    }
    const holiday=await this.holidayEnabled(c)
     ? (await this.holidayRoster(c,slot.schedule_id,slot.employee_id)).allocations.find(row=>row.workDate===slot.work_date)
     : null;
    const holidayDate=holiday?.holidayDate??null;
    if(holidayDate!==fields.holidayDate)throw absenceConflict();
    const {rows:[saved]}=await c.query<AbsenceRow>(`INSERT INTO ${absenceTable}
     (assignment_id,shift_code,start_time,end_time,holiday_date,recorded_by,recorded_at,record_key,recorded_version)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${absenceFields}`,
    [id,holiday?.overtimeShiftCode??slot.shift_code,slot.start_time,slot.end_time,holidayDate,actor.userId,checkedAt,key,slot.version]);
    this.requireWritable([period],[slot.work_date],new Date());
    return {absence:absenceView(saved)};
   }
   if(!current||current.absence_id!==absenceId)throw absenceConflict();
   await c.query(`UPDATE ${absenceTable} SET cancelled_by=$2,cancelled_at=$3,cancel_key=$4,cancelled_version=$5 WHERE absence_id=$1`,
    [absenceId,actor.userId,checkedAt,key,slot.version]);
   this.requireWritable([period],[slot.work_date],new Date());
   return {absence:null};
  });
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
  const leaveEnabled=await this.leaveEnabled(c);
  await this.attachOwnLeaveHours(c,actor,assignments,leaveEnabled);
  const absenceHistoryAvailable=await this.attachAbsences(c,actor,month,assignments);
  if(schedule?.status==='PUBLISHED'&&['EMPLOYEE','SUPERVISOR'].includes(actor.role)) {
   const conflicts=await rosterRequestConflicts(c,assignments.map(slot=>slot.assignment_id),new Date(),leaveEnabled);
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
  return {month,schedule,assignments,holidays,holidayOvertimePreview,
   ...(absenceHistoryAvailable!==undefined?{absenceHistoryAvailable}:{}),scope:'ORGANIZATION',dataSource:'SYNTHETIC'};
  });
 }
 private async attachAbsences(c:PoolClient,actor:Actor,month:string,assignments:Assignment[]) {
  const manager=actor.role==='MANAGER';
  if((!manager&&!['EMPLOYEE','SUPERVISOR'].includes(actor.role))||!await this.absenceEnabled(c))return;
  const checkedAt=new Date();
  const slots=new Map(assignments.filter(slot=>slot.status==='ACTIVE'&&(manager||slot.employee_id===actor.employeeId))
   .map(slot=>[slot.assignment_id,slot]));
  const {rows}=await c.query<AbsenceRow>(`SELECT ${absenceFields} FROM ${absenceTable}
   WHERE assignment_id=ANY($1::int[]) AND cancelled_at IS NULL AND recorded_at > ${absenceCutoff('$2')}`,[[...slots.keys()],checkedAt]);
  for(const row of rows) slots.get(row.assignment_id)!.absence=absenceView(row);
  const {rows:[history]}=await c.query<{available:boolean}>(`
   SELECT $1::date >= ((${absenceCutoff('$2')}) AT TIME ZONE 'Asia/Bangkok')::date AS available`,[`${month}-01`,checkedAt]);
  return history.available;
 }
 private async attachOwnLeaveHours(c:PoolClient,actor:Actor,assignments:Assignment[],leaveEnabled:boolean) {
  if(!leaveEnabled||actor.employeeId===null||!['EMPLOYEE','SUPERVISOR'].includes(actor.role))return;
  const slots=new Map(assignments.filter(slot=>slot.employee_id===actor.employeeId&&slot.status==='ACTIVE'&&slot.shift_code==='L')
   .map(slot=>[slot.assignment_id,slot]));
  if(!slots.size)return;
  const {rows}=await c.query<{assignment_id:number;code:string|null;start_time:string|null;end_time:string|null}>(`
   SELECT DISTINCT ON(l.assignment_id) l.assignment_id,l.source_snapshot->>'shift_code' AS code,
    l.source_snapshot->>'start_time' AS start_time,l.source_snapshot->>'end_time' AS end_time
   FROM shiftflow_policy.leave_requests l JOIN requests r USING(request_id)
   WHERE l.assignment_id=ANY($1::int[]) AND r.requester_id=$2 AND r.request_type='LEAVE' AND r.status='APPROVED'
   ORDER BY l.assignment_id, r.request_id DESC`,[[...slots.keys()],actor.employeeId]);
  for(const row of rows) {
   const slot=slots.get(row.assignment_id)!;
   const minutes=scheduledMinutes(row.start_time,row.end_time);
   if(row.code)slot.leaveBaseCode=row.code;
   if(minutes!==null)slot.leaveMinutes=minutes;
  }
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
