/* ==========================================================================
   คำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์ (LOCAL)
   ========================================================================== */

import { $, js } from '../../../shared/dom.js';
import { getHolidaysForYear } from '../../../shared/scheduling/annual.js';
import { parseThaiDate, shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { opt, ownSup } from '../form-parts.js';
import { done, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function holidayForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  const hols = getHolidaysForYear(y);
  if (!f.hol && hols.length) f.hol = hols[0];
  fields.push(`
    <div class="field"><label for="publicHolidaySelect">วันหยุดนักขัตฤกษ์ ปี ${y + 543}</label>
      ${hols.length ? `<select class="inp" id="publicHolidaySelect" data-change="SF.rq('hol', this.value)">${hols.map(h => opt(h, h, f.hol)).join('')}</select>` : '<p class="notice">ยังไม่มีวันหยุดนักขัตฤกษ์ของปีนี้ ผู้จัดการตั้งค่าได้ที่หน้าตารางรายปี</p>'}
    </div>`);
  const p = f.hol && parseThaiDate(f.hol);
  if (p) rows = p.days.map(d => ({ e: emp, date: shortDate(p.y, p.m, d), from: getShiftCodeForDate(emp, p.y, p.m, d), to: 'H' }));
  ready = !!hols.length;
  submit = `submitPublicHolidayChoice(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitPublicHolidayChoice(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const holiday = ($('#publicHolidaySelect') || {}).value;
  saveLocalRequest({
    type: 'สิทธิ์วันหยุดนักขัตฤกษ์', person: emp.name, requesterId: emp.id, initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: holiday, currentShift: '-', targetShift: 'H', reason: `ขอใช้สิทธิ์หยุดตามประกาศวันหยุดนักขัตฤกษ์ (${holiday})`, isCrossShift: false,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นขอใช้สิทธิ์วันหยุดนักขัตฤกษ์ (${holiday})`, emp);
  done('ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
}
