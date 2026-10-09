/* ==========================================================================
   คำขอทำ OT เต็มกะหรือครึ่งวัน (LOCAL)
   ========================================================================== */

import { state } from '../../../app/state.js';
import { $, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { OT_PICK, validateOTRequest } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, ownSup, reasonField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function otForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  fields.push(dateField('วันที่ต้องการทำ OT', 'otReqDay'));
  fields.push(`
    <div class="field"><label for="otReqCode">รูปแบบ OT</label>
      <select class="inp" id="otReqCode" data-change="SF.rq('ot', this.value)">${OT_PICK.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.ot)).join('')}</select></div>`);
  fields.push(reasonField('otReqReason'));
  const v = validateOTRequest(emp.id, f.day, f.ot);
  rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.ot }];
  checks = checksList(`ตรวจกฎของ ${emp.name}`, v.results);
  if (v.requiresManagerSpecialReview) note = '<p class="notice">วันนี้อยู่ระหว่างลาพักร้อน ต้องได้รับอนุมัติพิเศษจากผู้จัดการ</p>';
  ready = v.valid;
  submit = `submitOTRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitOTRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const day = parseInt(($('#otReqDay') || {}).value, 10);
  const otCode = ($('#otReqCode') || {}).value || 'MT';
  const reason = ($('#otReqReason') || {}).value || '';
  if (!day) { showToast('กรุณาระบุวันที่ต้องการทำงานล่วงเวลา', 'alert'); return; }
  if (!validateOTRequest(empId, day, otCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert'); return; }
  const dateLabel = `${day} ${monthText()}`;
  saveLocalRequest({
    type: 'ขอทำ OT', person: emp.name, requesterId: emp.id, day, initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: dateLabel, currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day), targetShift: otCode,
    reason: reason || `ขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`, isCrossShift: false,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`, emp);
  done('ส่งคำขอทำงานล่วงเวลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}
