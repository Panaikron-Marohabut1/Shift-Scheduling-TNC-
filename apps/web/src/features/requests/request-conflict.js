import { state } from '../../app/state.js';
import { isoOf, monthKey, parseThaiDate } from '../../shared/scheduling/dates.js';
import { getAllEmployees } from '../../shared/scheduling/employees.js';
import { localLeaveClosureStatus } from './leave-time.js';

// Older demo requests may lack an explicit list of affected roster cells.
export function localRequestSlots(request) {
  if (request.applied?.length) return request.applied;
  if (request.changes?.length) return request.changes;
  const parsed = parseThaiDate(request.date);
  const y = request.y ?? parsed?.y;
  const m = request.m ?? parsed?.m;
  if (y == null || m == null) return [];
  const idOf = (id, name) => id || (name && getAllEmployees().find(person => person.name === name)?.id);
  const requesterId = idOf(request.requesterId, request.person);
  if (request.oldDay && request.newDay) {
    return [request.oldDay, request.newDay].map(d => ({ empId: requesterId, y, m, d }));
  }
  const days = request.day ? [request.day] : parsed?.days || [];
  const participants = [requesterId, idOf(request.coverId ?? request.targetId, request.targetPerson)];
  return [...days, request.payDay].filter(Boolean).flatMap(d =>
    participants.filter(Boolean).map(empId => ({ empId, y, m, d })));
}

export function requestConflictAt(empId, y, m, d, excludedLocalRequest) {
  if (!empId || !d) return null;
  const conflict = state.apiAssign[empId]?.[isoOf(y, m, d)]?.requestConflict;
  if (conflict && !(conflict.status === 'PENDING' && Date.parse(conflict.expiresAt) <= Date.now())) return conflict;
  if (state.actor?.remotePilot) return null;
  const request = state.localRequests.find(req => req !== excludedLocalRequest
    && !(state.actor?.swapPolicy && req.kind === 'swap')
    && (req.status === 'อนุมัติแล้ว' || (req.status?.includes('รอ') && !localLeaveClosureStatus(req)))
    && localRequestSlots(req).some(slot => String(slot.empId) === String(empId) && slot.y === y && slot.m === m && Number(slot.d) === Number(d)));
  return request ? { status: request.status === 'อนุมัติแล้ว' ? 'APPROVED' : 'PENDING', requestId: request.id } : null;
}

export function requestConflictForSlots(slots, excludedLocalRequest) {
  for (const { empId, y, m, d } of slots) {
    const conflict = requestConflictAt(empId, y, m, d, excludedLocalRequest);
    if (conflict) return conflict;
  }
  return null;
}

export function requestConflictText(conflict) {
  return conflict.status === 'APPROVED'
    ? 'กะที่เลือกมีคำขอที่อนุมัติแล้ว ต้องยกเลิกและคืนกะเดิมก่อนยื่นใหม่'
    : 'กะที่เลือกมีคำขอรออนุมัติอยู่ ต้องยกเลิกคำขอเดิมก่อนยื่นใหม่';
}

export function localCancellationConflict(request) {
  const otherApproved = state.localRequests.filter(other => other !== request && other.status === 'อนุมัติแล้ว');
  return request.applied?.some(slot => {
    const { y, m, d, empId, code, prev } = slot;
    if (state.scheduleOverrides[monthKey(y, m)]?.[empId]?.[d] !== code) return true;
    // Older demo records have no revision numbers. Protect same-code changes when the order is unclear.
    return otherApproved.some(other => other.applied?.some(candidate => candidate.empId === empId
      && candidate.y === y && candidate.m === m && candidate.d === d
      && candidate.code === code && candidate.prev === code && prev !== candidate.code));
  }) ? 'คืนกะเดิมไม่ได้ เพราะช่องกะมีการเปลี่ยนแปลงจากคำขออื่นแล้ว' : '';
}
