/* ==========================================================================
   สิทธิ์ของคำขอ: ใครเห็นคำขอไหน ใครอนุมัติขั้นไหนได้ และยกเลิกได้เมื่อไร
   --------------------------------------------------------------------------
   คำขอจากฐานข้อมูล (req.api) ใช้สิทธิ์ที่ระบบหลังบ้านส่งมา (canDecide / canCancel)
   คำขอเดโม (LOCAL) ตรวจในเบราว์เซอร์ตามลำดับผู้อนุมัติ
   ========================================================================== */

import { state } from '../../app/state.js';
import { currentEmp, findEmployeeById, getAllEmployees, getSupervisorShiftType, isSupervisorRoleName } from '../../shared/scheduling/employees.js';

/* ---------- สิทธิ์ ---------- */
export const empOf = (id, name) => findEmployeeById(id) || getAllEmployees().find(e => e.name === name) || null;
export function canUserReviewRequestForRole(req, roleName) {
  if (req.api) return roleName === state.activeRole && req.canDecide;
  if (!isSupervisorRoleName(roleName)) return false;
  if (!req.status || !req.status.includes('รอ')) return false;
  const me = currentEmp();
  if (me && req.requesterId === me.id && roleName === state.activeRole) return false; // หัวหน้ากะไม่อนุมัติคำขอของตัวเอง
  const next = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  if (!next) return false;
  // ดูจากตัวอักษรทีมในชื่อขั้น (ไม่ดูจากชื่อคน เพราะชื่อหัวหน้ากะแต่ละทีมอาจขึ้นต้นเหมือนกัน)
  const letter = roleName.slice(-1);
  const text = next.role || '';
  return text.includes(`Supervisor ${letter}`) || text.includes(`กะ ${letter}`) || text.includes(`Shift ${letter}`);
}
export const canUserReviewRequest = req => canUserReviewRequestForRole(req, state.activeRole);
// ขั้นที่ผู้จัดการต้องพิจารณา: ขั้น "ผู้จัดการ..." หรือขั้นหัวหน้ากะของคำขอที่หัวหน้ากะยื่นเอง
export function managerCanAct(req) {
  if (req.api || !req.status || !req.status.includes('รอ')) return false;
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
  if (req.api) return req.canCancel;
  if (!req || !req.status || !req.status.includes('รอ')) return false;
  return (req.approvers || []).every(a => a.status === 'pending');
}
export function getVisibleRequests() {
  if (state.activeRole === 'Manager' || state.activeRole === 'HR') return state.requests;
  if (state.activeRole === 'Shift Employee') {
    const me = currentEmp();
    return state.requests.filter(req => req.requesterId === (me && me.id) || req.person === (me && me.name) || req.targetPerson === (me && me.name));
  }
  if (isSupervisorRoleName(state.activeRole)) {
    const supShift = getSupervisorShiftType(state.activeRole);
    return state.requests.filter(req => {
      if (req.api) return true; // ระบบหลังบ้านส่งมาเฉพาะคำขอที่หัวหน้ากะคนนี้เห็นได้
      const requester = empOf(req.requesterId, req.person);
      if (requester && requester.shiftType === supShift) return true;
      const target = req.targetPerson && empOf(req.targetId, req.targetPerson);
      return !!(target && target.shiftType === supShift);
    });
  }
  return state.requests;
}
