/* ==========================================================================
   พนักงานและบทบาท: รายชื่อทุกทีม ค้นหาพนักงาน ชื่อตำแหน่งภาษาไทย และผู้ใช้ที่เข้าสู่ระบบอยู่
   ========================================================================== */

import { state } from '../../app/state.js';

export const TEAM_KEYS = ['shiftA', 'shiftB', 'shiftC', 'shiftD'];
/* ---------- พนักงาน ---------- */
export function getAllEmployees() { return TEAM_KEYS.reduce((all, k) => all.concat(state.shiftsData[k].employees), []); }
export function findEmployeeById(id) { return getAllEmployees().find(e => e.id === String(id)); }
export function getTeamKeyByLabel(label) { return { 'Shift A': 'shiftA', 'Shift B': 'shiftB', 'Shift C': 'shiftC', 'Shift D': 'shiftD' }[label]; }
export function isSupervisorRoleName(roleName) { return /^Shift Supervisor [A-D]$/.test(roleName || ''); }
export function getSupervisorShiftType(roleName) { return isSupervisorRoleName(roleName) ? `Shift ${roleName.slice(-1)}` : 'Shift A'; }
export function getEmployeeFacingRoleLabel(roleCategory) { return { 'Shift Supervisor': 'หัวหน้ากะ', 'Shift Employee': 'พนักงานปฏิบัติ' }[roleCategory] || roleCategory; }
export function getEmployeeFacingShiftLabel(code) {
  const labels = {
    M: 'กะเช้า', MT: 'กะเช้าพร้อมทำงานล่วงเวลา', MTh: 'กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน',
    N: 'กะดึก', NT: 'กะดึกพร้อมทำงานล่วงเวลา', NTh: 'กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน',
    OT: 'ทำงานล่วงเวลา (OT)', D: 'เวลาทำการปกติ', O: 'วันหยุด',
    V: 'ลาพักร้อน', B: 'ลากิจ', S: 'ลาป่วย', H: 'วันหยุดนักขัตฤกษ์', VG: 'ลาอื่นๆ', VGh: 'ลาอื่นๆ ครึ่งวัน'
  };
  return labels[code] || (state.shiftDefs[code] && state.shiftDefs[code].label) || code;
}
// ผู้ใช้ที่เข้าสู่ระบบ (เฉพาะหัวหน้ากะและพนักงาน)
export function currentEmp() {
  const a = state.actor;
  if (!a || a.employeeId == null) return null;
  return getAllEmployees().find(e => e.eid === a.employeeId) || null;
}
