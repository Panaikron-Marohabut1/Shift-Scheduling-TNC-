/* ==========================================================================
   คำขอลา (LOCAL)
   --------------------------------------------------------------------------
   ต้องระบุคนมาทำแทนทุกครั้ง (ทีมไหนก็ได้) คนที่มาแทนได้กะเป็น OT ในวันที่ลา
   ข้อตกลงกับหัวหน้ากะ: เปลี่ยนกะหรือหยุดโดยไม่มีคนแทนไม่ได้
   อนุมัติ 2 ฝั่ง: หัวหน้ากะของผู้ลา แล้วหัวหน้ากะของคนที่มาแทน
   (คนมาแทนอยู่ทีมเดียวกัน → ฝั่งที่ 2 เป็นผู้จัดการฝ่ายผลิต)
   ตัวอย่าง: B รับมาทำแทน A ไว้แล้วแต่มาไม่ได้ → B ยื่นลาวันนั้น แล้วเลือก C มาทำแทน
   ========================================================================== */

import { state, view } from '../../../app/state.js';
import { esc, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getAllEmployees, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { leaveApprovalChain, OT_PICK, validateOTRequest } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, reasonField, retroField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

const LEAVE_CODES = ['V', 'B', 'S'];
// คนที่มาแทนได้: ตำแหน่งเดียวกัน (หัวหน้ากะแทนหัวหน้ากะ / พนักงานแทนพนักงาน) ทุกทีม
const coversFor = emp => getAllEmployees().filter(e => e.id !== emp.id && (e.roleCategory === 'Shift Supervisor') === (emp.roleCategory === 'Shift Supervisor'));

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function leaveForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [], ready = false, submit = '', note = '';
  if (!LEAVE_CODES.includes(f.leave)) f.leave = 'V';
  fields.push(`
    <div class="field"><label for="leaveReqTypeSelect">ประเภทการลา</label>
      <select class="inp" id="leaveReqTypeSelect" data-change="SF.rq('leave', this.value)">${LEAVE_CODES.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.leave)).join('')}</select></div>`);
  fields.push(dateField('วันที่ลา', 'leaveReqDay'));
  const groups = {};
  coversFor(emp).forEach(e => { (groups[e.shiftType] = groups[e.shiftType] || []).push(e); });
  fields.push(`
    <div class="field"><label for="leaveCoverSelect">คนที่มาทำงานแทน (จำเป็น)</label>
      <select class="inp" id="leaveCoverSelect" data-change="SF.rq('cover', this.value)">
        ${opt('', 'เลือกคนที่มาทำแทน (จำเป็น)', f.cover)}
        ${Object.keys(groups).sort().map(t => `<optgroup label="${esc(t)}">${groups[t].map(e => opt(e.id, `${e.name} · วันนั้น ${getShiftCodeForDate(e, y, m, f.day)}`, f.cover)).join('')}</optgroup>`).join('')}
      </select><small>คนที่มาแทนจะได้กะเป็น OT ในวันที่คุณลา · คนมาแทนต่างทีม หัวหน้ากะของทีมนั้นอนุมัติเป็นฝั่งที่ 2</small></div>`);
  rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.leave }];
  const c = f.cover && findEmployeeById(f.cover);
  if (!c) note = '<p class="notice">ต้องเลือกคนที่มาทำแทนก่อน จึงจะส่งใบลาได้ (ลาโดยไม่มีคนแทนไม่ได้)</p>';
  if (c) {
    fields.push(`<div class="field"><label for="leaveCoverOtCode">OT ที่ ${esc(c.name)} ทำแทน</label>
      <select class="inp" id="leaveCoverOtCode" data-change="SF.rq('coverOt', this.value)">${OT_PICK.map(x => opt(x, `${getEmployeeFacingShiftLabel(x)} (${x})`, f.coverOt)).join('')}</select></div>`);
    const ot = validateOTRequest(c.id, f.day, f.coverOt);
    rows.push({ e: c, date: shortDate(y, m, f.day), from: getShiftCodeForDate(c, y, m, f.day), to: f.coverOt });
    checks = checksList(`ตรวจเงื่อนไข OT ของ ${c.name}`, ot.results);
    ready = ot.valid;
  }
  approvers = leaveApprovalChain(emp, c || null);
  fields.push(reasonField('leaveReqReason'), retroField('leaveReqRetroactive'));
  submit = `submitLeaveRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitLeaveRequest(empId) {
  const emp = findEmployeeById(empId);
  const f = view.rq || {};
  if (!emp) return;
  const y = state.currentYear, m = state.currentMonth;
  const leaveCode = LEAVE_CODES.includes(f.leave) ? f.leave : 'V';
  const day = Number(f.day) || state.currentDay;
  const reason = String(f.reason || '').trim();
  const isRetroactive = !!f.retro;
  const coverEmp = f.cover ? findEmployeeById(f.cover) : null;
  const coverOtCode = f.coverOt || 'MT';
  const dateLabel = `${day} ${monthText()}`;
  if (!coverEmp) { showToast('กรุณาเลือกคนที่มาทำแทน — ลาโดยไม่มีคนแทนไม่ได้', 'alert'); return; }
  if (!validateOTRequest(coverEmp.id, day, coverOtCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่งผู้มาทำแทนไม่ผ่านเงื่อนไข', 'alert'); return; }
  const coverNote = ` — ${coverEmp.name} มาทำแทน (OT ${coverOtCode})`;
  const roles = leaveApprovalChain(emp, coverEmp);
  const changes = [{ empId: emp.id, y, m, d: day, to: leaveCode }];
  changes.push({ empId: coverEmp.id, y, m, d: day, to: coverOtCode });
  saveLocalRequest({
    kind: 'leave', type: `ขอลา (${leaveCode})${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, day, leaveCode,
    coverId: coverEmp ? coverEmp.id : null, coverOtCode, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: coverEmp ? coverEmp.name : null, targetRole: coverEmp ? coverEmp.roleCategory : null, date: dateLabel,
    currentShift: getShiftCodeForDate(emp, y, m, day) || '-', targetShift: leaveCode,
    reason: (reason || `ขอลา (${leaveCode}) วันที่ ${dateLabel}`) + coverNote, isCrossShift: !!(coverEmp && coverEmp.shiftType !== emp.shiftType), isRetroactive,
    changes, approvers: roles.map(role => ({ role, status: 'pending' })), status: 'รออนุมัติครบ 2 ฝ่าย', quotaUsed: '-'
  }, `ยื่นคำขอลา (${leaveCode}) วันที่ ${dateLabel}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}${coverEmp ? ` ให้ ${coverEmp.name} มาทำแทน (OT ${coverOtCode})` : ''}`, emp);
  done('ส่งคำขอลาเรียบร้อยแล้ว · รออนุมัติ 2 ฝั่ง');
}
