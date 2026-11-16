import { state } from '../../app/state.js';
import { isoOf } from '../../shared/scheduling/dates.js';
import { requestClosureStatus } from './request-time.js';

const defaultStart = { M: '07:30', N: '19:30', D: '08:00' };

export function leaveShiftStartsAt(employeeId, y, m, day, code) {
  const workDate = isoOf(y, m, day);
  const slot = state.apiAssign[employeeId]?.[workDate];
  const clock = (slot?.shift_code === code && slot.start_time) || defaultStart[state.shiftDefs[code]?.family];
  return clock ? Date.parse(`${workDate}T${clock}+07:00`) : NaN;
}

export function localLeaveClosureStatus(request, now = Date.now()) {
  return request.kind === 'leave' && !request.api && request.status?.includes('รอ') && Number.isFinite(request.ts)
    ? requestClosureStatus(request.ts, now) : '';
}
