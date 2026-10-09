/* ==========================================================================
   ตัวเลือกเดือน และสถานะของเดือน (ประกาศใช้ / ล็อก / ยื่นคำขอได้) ใช้ร่วมกันระหว่างตารางกะและกะของฉัน
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { isYearPublished } from '../../shared/scheduling/annual.js';
import { daysIn, monthLabel, thaiMonthName } from '../../shared/scheduling/dates.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { dataMonth, hasScheduleDataForMonth, isMonthLocked } from '../../shared/scheduling/roster.js';
import { holidaysOf } from './days.js';

export function monthNav(withPicker) {
  const y = state.currentYear, m = state.currentMonth;
  const base = dataMonth();
  return `
    <div class="mnav">
      <button class="sq" data-click="changeScheduleMonth(-1)" aria-label="เดือนก่อนหน้า">${icon('left')}</button>
      ${withPicker ? `<button class="mnav-label" data-click="toggleMonthPicker()" aria-expanded="${!!state.monthPickerOpen}">${esc(monthLabel(y, m))}</button>` : `<span class="mnav-label">${esc(monthLabel(y, m))}</span>`}
      <button class="sq" data-click="changeScheduleMonth(1)" aria-label="เดือนถัดไป">${icon('right')}</button>
      ${withPicker && state.monthPickerOpen ? `
        <div class="mpick-bg" data-click="toggleMonthPicker(false)"></div>
        <div class="mpick" role="dialog" aria-label="เลือกเดือน">
          <div class="mpick-year">
            <button class="sq" data-click="jumpToScheduleMonth(${y - 1}, ${m})" aria-label="ปีก่อนหน้า">${icon('left')}</button>
            <b>${y + 543}</b>
            <button class="sq" data-click="jumpToScheduleMonth(${y + 1}, ${m})" aria-label="ปีถัดไป">${icon('right')}</button>
          </div>
          <div class="mpick-grid">
            ${Array.from({ length: 12 }, (_, i) => `<button class="${i === m ? 'on' : ''} ${hasScheduleDataForMonth(y, i) ? 'has' : ''}" data-click="jumpToScheduleMonth(${y}, ${i})" title="${hasScheduleDataForMonth(y, i) ? 'มีข้อมูลตารางกะจริง' : 'ยังไม่มีข้อมูล'}">${esc(thaiMonthName(i, 'short'))}</button>`).join('')}
          </div>
          <button class="link mpick-go" data-click="jumpToScheduleMonth(${base.y}, ${base.m})">ไปเดือนที่มีข้อมูลจริง (${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543})</button>
        </div>` : ''}
    </div>`;
}

export function scheduleState() {
  const y = state.currentYear, m = state.currentMonth;
  const monthLocked = isMonthLocked(y, m);
  const readOnly = state.activeRole === 'HR';
  const published = isYearPublished(y);
  return {
    y, m, n: daysIn(y, m), monthLocked, readOnly, published,
    hasData: hasScheduleDataForMonth(y, m),
    canPublish: state.activeRole === 'Manager' && !published,
    canExport: state.activeRole === 'Manager' || state.activeRole === 'HR',
    canInteract: !monthLocked && !readOnly && published,
    viewer: (isSupervisorRoleName(state.activeRole) || state.activeRole === 'Shift Employee') ? currentEmp() : null,
    hol: holidaysOf(y)
  };
}
// สถานะของเดือน (ใช้ร่วมกันระหว่างตารางกะและกะของฉัน)
export function statusChips(S) {
  const status = [];
  status.push(S.published ? `<span class="st ok">ประกาศใช้แล้ว ปี ${S.y + 543}</span>` : `<span class="st warn">ฉบับร่าง ปี ${S.y + 543} ยังไม่ประกาศใช้</span>`);
  if (!S.hasData) status.push('<span class="st warn">ตารางคาดการณ์ ยังไม่มีข้อมูลจริง</span>');
  if (S.readOnly) status.push('<span class="st">ดูข้อมูลอย่างเดียว</span>');
  else if (S.monthLocked) status.push('<span class="st">ข้อมูลถูกล็อก</span>');
  else if (S.published) status.push('<span class="st ok">ยื่นคำขอได้</span>');
  return status.join('');
}
