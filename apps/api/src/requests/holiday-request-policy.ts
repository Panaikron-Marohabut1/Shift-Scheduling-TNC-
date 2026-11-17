import { leaveShiftStart } from './leave-policy';

export function isHolidayDate(value: unknown): value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function holidayRequestWindow(
 holidayDate:string,
 target:{work_date:string;start_time:string|null},
 overtime:{work_date:string;start_time:string|null},
) {
 const holidayStart=leaveShiftStart(holidayDate,'00:00');
 const targetStart=leaveShiftStart(target.work_date,target.start_time);
 const overtimeStart=leaveShiftStart(overtime.work_date,overtime.start_time);
 if(!holidayStart||!targetStart||!overtimeStart)return null;
 const affectedShiftStart=targetStart<=overtimeStart?targetStart:overtimeStart;
 const deadline=holidayStart<=affectedShiftStart?holidayStart:affectedShiftStart;
 const deadlineReason=deadline===holidayStart?'HOLIDAY_START':deadline===targetStart?'TARGET_START':'OVERTIME_START';
 return {deadline,deadlineReason,affectedShiftStart};
}
