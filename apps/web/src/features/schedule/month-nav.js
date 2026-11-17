/* ==========================================================================
   ตัวเลือกเดือน และสถานะของเดือน (ประกาศใช้ / ล็อก / ยื่นคำขอได้) ใช้ร่วมกันระหว่างตารางกะและกะของฉัน
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { isYearPublished } from '../../shared/scheduling/annual.js';
import { daysIn, monthLabel, thaiMonthName } from '../../shared/scheduling/dates.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { dataMonth, hasPilotProjection, hasScheduleDataForMonth, isMonthLocked, isSchedulePublished } from '../../shared/scheduling/roster.js';
import { hasClosedRosterAccess } from '../hr/closed-roster.js';
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
            ${Array.from({ length: 12 }, (_, i) => {
              const hasData = hasScheduleDataForMonth(y, i);
              const hint = hasData ? 'มีข้อมูลตารางกะจริง' : hasPilotProjection(y, i) ? 'ตารางกะคาดการณ์' : 'ยังไม่มีข้อมูล';
              return `<button class="${i === m ? 'on' : ''} ${hasData ? 'has' : ''}" data-click="jumpToScheduleMonth(${y}, ${i})" title="${hint}">${esc(thaiMonthName(i, 'short'))}</button>`;
            }).join('')}
          </div>
          <button class="link mpick-go" data-click="jumpToScheduleMonth(${base.y}, ${base.m})">ไปเดือนที่มีข้อมูลจริง (${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543})</button>
        </div>` : ''}
    </div>`;
}

export function scheduleState() {
  const y = state.currentYear, m = state.currentMonth;
  const monthLocked = isMonthLocked(y, m);
  const readOnly = state.activeRole === 'HR';
  const published = isSchedulePublished(y, m);
  return {
    y, m, n: daysIn(y, m), monthLocked, readOnly, published,
    hasData: hasScheduleDataForMonth(y, m),
    projected: hasPilotProjection(y, m),
    canPublish: !state.actor?.remotePilot && state.activeRole === 'Manager' && !isYearPublished(y),
    canExport: !state.actor?.remotePilot && (state.activeRole === 'Manager' || (readOnly && !hasClosedRosterAccess())),
    canInteract: !monthLocked && !readOnly && published,
    viewer: (isSupervisorRoleName(state.activeRole) || state.activeRole === 'Shift Employee') ? currentEmp() : null,
    hol: holidaysOf(y)
  };
}
// สถานะของเดือน (ใช้ร่วมกันระหว่างตารางกะและกะของฉัน)
export function statusChips(S, { holidayOvertimePreview = false } = {}) {
  const preview = holidayOvertimePreview ? '<span class="st">OT นักขัตฤกษ์ · ผลคำนวณย้อนหลัง</span>' : '';
  if (S.projected) return '<span class="st warn">ตารางกะคาดการณ์ · ดูได้อย่างเดียว</span>' + preview;
  const status = [];
  status.push(S.published ? '<span class="st ok">ประกาศใช้แล้ว</span>' : '<span class="st warn">ฉบับร่าง ยังไม่ประกาศใช้</span>');
  if (!S.hasData) status.push(`<span class="st warn">${state.actor?.remotePilot ? 'ยังไม่มีตารางกะในฐานทดสอบ' : 'ตารางคาดการณ์ ยังไม่มีข้อมูลจริง'}</span>`);
  if (S.readOnly) status.push('<span class="st">ดูข้อมูลอย่างเดียว</span>');
  else if (S.monthLocked) status.push('<span class="st">ข้อมูลถูกล็อก</span>');
  else if (S.published) status.push('<span class="st ok">ยื่นคำขอได้</span>');
  return status.join('') + preview;
}
