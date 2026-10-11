/* ==========================================================================
   กฎตรวจคำขอ (ตามต้นแบบ ShiftFlow)
   --------------------------------------------------------------------------
   ทำงานต่อเนื่องไม่เกินที่ตั้งค่าไว้ (6 วัน) · ห้ามดึกต่อด้วยเช้าวันถัดไป · เงื่อนไข OT
   สิทธิ์สลับ/เปลี่ยนกะต่อเดือน · กรอบเวลา ±7 วัน · เพื่อนที่สลับได้ · ลำดับผู้อนุมัติ
   ========================================================================== */

import { state } from '../../app/state.js';
import { daysIn } from './dates.js';
import { findEmployeeById, getAllEmployees, getTeamKeyByLabel } from './employees.js';
import { getShiftCodeForDate, LEAVE } from './roster.js';

export const OT_PICK = ['MT', 'NT'];

/* ---------- กฎตรวจคำขอ ---------- */
function getShiftFamily(code) {
  const def = state.shiftDefs[code];
  if (!def) return 'OTHER';
  if (code === 'O') return 'O';
  if (def.leave) return 'LEAVE';
  if (code === 'D') return 'D';
  if (['M', 'MT', 'MTh'].includes(code)) return 'M';
  if (['N', 'NT', 'NTh'].includes(code)) return 'N';
  return 'OTHER';
}
function checkShiftTransitionRules(emp, targetDay, targetShiftCode) {
  const results = [];
  let hasHardBlock = false;
  const targetFamily = getShiftFamily(targetShiftCode);
  const currentCodeOnDay = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay);
  const currentFamily = getShiftFamily(currentCodeOnDay);
  const prevCode = targetDay > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;
  if (currentFamily === 'O') results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: 'วันดังกล่าวเดิมเป็นวันหยุด (O) — เปลี่ยนกะได้ทันที' });
  else results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: `วันดังกล่าวเดิมเป็นกะ ${currentCodeOnDay} — ตรวจสอบเงื่อนไขทิศทางกะด้านล่าง` });
  if (targetFamily === 'N') {
    results.push({ rule: 'เงื่อนไข 3: เปลี่ยนเป็นกะดึก (M→N / N→N)', status: 'pass', msg: 'อนุญาตให้เปลี่ยน/สลับเป็นกะดึกได้ — ตรวจสอบวันหยุดตามรอบ 6 วันด้านล่างประกอบ' });
  } else if (targetFamily === 'M') {
    if (prevFamily === 'N') {
      results.push({ rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า หลังกะดึก (N→M)', status: 'fail', msg: `วันก่อนหน้า (วันที่ ${targetDay - 1}) เป็นกะดึก (${prevCode}) — ห้ามสลับเป็นกะเช้าทันที ต้องมีวันหยุดคั่นอย่างน้อย 1 วันก่อนเข้ากะเช้า` });
      hasHardBlock = true;
    } else results.push({ rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า (M→M)', status: 'pass', msg: 'วันก่อนหน้าไม่ใช่กะดึก — อนุญาตให้เปลี่ยน/สลับเป็นกะเช้าได้' });
  }
  return { hasHardBlock, results };
}
export function validateShiftAssignment(empId, targetDay, targetShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, results: [] };
  const results = [];
  let hasHardBlock = false;
  const transition = checkShiftTransitionRules(emp, targetDay, targetShiftCode);
  results.push(...transition.results);
  if (transition.hasHardBlock) hasHardBlock = true;

  const n = daysIn(state.currentYear, state.currentMonth);
  const codes = Array.from({ length: n }, (_, i) => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, i + 1));
  codes[targetDay - 1] = targetShiftCode;
  let maxConsecutive = 0, streak = 0;
  for (const s of codes) { if (s !== 'O' && !LEAVE.has(s)) { streak++; if (streak > maxConsecutive) maxConsecutive = streak; } else streak = 0; }
  const maxDays = state.managerConfig.maxConsecutiveWorkDays;
  if (maxConsecutive > maxDays) {
    results.push({ rule: `วันทำงานติดต่อกันสูงสุด (Max ${maxDays} Days)`, status: 'fail', msg: `เกินเกณฑ์ ${maxDays} วันติดต่อกัน (นับได้ ${maxConsecutive} วัน) — ฝ่าฝืนกฎความปลอดภัยและกฎหมายแรงงาน` });
    hasHardBlock = true;
  } else if (maxConsecutive >= maxDays - 2) {
    results.push({ rule: 'วันทำงานติดต่อกัน', status: 'warn', msg: `ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน (ใกล้ครบกำหนด ต้องจัดวันหยุดชดเชย)` });
  } else {
    results.push({ rule: 'รอบการเข้ากะ (2-on 2-off Pattern)', status: 'pass', msg: `สอดคล้องกับรอบหมุนเวียน (ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน)` });
  }
  if (['MT', 'NT', 'MTh', 'NTh', 'OT'].includes(targetShiftCode)) results.push({ rule: 'ชั่วโมงล่วงเวลา (OT Check)', status: 'pass', msg: 'มีชั่วโมง OT ส่งต่องานกะ (บันทึกเข้า Payroll ตามอัตรา x1.5 / x3.0)' });
  else results.push({ rule: 'สังกัดชุดกะ', status: 'pass', msg: `ตรงตามรหัสพนักงาน ${emp.code} (${emp.shiftType})` });
  const diff = Math.abs(targetDay - state.currentDay);
  if (diff > 7) results.push({ rule: 'กรอบเวลาการขอปรับเปลี่ยน (±7 วัน)', status: 'warn', msg: `วันที่ ${targetDay} อยู่นอกกรอบ ±7 วันจากปัจจุบัน (${state.currentDay})` });
  else results.push({ rule: 'กรอบเวลายื่นเรื่อง', status: 'pass', msg: 'อยู่ภายในกรอบเวลาที่ระบบอนุญาต (±7 วัน)' });
  const used = countMonthlySwapRequests(empId), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) {
    results.push({ rule: `สิทธิ์คำขอสลับ/เปลี่ยนกะ (สูงสุด ${limit} ครั้ง/เดือน)`, status: 'fail', msg: `ใช้สิทธิ์ไปแล้ว ${used}/${limit} ครั้ง — ระบบไม่อนุญาตให้ยื่นคำขอเพิ่มในเดือนนี้` });
    hasHardBlock = true;
  } else results.push({ rule: 'สิทธิ์คำขอสลับ/เปลี่ยนกะ', status: 'pass', msg: `ใช้สิทธิ์ไปแล้ว ${used}/${limit} ครั้งในเดือนนี้` });
  return { valid: !hasHardBlock, results };
}
export function validateSwapBothSides(empAId, empBId, day) {
  const empA = findEmployeeById(empAId), empB = findEmployeeById(empBId);
  if (!empA || !empB) return { valid: false, sideA: { results: [] }, sideB: { results: [] } };
  const aOldCode = getShiftCodeForDate(empA, state.currentYear, state.currentMonth, day);
  const bOldCode = getShiftCodeForDate(empB, state.currentYear, state.currentMonth, day);
  const sideA = validateShiftAssignment(empAId, day, bOldCode);
  const sideB = validateShiftAssignment(empBId, day, aOldCode);
  return { valid: sideA.valid && sideB.valid, sideA, sideB, aOldCode, bOldCode, aNewCode: bOldCode, bNewCode: aOldCode };
}
export function validateOTRequest(empId, day, otShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, results: [], requiresManagerSpecialReview: false };
  const base = validateShiftAssignment(empId, day, otShiftCode);
  const results = [...base.results];
  let hasHardBlock = !base.valid;
  const prevCode = day > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;
  if (getShiftFamily(otShiftCode) === 'M' && prevFamily === 'N') {
    results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า (OT กะเช้า)', status: 'fail', msg: `พบว่าทำกะดึกในวันก่อนหน้า (วันที่ ${day - 1}) — ไม่อนุญาตให้ทำ OT กะเช้าต่อทันที ต้องพักก่อนอย่างน้อย 1 วัน` });
    hasHardBlock = true;
  } else results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า', status: 'pass', msg: 'ไม่พบการทำกะดึกในวันก่อนหน้าที่กระทบต่อการทำ OT' });
  if (prevFamily === 'O') results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'pass', msg: `วันก่อนหน้า (วันที่ ${day - 1}) เป็นวันหยุด — พร้อมสำหรับการทำ OT` });
  else results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'warn', msg: `วันก่อนหน้าไม่ใช่วันหยุด (เป็นกะ ${prevCode || '-'}) — โปรดพิจารณาความเหนื่อยล้าก่อนอนุมัติ` });
  const onVacation = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day) === 'V';
  if (onVacation) results.push({ rule: 'กรณีพิเศษ: ขอ OT ระหว่างลาพักร้อน', status: 'warn', msg: 'พนักงานอยู่ในช่วงลาพักร้อน (V) — การขอ OT ระหว่างวันลาต้องได้รับอนุมัติพิเศษจากผู้จัดการเป็นกรณีๆ ไป (ไม่บล็อกอัตโนมัติ)' });
  return { valid: !hasHardBlock, results, requiresManagerSpecialReview: onVacation };
}
// นับเฉพาะคำขอของเดือนที่กำลังดู (คำขอที่ไม่อนุมัติหรือยกเลิกแล้วไม่นับ)
export function countMonthlySwapRequests(employeeId) {
  if (!employeeId) return 0;
  return state.requests.filter(r => r.type && (r.type.includes('สลับกะ') || r.type.includes('เปลี่ยนกะ')) && r.requesterId === employeeId
    && r.status !== 'ไม่อนุมัติ' && r.status !== 'ยกเลิกแล้ว'
    && (r.y == null || (r.y === state.currentYear && r.m === state.currentMonth))).length;
}
// หัวหน้ากะสลับได้เฉพาะกับหัวหน้ากะทีมอื่น / พนักงานสลับได้เฉพาะกับพนักงานทีมอื่น
export function getEligibleSwapColleagues(aEmp) {
  const others = getAllEmployees().filter(e => e.id !== aEmp.id);
  if (aEmp.roleCategory === 'Shift Supervisor') return others.filter(e => e.roleCategory === 'Shift Supervisor' && e.shiftType !== aEmp.shiftType);
  return others.filter(e => e.shiftType !== aEmp.shiftType && e.roleCategory !== 'Shift Supervisor');
}
// ลำดับผู้อนุมัติสลับกะ: หัวหน้ากะของทั้งสองทีม
export function buildApprovalChain(aEmp, bEmp) {
  const sup = e => { const t = state.shiftsData[getTeamKeyByLabel(e.shiftType)]; return t ? t.employees.find(x => x.id === t.supervisorId) : null; };
  const letter = e => e.shiftType.replace('Shift ', '').trim();
  const name = e => { const s = sup(e); return s ? s.name.split(' ')[0] : `กะ ${letter(e)}`; };
  const chain = [];
  if (bEmp) {
    chain.push({ role: `Shift Supervisor ${letter(bEmp)} (${name(bEmp)})`, status: 'pending' });
    chain.push({ role: `Shift Supervisor ${letter(aEmp)} (${name(aEmp)})`, status: 'pending' });
  } else chain.push({ role: `Shift Supervisor ${letter(aEmp)} (${name(aEmp)})`, status: 'pending' });
  return { chain, isCrossTeam: true };
}
