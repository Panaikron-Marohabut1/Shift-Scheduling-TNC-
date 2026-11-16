/* ==========================================================================
   สิทธิ์ของคำขอ: ใครเห็นคำขอไหน ใครอนุมัติขั้นไหนได้ และยกเลิกได้เมื่อไร
   --------------------------------------------------------------------------
   คำขอจากฐานข้อมูล (req.api) ใช้สิทธิ์ที่ระบบหลังบ้านส่งมา (canDecide / canCancel)
   คำขอเดโม (LOCAL) ตรวจในเบราว์เซอร์ตามลำดับผู้อนุมัติ
   ========================================================================== */

import { state } from '../../app/state.js';
import { currentEmp, findEmployeeById, getAllEmployees, getSupervisorShiftType, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { isMonthLocked } from '../../shared/scheduling/roster.js';
import { stepKey } from '../notifications/store.js';
import { localLeaveClosureStatus } from './leave-time.js';
import { localCancellationConflict } from './request-conflict.js';

/* ---------- สิทธิ์ ---------- */
export const empOf = (id, name) => findEmployeeById(id) || getAllEmployees().find(e => e.name === name) || null;
export function pendingReviewStep(req, roleName) {
  const pending = (req.approvers || []).filter(step => step.status === 'pending');
  return req.parallelApproval ? pending.find(step => stepKey(step.role) === `sup:${roleName.slice(-1)}`) : pending[0];
}
export function canUserReviewRequestForRole(req, roleName) {
  if (req.api) return roleName === state.activeRole && req.canDecide;
  if (!isSupervisorRoleName(roleName)) return false;
  if (!req.status || !req.status.includes('รอ') || localLeaveClosureStatus(req)) return false;
  const me = currentEmp();
  if (me && req.requesterId === me.id && roleName === state.activeRole) return false; // หัวหน้ากะไม่อนุมัติคำขอของตัวเอง
  const next = pendingReviewStep(req, roleName);
  if (!next) return false;
  // ดูจากตัวอักษรทีมในชื่อขั้น (ไม่ดูจากชื่อคน เพราะชื่อหัวหน้ากะแต่ละทีมอาจขึ้นต้นเหมือนกัน)
  const letter = roleName.slice(-1);
  const text = next.role || '';
  return text.includes(`Supervisor ${letter}`) || text.includes(`กะ ${letter}`) || text.includes(`Shift ${letter}`);
}
export const canUserReviewRequest = req => canUserReviewRequestForRole(req, state.activeRole);
// ขั้นที่ผู้จัดการต้องพิจารณา: ขั้น "ผู้จัดการ..." หรือขั้นหัวหน้ากะของคำขอที่หัวหน้ากะยื่นเอง
export function managerCanAct(req) {
  if (req.api) return state.activeRole === 'Manager' && req.canDecide;
  if (!req.status || !req.status.includes('รอ') || localLeaveClosureStatus(req)) return false;
  const next = (req.approvers || []).find(s => s.status !== 'approved');
  if (!next) return false;
  if ((next.role || '').includes('ผู้จัดการ')) return true;
  const a = empOf(req.requesterId, req.person);
  if (!a || a.roleCategory !== 'Shift Supervisor') return false;
  const letter = String(a.shiftType || '').replace('Shift ', '');
  const t = next.role || '';
  return t.includes(`Supervisor ${letter}`) || t.includes(`Shift ${letter}`);
}
export function canWithdrawRequest(req) {
  if (req?.api) return !!req.canCancel && req.status.includes('รอ');
  if (!req || !req.status || !req.status.includes('รอ') || localLeaveClosureStatus(req)) return false;
  return (req.approvers || []).every(a => a.status === 'pending');
}
export function canCancelApproved(req) {
  if (req?.status !== 'อนุมัติแล้ว') return false;
  if (req.api) return !!req.canCancel;
  if (req.kind === 'leave' && Number.isFinite(req.shiftStartsAt) && Date.now() >= req.shiftStartsAt) return false;
  if (!(req.applied || []).length) return false;
  if (localCancellationConflict(req)) return false;
  if (req.applied.some(a => isMonthLocked(a.y, a.m))) return false;
  const me = currentEmp();
  return state.activeRole === 'Manager' || !!(me && req.requesterId === me.id);
}
export function isRequestOwner(req, employee) {
  return !!employee && (req.requesterId != null ? String(req.requesterId) === String(employee.id) : req.person === employee.name);
}

function otherParticipants(req) {
  return [req.targetId ?? req.coverId, ...(req.helpers || []).map(helper => helper.id),
    ...(req.changes || []).map(change => change.empId)]
    .filter(id => id != null && id !== '' && String(id) !== String(req.requesterId));
}

export function hasOtherParticipants(req) {
  return otherParticipants(req).length > 0 || !!req.targetPerson;
}

export function visibleRequestReason(req) {
  if (req.kind !== 'leave') return req.reason;
  const me = currentEmp();
  const role = state.activeRole;
  const reviewer = role === 'Manager' ? 'mgr' : isSupervisorRoleName(role) ? `sup:${role.slice(-1)}` : '';
  const involved = isRequestOwner(req, me) || (me && otherParticipants(req).some(id => String(id) === String(me.id)));
  const assigned = reviewer && req.approvers?.some(step => stepKey(step.role) === reviewer);
  return involved || assigned ? req.reason : '';
}

export function getVisibleRequests() {
  if (state.activeRole === 'Manager' || state.activeRole === 'HR') return state.requests;
  if (state.activeRole === 'Shift Employee') {
    const me = currentEmp();
    if (!me) return [];
    return state.requests.filter(req => isRequestOwner(req, me)
      || otherParticipants(req).some(id => String(id) === String(me.id))
      || (req.targetId == null && req.coverId == null && req.targetPerson === me.name));
  }
  if (isSupervisorRoleName(state.activeRole)) {
    const supShift = getSupervisorShiftType(state.activeRole);
    return state.requests.filter(req => {
      if (req.api) return true; // ระบบหลังบ้านส่งมาเฉพาะคำขอที่หัวหน้ากะคนนี้เห็นได้
      const requester = empOf(req.requesterId, req.person);
      if (requester && requester.shiftType === supShift) return true;
      const target = req.targetPerson && empOf(req.targetId, req.targetPerson);
      if (target && target.shiftType === supShift) return true;
      // คนมาช่วยทำ OT จากทีมนี้ หรือมีขั้นอนุมัติของหัวหน้ากะทีมนี้
      if ((req.helpers || []).some(h => { const e = findEmployeeById(h.id); return e && e.shiftType === supShift; })) return true;
      return (req.approvers || []).some(a => stepKey(a.role) === `sup:${supShift.slice(-1)}`);
    });
  }
  return state.requests;
}
