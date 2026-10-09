/* ==========================================================================
   คำขอเปลี่ยนกะของตัวเอง (LOCAL)
   ========================================================================== */

import { state } from '../../../app/state.js';
import { $, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { currentEmp } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { countMonthlySwapRequests, validateOTRequest, validateShiftAssignment } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, ownSup } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function changeForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  fields.push(dateField('วันที่ต้องการเปลี่ยนกะ'));
  const groups = [['กะเช้า', ['M', 'MT']], ['กะดึก', ['N', 'NT']], ['อื่น ๆ', ['D', 'O']], ['ลา/หยุด', ['V', 'B', 'S', 'H']]];
  fields.push(`
    <div class="field"><label for="modalShiftSelect">กะที่ต้องการ</label>
      <select class="inp" id="modalShiftSelect" data-change="SF.rq('code', this.value)">
        ${groups.map(([g, codes]) => `<optgroup label="${g}">${codes.map(c => opt(c, `${c} · ${state.shiftDefs[c].label}`, f.code)).join('')}</optgroup>`).join('')}
      </select></div>`);
  const isOT = state.shiftDefs[f.code] && state.shiftDefs[f.code].ot;
  const v = isOT ? validateOTRequest(emp.id, f.day, f.code) : validateShiftAssignment(emp.id, f.day, f.code);
  rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.code }];
  checks = checksList(`ตรวจกฎของ ${emp.name}`, v.results);
  approvers = isOT ? [`หัวหน้ากะตรวจสอบ (${emp.shiftType})`, 'ผู้จัดการอนุมัติ OT'] : [ownSup(emp)];
  ready = v.valid && f.code !== myCode;
  submit = `submitOperatorShiftRequest(${js(emp.id)}, ${f.day}, 'change')`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitOperatorShiftRequest(targetEmpId, dayNum) {
  const emp = currentEmp();
  const shiftCode = ($('#modalShiftSelect') || {}).value;
  if (!emp || !shiftCode) return;
  const used = countMonthlySwapRequests(emp.id), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) { showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${limit} ครั้ง/เดือนแล้ว`, 'alert'); return; }
  const isOT = state.shiftDefs[shiftCode] && state.shiftDefs[shiftCode].ot;
  const requestType = isOT ? 'ขอทำ OT' : 'ขอเปลี่ยนกะ';
  const dateLabel = `${dayNum} ${monthText('short')}`;
  saveLocalRequest({
    type: requestType, person: emp.name, requesterId: emp.id, day: Number(dayNum), initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: dateLabel, currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, dayNum), targetShift: shiftCode,
    reason: isOT ? `ขอทำ OT (${shiftCode}) วันที่ ${dateLabel}` : `ขอเปลี่ยนกะของฉันเป็น ${shiftCode}`, isCrossShift: false,
    approvers: isOT ? [{ role: `หัวหน้ากะตรวจสอบ (${emp.shiftType})`, status: 'pending' }, { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }] : [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }],
    status: 'รอดำเนินการ', quotaUsed: `${used + 1} / ${limit} ครั้ง`
  }, `${requestType}วันที่ ${dateLabel}`, emp);
  done(`ส่ง${requestType}เรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${used + 1}/${limit} ครั้งในเดือนนี้)`);
}
