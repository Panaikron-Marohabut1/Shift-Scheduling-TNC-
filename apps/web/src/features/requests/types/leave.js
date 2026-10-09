/* ==========================================================================
   คำขอลา พร้อมเลือกเพื่อนในทีมมาทำ OT แทนได้ (LOCAL)
   ========================================================================== */

import { state } from '../../../app/state.js';
import { $, esc, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getAllEmployees, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { OT_PICK, validateOTRequest } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, ownSup, reasonField, retroField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function leaveForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  fields.push(`
    <div class="field"><label for="leaveReqTypeSelect">ประเภทการลา</label>
      <select class="inp" id="leaveReqTypeSelect" data-change="SF.rq('leave', this.value)">${['V', 'B', 'S', 'H'].map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.leave)).join('')}</select></div>`);
  fields.push(dateField('วันที่ลา', 'leaveReqDay'));
  const mates = getAllEmployees().filter(e => e.id !== emp.id && e.shiftType === emp.shiftType);
  fields.push(`
    <div class="field"><label for="leaveCoverSelect">ผู้มาทำงานแทน (ไม่บังคับ)</label>
      <select class="inp" id="leaveCoverSelect" data-change="SF.rq('cover', this.value)">
        ${opt('', 'ไม่ระบุ ให้หัวหน้ากะจัดคนแทนภายหลัง', f.cover)}
        ${mates.map(e => opt(e.id, `${e.name} · วันนั้น ${getShiftCodeForDate(e, y, m, f.day)}`, f.cover)).join('')}
      </select><small>ถ้าเลือก คนนั้นจะได้กะเป็น OT ในวันที่คุณลา</small></div>`);
  rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.leave }];
  ready = true;
  if (f.cover) {
    const c = findEmployeeById(f.cover);
    fields.push(`<div class="field"><label for="leaveCoverOtCode">OT ที่ ${esc(c.name)} ทำแทน</label>
      <select class="inp" id="leaveCoverOtCode" data-change="SF.rq('coverOt', this.value)">${OT_PICK.map(x => opt(x, `${getEmployeeFacingShiftLabel(x)} (${x})`, f.coverOt)).join('')}</select></div>`);
    const ot = validateOTRequest(c.id, f.day, f.coverOt);
    rows.push({ e: c, date: shortDate(y, m, f.day), from: getShiftCodeForDate(c, y, m, f.day), to: f.coverOt });
    checks = checksList(`ตรวจเงื่อนไข OT ของ ${c.name}`, ot.results);
    ready = ot.valid;
  }
  fields.push(reasonField('leaveReqReason'), retroField('leaveReqRetroactive'));
  submit = `submitLeaveRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitLeaveRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const leaveCode = ($('#leaveReqTypeSelect') || {}).value || 'V';
  const day = parseInt(($('#leaveReqDay') || {}).value, 10) || state.currentDay;
  const reason = ($('#leaveReqReason') || {}).value || '';
  const isRetroactive = !!($('#leaveReqRetroactive') || {}).checked;
  const coverId = ($('#leaveCoverSelect') || {}).value || '';
  const coverEmp = coverId ? findEmployeeById(coverId) : null;
  const coverOtCode = ($('#leaveCoverOtCode') || {}).value || 'MT';
  const dateLabel = `${day} ${monthText()}`;
  if (coverEmp && !validateOTRequest(coverId, day, coverOtCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่งผู้มาทำแทนไม่ผ่านเงื่อนไข', 'alert'); return; }
  const coverNote = coverEmp ? ` — มอบหมายให้ ${coverEmp.name} มาทำแทน (OT ${coverOtCode})` : '';
  saveLocalRequest({
    type: `ขอลา (${leaveCode})${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, day, leaveCode,
    coverId: coverEmp ? coverEmp.id : null, coverOtCode, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: coverEmp ? coverEmp.name : null, targetRole: coverEmp ? coverEmp.roleCategory : null, date: dateLabel,
    currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day) || '-', targetShift: leaveCode,
    reason: (reason || `ขอลา (${leaveCode}) วันที่ ${dateLabel}`) + coverNote, isCrossShift: false, isRetroactive,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอลา (${leaveCode}) วันที่ ${dateLabel}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}${coverEmp ? ` พร้อมมอบหมายให้ ${coverEmp.name} ทำ OT (${coverOtCode}) แทน` : ''}`, emp);
  done('ส่งคำขอลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}
