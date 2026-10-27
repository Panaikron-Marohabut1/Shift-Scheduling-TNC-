/* ==========================================================================
   คำขอ "วันหยุดนักขัตฤกษ์" — ย้ายวันหยุด / วันหยุดนักขัตฤกษ์ไปวันอื่น (LOCAL)
   --------------------------------------------------------------------------
   เลือกวันหยุดเดิม → เลือกวันทำงานที่จะหยุดแทน (ภายใน 7 วัน และอยู่ในเดือนเดียวกัน)
   → เลือกว่าจะไปทำกะอะไรในวันหยุดเดิม (กะเช้า / กะดึก)
   ========================================================================== */

import { state, view } from '../../../app/state.js';
import { esc, js } from '../../../shared/dom.js';
import { monthLabel, shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, opt, ownSup, reasonField, retroField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';
import { holidaysOf } from '../../schedule/days.js';

const WORK_CODES = ['M', 'N'];
const family = code => (state.shiftDefs[code] || {}).family;
// วันหยุดเดิมที่ย้ายได้: วันหยุดประจำสัปดาห์ (O) หรือวันหยุดนักขัตฤกษ์ในเดือนนั้น
export function movableOffDays(emp, y, m, n) {
  const hol = holidaysOf(y);
  return Array.from({ length: n }, (_, i) => i + 1).filter(d => {
    const c = getShiftCodeForDate(emp, y, m, d);
    return c === 'O' || c === 'H' || (hol[`${m}-${d}`] && !(state.shiftDefs[c] || {}).leave);
  });
}
// วันที่จะหยุดแทน: วันทำงาน (กะเช้า/ดึก) ภายใน 7 วันจากวันหยุดเดิม ในเดือนเดียวกัน
function workDaysNear(emp, y, m, n, old) {
  const out = [];
  for (let d = Math.max(1, old - 7); d <= Math.min(n, old + 7); d++) if (d !== old && ['M', 'N', 'D'].includes(family(getShiftCodeForDate(emp, y, m, d)))) out.push(d);
  return out;
}
const offLabel = (emp, y, m, d) => {
  const hol = holidaysOf(y)[`${m}-${d}`];
  return `${shortDate(y, m, d)} · ${hol ? `วันหยุดนักขัตฤกษ์ ${hol}` : getEmployeeFacingShiftLabel(getShiftCodeForDate(emp, y, m, d))}`;
};

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function dayoffForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  const offs = movableOffDays(emp, y, m, n);
  if (f.oldDay && !offs.includes(Number(f.oldDay))) f.oldDay = offs[0] || '';
  fields.push(`
    <div class="field"><label for="dayOffOldSelect">วันหยุดเดิม (วันที่จะไปทำงานแทน)</label>
      <select class="inp" id="dayOffOldSelect" data-change="SF.rq('oldDay', this.value)">
        ${offs.length ? offs.map(d => opt(d, offLabel(emp, y, m, d), f.oldDay)).join('') : '<option value="">เดือนนี้ไม่มีวันหยุด</option>'}
      </select><small>${esc(monthLabel(y, m))} · เปลี่ยนเดือนได้ที่ปฏิทินกะของฉัน</small></div>`);
  const old = Number(f.oldDay);
  const cand = old ? workDaysNear(emp, y, m, n, old) : [];
  fields.push(`
    <div class="field"><label for="dayOffNewDay">วันที่จะหยุดแทน</label>
      <select class="inp" id="dayOffNewDay" data-change="SF.rq('newDay', this.value)">
        ${opt('', 'เลือกวัน (วันทำงาน ไม่เกิน 7 วันจากวันหยุดเดิม)', f.newDay)}
        ${cand.map(d => opt(d, `${shortDate(y, m, d)} · ปัจจุบัน${getEmployeeFacingShiftLabel(getShiftCodeForDate(emp, y, m, d))}`, f.newDay)).join('')}
      </select></div>`);
  const nd = Number(f.newDay);
  // กะที่จะไปทำในวันหยุดเดิม: ตั้งต้นเป็นกะเดียวกับวันที่จะหยุดแทน
  if (!WORK_CODES.includes(f.workCode)) {
    const fam = nd ? family(getShiftCodeForDate(emp, y, m, nd)) : '';
    f.workCode = fam === 'N' ? 'N' : 'M';
  }
  fields.push(`
    <div class="field"><label for="dayOffWorkCode">กะที่จะไปทำในวันหยุดเดิม</label>
      <select class="inp" id="dayOffWorkCode" data-change="SF.rq('workCode', this.value)">${WORK_CODES.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c}) · ${state.shiftDefs[c].time}`, f.workCode)).join('')}</select></div>`);
  fields.push(reasonField('dayOffReason'), retroField('dayOffRetroactive'));
  if (old && nd) {
    const oldCode = getShiftCodeForDate(emp, y, m, old);
    rows = [
      { e: emp, date: shortDate(y, m, old), from: oldCode, to: f.workCode },
      { e: emp, date: shortDate(y, m, nd), from: getShiftCodeForDate(emp, y, m, nd), to: oldCode === 'H' ? 'H' : 'O' }
    ];
    const within = Math.abs(nd - old) <= 7;
    checks = checksList('', [
      { status: within ? 'pass' : 'fail', rule: 'กรอบเวลา', msg: within ? 'วันที่หยุดแทนอยู่ภายใน 7 วันจากวันหยุดเดิม' : 'วันที่หยุดแทนต้องอยู่ภายใน 7 วันจากวันหยุดเดิม' },
      { status: 'pass', rule: 'เดือนเดียวกัน', msg: 'เปลี่ยนภายในเดือนเดียวกัน' }
    ]);
    ready = within;
  }
  submit = `submitDayOffChangeRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitDayOffChangeRequest(empId) {
  const emp = findEmployeeById(empId);
  const f = view.rq || {};
  if (!emp) return;
  const y = state.currentYear, m = state.currentMonth;
  const oldDay = Number(f.oldDay), newDay = Number(f.newDay);
  const workCode = WORK_CODES.includes(f.workCode) ? f.workCode : 'M';
  const reason = String(f.reason || '').trim();
  const isRetroactive = !!f.retro;
  if (!oldDay || !newDay) { showToast('กรุณาเลือกวันหยุดเดิมและวันที่จะหยุดแทนให้ครบ', 'alert'); return; }
  if (Math.abs(newDay - oldDay) > 7) { showToast('ไม่สามารถส่งคำขอได้ — วันที่หยุดแทนต้องอยู่ภายใน 7 วันจากวันหยุดเดิม', 'alert'); return; }
  const oldCode = getShiftCodeForDate(emp, y, m, oldDay);
  const offCode = oldCode === 'H' ? 'H' : 'O';
  const hol = holidaysOf(y)[`${m}-${oldDay}`];
  const dateLabel = `${oldDay} → ${newDay} ${monthText()}`;
  saveLocalRequest({
    kind: 'dayoff', type: `วันหยุดนักขัตฤกษ์ (ย้ายวันหยุด)${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, oldDay, newDay, workCode,
    initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null, date: dateLabel, currentShift: oldCode, targetShift: workCode,
    reason: reason || `ไปทำ${getEmployeeFacingShiftLabel(workCode)}วันที่ ${oldDay}${hol ? ` (${hol})` : ''} และหยุดแทนวันที่ ${newDay}`,
    changes: [{ empId: emp.id, y, m, d: oldDay, to: workCode }, { empId: emp.id, y, m, d: newDay, to: offCode }],
    isCrossShift: false, isRetroactive, approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอย้ายวันหยุดจากวันที่ ${oldDay} (ไปทำ ${workCode}) เป็นหยุดวันที่ ${newDay}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}`, emp);
  done('ส่งคำขอวันหยุดนักขัตฤกษ์ (ย้ายวันหยุด) เรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}
