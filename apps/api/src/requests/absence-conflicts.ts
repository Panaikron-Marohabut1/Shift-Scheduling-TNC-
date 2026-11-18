import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { SchedulesService } from '../schedules/schedules.service';
import type { Assignment } from '../shared/types';

type MarkedShift = {
 assignment_id: number;
 employee_id: number;
 schedule_id: number;
 work_date: string;
 shift_code: string;
 start_time: string;
 end_time: string;
 holiday_date: string | null;
};

const absenceConflict = () => new ConflictException({
 code: 'SCHEDULE_CHANGED',
 message: 'กะที่เกี่ยวข้องต้องให้ผู้จัดการตรวจสอบก่อนเปลี่ยนตาราง',
});
const activeHistory = "cancelled_at IS NULL AND recorded_at > (((clock_timestamp() AT TIME ZONE 'Asia/Bangkok') - interval '12 months') AT TIME ZONE 'Asia/Bangkok')";

export async function requireNoMarkedAbsence(c:PoolClient,schedules:SchedulesService,ids:number[]) {
 if(!ids.length||!await schedules.absenceEnabled(c))return;
 const {rowCount}=await c.query(`SELECT 1 FROM shiftflow_policy.shift_absences
  WHERE assignment_id=ANY($1::int[]) AND ${activeHistory} LIMIT 1`,[ids]);
 if(rowCount)throw absenceConflict();
}

export async function requireStableAbsenceShifts(c:PoolClient,schedules:SchedulesService,affected:readonly Assignment[]) {
 if(!affected.length||!await schedules.absenceEnabled(c))return;
 const groups=new Map(affected.map(slot=>[`${slot.schedule_id}:${slot.employee_id}`,slot]));
 const pairs=[...groups.values()];
 const {rows}=await c.query<MarkedShift>(`
  SELECT a.assignment_id,a.employee_id,a.schedule_id,a.work_date,x.shift_code,x.start_time,x.end_time,x.holiday_date
  FROM shiftflow_policy.shift_absences x JOIN shift_assignments a USING(assignment_id)
  JOIN unnest($1::int[],$2::int[]) AS scope(schedule_id,employee_id)
   ON scope.schedule_id=a.schedule_id AND scope.employee_id=a.employee_id
  WHERE ${activeHistory}
   AND NOT EXISTS (SELECT 1 FROM shiftflow_policy.employee_team_transfers move
    WHERE move.employee_id=a.employee_id AND move.team_id IS NULL AND move.effective_on<=a.work_date)
 `,[pairs.map(slot=>slot.schedule_id),pairs.map(slot=>slot.employee_id)]);
 for(const {schedule_id,employee_id} of groups.values()) {
  const marked=rows.filter(row=>row.schedule_id===schedule_id&&row.employee_id===employee_id);
  if(!marked.length)continue;
  const {assignments,allocations}=await schedules.holidayRoster(c,schedule_id,employee_id);
  const byId=new Map(assignments.map(slot=>[slot.assignment_id,slot]));
  const otByDate=new Map(allocations.map(ot=>[ot.workDate,ot]));
  for(const snapshot of marked) {
   const slot=byId.get(snapshot.assignment_id);
   const ot=otByDate.get(snapshot.work_date);
   if(!slot||slot.status!=='ACTIVE'||!slot.is_working||(ot?.overtimeShiftCode??slot.shift_code)!==snapshot.shift_code
    ||slot.start_time!==snapshot.start_time||slot.end_time!==snapshot.end_time||(ot?.holidayDate??null)!==snapshot.holiday_date) {
    throw absenceConflict();
   }
  }
 }
}
