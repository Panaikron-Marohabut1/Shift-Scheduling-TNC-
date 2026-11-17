/* ==========================================================================
   มุมมองรายวัน: ใครเข้ากะเช้า กะดึก หยุด หรือลา ในวันนั้น พร้อมเบอร์โทร
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { isoOf, TH_DW } from '../../shared/scheduling/dates.js';
import { hasCentralHolidayCalendar } from '../../shared/scheduling/annual.js';
import { getCalendarShiftCode } from '../../shared/scheduling/roster.js';
import { telOf } from '../../shared/ui.js';
import { codeClass, famOf, overtimeKindLabel } from './codes.js';
import { dayClass, isToday } from './days.js';
import { matchQ, teamSections } from './page.js';

/* ---------- รายวัน: ใครเข้ากะไหนในวันนั้น ---------- */
export function dayNav(S) {
  const { y, m, n } = S;
  const d0 = Math.min(view.day, n);
  const days = [-3, -2, -1, 0, 1, 2, 3].map(k => d0 + k).filter(d => d >= 1 && d <= n);
  return `
    <div class="dnav">
      <button class="sq" data-click="SF.dayStep(-1)" aria-label="วันก่อนหน้า">${icon('left')}</button>
      <div class="dnav-days">
        ${days.map(d => `<button class="${d === d0 ? 'on' : ''} ${isToday(y, m, d) ? 'tdy' : ''} ${dayClass(y, m, d, S.hol).includes('hol') ? 'hol' : dayClass(y, m, d, S.hol).includes('we') ? 'we' : ''}" data-click="SF.pickDay(${d})"><span>${TH_DW[new Date(y, m, d).getDay()]}</span><b>${d}</b></button>`).join('')}
      </div>
      <button class="sq" data-click="SF.dayStep(1)" aria-label="วันถัดไป">${icon('right')}</button>
    </div>`;
}
export function dayViewHtml(S) {
  const { y, m, n, hol } = S;
  const d = Math.min(view.day, n);
  const dt = new Date(y, m, d);
  const date = isoOf(y, m, d);
  const groups = { 'c-M': [], 'c-N': [], 'c-D': [], 'c-X': [], 'c-L': [], 'c-O': [] };
  const people = teamSections(y, m, d).flatMap(section => section.employees).filter(matchQ);
  people.forEach(e => {
    const c = getCalendarShiftCode(e, y, m, d);
    let f = famOf(c);
    if (f === 'c-H') f = 'c-L';
    const slot = state.apiAssign[e.id]?.[date];
    const holidayOT = Boolean(slot?.holidayOvertime);
    (groups[f] || groups['c-O']).push({ e, c, holidayOT, absent: Boolean(slot?.absence), overtime: overtimeKindLabel(c, holidayOT) });
  });
  const t = state.managerConfig.shiftTimes;
  const col = (key, title, time) => `
    <section class="daycol">
      <header><i class="cd ${key}"></i><h3>${title}</h3>${time ? `<span class="t">${esc(time)}</span>` : ''}<b>${groups[key].length}</b></header>
      ${groups[key].length ? `<ul class="plist">${groups[key].map(x => `
        <li class="${S.viewer && S.viewer.id === x.e.id ? 'me' : ''}">
          <button class="prow" data-click="SF.cell(${js(x.e.id)}, ${d})">
            <span class="pname">${esc(x.e.name)}${S.viewer && S.viewer.id === x.e.id ? ' <span class="you">คุณ</span>' : ''}${x.e.roleCategory === 'Shift Supervisor' ? ' <span class="tag" title="หัวหน้ากะ">S</span>' : ''}</span>
            <span class="pmeta">${esc(x.e.teamForDisplay)}${key !== 'c-O' ? `<span class="chip ${codeClass(x.c, x.holidayOT)}">${esc(x.c)}</span>` : ''}${x.overtime ? ` <span class="day-ot-kind">${esc(x.overtime)}</span>` : ''}${x.absent ? ' <span class="absence-tag">ขาดงาน</span>' : ''}</span>
          </button>
          ${telOf(x.e.phone)}
        </li>`).join('')}</ul>` : '<p class="none">ไม่มี</p>'}
    </section>`;
  return `
    <div class="daytitle">
      <h2>${esc(dt.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h2>
      ${isToday(y, m, d) ? '<span class="st ok">วันนี้</span>' : ''}
      ${hol[`${m}-${d}`] ? `<span class="st bad">${esc(hol[`${m}-${d}`])}${state.actor?.remotePilot && !hasCentralHolidayCalendar(y, m) ? ' · ข้อมูลทดสอบ' : ''}</span>` : ''}
      ${!S.hasData ? `<span class="st warn">ตารางกะคาดการณ์${S.projected ? ' · ดูได้อย่างเดียว' : ''}</span>` : ''}
    </div>
    <div class="daycols">
      ${col('c-M', 'กะเช้า', (t.M || '').split(' ')[0])}
      ${col('c-N', 'กะดึก', (t.N || '').split(' ')[0])}
      ${groups['c-D'].length ? col('c-D', 'เวลาทำการปกติ', (t.D || '').split(' ')[0]) : ''}
      ${groups['c-X'].length ? col('c-X', 'OT เพิ่มเติม', '') : ''}
      ${col('c-L', 'ลา', '')}
      ${col('c-O', 'หยุด', '')}
    </div>`;
}
