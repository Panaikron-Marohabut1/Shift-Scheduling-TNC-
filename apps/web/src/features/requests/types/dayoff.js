/* ==========================================================================
   คำขอเปลี่ยนวันหยุด ภายใน 7 วันจากวันหยุดเดิม (LOCAL)
   ========================================================================== */

import { $, esc, js } from '../../../shared/dom.js';
import { monthLabel, shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, opt, ownSup, reasonField, retroField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function dayoffForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  const offDays = Array.from({ length: n }, (_, i) => i + 1).filter(x => getShiftCodeForDate(emp, y, m, x) === 'O');
  fields.push(`
    <div class="field"><label for="dayOffOldSelect">วันหยุดเดิม</label>
      <select class="inp" id="dayOffOldSelect" data-change="SF.rq('oldDay', this.value)">
        ${offDays.length ? offDays.map(x => opt(x, shortDate(y, m, x), f.oldDay)).join('') : '<option value="">เดือนนี้ไม่มีวันหยุด</option>'}
      </select><small>${esc(monthLabel(y, m))} · เปลี่ยนเดือนได้ที่ปฏิทินกะของฉัน</small></div>`);
  const old = Number(f.oldDay);
  const cand = [];
  if (old) for (let x = Math.max(1, old - 7); x <= Math.min(n, old + 7); x++) if (x !== old) cand.push(x);
  fields.push(`
    <div class="field"><label for="dayOffNewDay">ย้ายวันหยุดไปวันที่</label>
      <select class="inp" id="dayOffNewDay" data-change="SF.rq('newDay', this.value)">
        ${opt('', 'เลือกวัน (ไม่เกิน 7 วันจากวันหยุดเดิม)', f.newDay)}
        ${cand.map(x => opt(x, `${shortDate(y, m, x)} · ปัจจุบัน ${getEmployeeFacingShiftLabel(getShiftCodeForDate(emp, y, m, x))}`, f.newDay)).join('')}
      </select></div>`);
  fields.push(reasonField('dayOffReason'), retroField('dayOffRetroactive'));
  const nd = Number(f.newDay);
  if (old && nd) {
    const work = (emp.shiftType === 'Shift A' || emp.shiftType === 'Shift C') ? 'M' : 'N';
    rows = [{ e: emp, date: shortDate(y, m, old), from: 'O', to: work }, { e: emp, date: shortDate(y, m, nd), from: getShiftCodeForDate(emp, y, m, nd), to: 'O' }];
    const within = Math.abs(nd - old) <= 7;
    checks = checksList('', [{ status: within ? 'pass' : 'fail', rule: 'กรอบเวลา', msg: within ? 'วันหยุดใหม่อยู่ภายใน 7 วันจากวันหยุดเดิม' : 'วันหยุดใหม่ต้องอยู่ภายใน 7 วันจากวันหยุดเดิม' }]);
    ready = within;
  }
  submit = `submitDayOffChangeRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitDayOffChangeRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const oldDay = parseInt(($('#dayOffOldSelect') || {}).value, 10);
  const newDay = parseInt(($('#dayOffNewDay') || {}).value, 10);
  const reason = ($('#dayOffReason') || {}).value || '';
  const isRetroactive = !!($('#dayOffRetroactive') || {}).checked;
  if (!oldDay || !newDay) { showToast('กรุณาระบุวันหยุดเดิมและวันหยุดใหม่ให้ครบถ้วน', 'alert'); return; }
  if (Math.abs(newDay - oldDay) > 7) { showToast('ไม่สามารถส่งคำขอได้ — วันหยุดใหม่ต้องอยู่ในกรอบ ±7 วันจากวันหยุดเดิม', 'alert'); return; }
  const dateLabel = `${oldDay} → ${newDay} ${monthText()}`;
  saveLocalRequest({
    type: `เปลี่ยนวันหยุด${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, oldDay, newDay, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: null, targetRole: null, date: dateLabel, currentShift: 'O', targetShift: 'O', reason: reason || `ขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}`,
    isCrossShift: false, isRetroactive, approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}`, emp);
  done('ส่งคำขอเปลี่ยนวันหยุดเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}
