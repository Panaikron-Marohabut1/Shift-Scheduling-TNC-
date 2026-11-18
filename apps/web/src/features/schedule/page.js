/* ==========================================================================
   หน้าตารางกะ: แถบควบคุม (เดือน รายเดือน/รายวัน ตัวกรอง ค้นหา) คำอธิบายสัญลักษณ์ และรายการรหัสกะ
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { openModal } from '../../shared/modal.js';
import { daysIn, isoOf, monthKey, monthLabel, thaiMonthName } from '../../shared/scheduling/dates.js';
import { getAllEmployees } from '../../shared/scheduling/employees.js';
import { dataMonth, getTeamForDate } from '../../shared/scheduling/roster.js';
import { pageHead } from '../../shared/ui.js';
import { famOf, overtimeLegendHtml } from './codes.js';
import { dayNav, dayViewHtml } from './day-view.js';
import { draftNote } from './days.js';
import { gridHtml } from './month-grid.js';
import { monthNav, scheduleState, statusChips } from './month-nav.js';

export function teamSections(y, m, day) {
  const map = { A: 'shiftA', B: 'shiftB', C: 'shiftC', D: 'shiftD' };
  const selected = Object.keys(map).filter(k => state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === k);
  const days = day ? [day] : Array.from({ length: daysIn(y, m) }, (_, i) => i + 1);
  const publishedRoster = state.actor?.remotePilot && state.apiMonths[monthKey(y, m)]?.schedule?.status === 'PUBLISHED';
  const sections = new Map(selected.map(key => [`Shift ${key}`, { ...state.shiftsData[map[key]], employees: [] }]));
  for (const employee of getAllEmployees()) {
    const assignments = state.apiAssign[employee.id];
    const assignedDays = publishedRoster ? days.filter(d => assignments?.[isoOf(y, m, d)]) : days;
    const memberships = new Set(assignedDays.map(d => getTeamForDate(employee, y, m, d)));
    for (const team of memberships) sections.get(team)?.employees.push({ ...employee, teamForDisplay: team });
  }
  return [...sections.values()];
}
export const matchQ = e => { const q = view.q.trim().toLowerCase(); return !q || e.name.toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q); };

export function scheduleHtml() {
  const S = scheduleState();
  const loadFailed = state.apiMonths[monthKey(S.y, S.m)]?.loadFailed;
  const remoteRosterMissing = state.actor?.remotePilot && !S.hasData && !S.projected;
  const base = dataMonth();
  const right = [];
  if (state.activeRole === 'Manager' && !state.actor?.remotePilot) right.push(`<button class="btn ghost" data-click="SF.toAnnual(${S.y})">${icon('left')} ตารางรายปี</button>`);
  if (S.canExport) right.push(`<button class="btn" data-click="SF.exportYear(${S.y})">${icon('export')} ส่งออกทั้งปี ${S.y + 543}</button>`);
  if (S.canPublish) right.push(`<button class="btn primary" data-click="SF.pubAsk(${S.y})">อนุมัติและประกาศใช้ทั้งปี ${S.y + 543}</button>`);
  // มือถือ: ทีมและช่องค้นหาซ่อนอยู่หลังปุ่ม "ตัวกรอง" (จอกว้างแสดงในแถวเดียวเสมอ)
  const activeFilters = (state.selectedShiftFilter !== 'ALL' ? 1 : 0) + (view.q.trim() ? 1 : 0);
  return `
    ${pageHead('ตารางกะ', right.join(''))}
    ${view.mode === 'month' ? '<section class="roster-sheet" aria-label="ตารางกะรายเดือน">' : ''}
    <div class="bar sched-bar">
      <div class="sched-period">
        ${view.mode === 'month' ? monthNav(true) : dayNav(S)}
        <button class="btn ghost" data-click="SF.today()">${view.mode === 'month' ? 'เดือนนี้' : 'วันนี้'}</button>
      </div>
      <div class="seg sched-view" role="group" aria-label="มุมมอง">
        <button class="${view.mode === 'month' ? 'on' : ''}" aria-pressed="${view.mode === 'month'}" data-click="SF.mode('month')">รายเดือน</button>
        <button class="${view.mode === 'day' ? 'on' : ''}" aria-pressed="${view.mode === 'day'}" data-click="SF.mode('day')">รายวัน</button>
      </div>
      <button class="btn filter-toggle ${activeFilters ? 'has' : ''}" aria-expanded="${!!view.filtersOpen}" aria-controls="schedFilters" data-click="SF.filters()">ตัวกรอง${activeFilters ? ` <em class="badge">${activeFilters}</em>` : ''}</button>
      <div class="sched-filters ${view.filtersOpen ? 'open' : ''}" id="schedFilters">
        <div class="seg sched-team" role="group" aria-label="ทีม">
          ${['ALL', 'A', 'B', 'C', 'D'].map(t => `<button class="${state.selectedShiftFilter === t ? 'on' : ''}" aria-pressed="${state.selectedShiftFilter === t}" data-click="filterScheduleShiftType(${js(t)})">${t === 'ALL' ? 'ทุกทีม' : `ทีม ${t}`}</button>`).join('')}
        </div>
        <div class="search">${icon('search')}<label class="sr" for="schedQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
          <input class="inp q" id="schedQ" type="search" placeholder="ค้นหาชื่อหรือรหัส" value="${esc(view.q)}" data-input="SF.search(this.value)" autocomplete="off"></div>
      </div>
    </div>
    ${loadFailed ? '<p class="empty" role="status">โหลดตารางกะไม่สำเร็จ กรุณาโหลดหน้าใหม่</p>'
      : remoteRosterMissing ? '<p class="empty">ไม่พบข้อมูลตารางกะสำหรับเดือนนี้</p>' : view.mode === 'month' ? `
      <div class="sched-month-meta">
        <div class="mstatus" role="group" aria-label="สถานะตารางกะ">${statusChips(S)}</div>
        ${overtimeLegendHtml()}
      </div>
      ${S.projected ? '' : !S.published ? `<p class="note warn proj-note">${state.actor?.remotePilot ? 'ตารางกะเดือนนี้ยังไม่ประกาศใช้' : draftNote(S.y)}</p>` : !S.hasData ? `<p class="note warn proj-note">${esc(monthLabel(S.y, S.m))} ยังไม่มีตารางกะจริง ระบบคาดการณ์จากรอบ 2 วันสลับ 2 วันของเดือน${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543} ${S.monthLocked ? 'เดือนนี้ถูกล็อก ดูได้อย่างเดียว' : 'กดช่องกะเพื่อยื่นคำขอได้ตามปกติ'}</p>` : ''}
      ${gridHtml(S)}
      ${legendHtml()}` : dayViewHtml(S)}
    ${view.mode === 'month' ? '</section>' : ''}`;
}

// กลุ่มคำอธิบายคงที่ อ่านจากกะทำงานไปยังสัญลักษณ์ประกอบ
function legendHtml() {
  return `
    <div class="legend">
      <div class="legend-groups">
        <section class="legend-group" aria-label="กะทำงาน">
          <h3>กะทำงาน</h3>
          <ul class="legend-group-items">
            <li><i class="chip c-M">M</i><span>กะเช้า</span></li>
            <li><i class="chip c-N">N</i><span>กะดึก</span></li>
            <li><i class="chip c-D">D</i><span>เวลาทำการปกติ</span></li>
          </ul>
        </section>
        <section class="legend-group" aria-label="OT">
          <h3>OT</h3>
          <ul class="legend-group-items">
            <li><i class="chip c-X" aria-hidden="true"></i><span>OT เพิ่มเติม</span></li>
          </ul>
        </section>
        <section class="legend-group" aria-label="ลาและวันพัก">
          <h3>ลาและวันพัก</h3>
          <ul class="legend-group-items">
            <li><i class="chip c-L">L</i><span>ลา</span></li>
            <li><i class="chip c-H">H</i><span>ใช้สิทธิ์นักขัตฤกษ์</span></li>
            <li><i class="chip c-O" aria-hidden="true">·</i><span>วันหยุดประจำ (O)</span></li>
          </ul>
        </section>
        <section class="legend-group" aria-label="วันตามปฏิทิน">
          <h3>วันตามปฏิทิน</h3>
          <ul class="legend-group-items">
            <li><i class="chip lg-we" aria-hidden="true"></i><span>เสาร์–อาทิตย์</span></li>
            <li><i class="chip lg-hol" aria-hidden="true"></i><span>วันหยุดนักขัตฤกษ์</span></li>
          </ul>
        </section>
        <section class="legend-group" aria-label="การเปลี่ยนแปลง">
          <h3>การเปลี่ยนแปลง</h3>
          <ul class="legend-group-items">
            <li><i class="mk-corner" aria-hidden="true"></i><span>เปลี่ยนจากตารางเดิม</span></li>
          </ul>
        </section>
      </div>
      <button class="link" data-click="SF.codes()">รหัสกะทั้งหมด</button>
    </div>`;
}

// เรียงเฉพาะการแสดงผล ไม่เปลี่ยนรหัสหรือคำนิยามใน state.shiftDefs
const CODE_GROUPS = [
  ['กะเช้า', ['M', 'MT', 'MTh']],
  ['กะดึก', ['N', 'NT', 'NTh']],
  ['เวลาปกติและ OT เพิ่มเติม', ['D', 'OT']],
  ['วันพักและการลา', ['O', 'L', 'V', 'B', 'S', 'VG', 'VGh', 'H']],
  ['สลับและปรับกะ', ['N/M', 'M/N', 'M/O', 'N/O', 'O/M', 'O/N']],
  ['ปรับหลายขั้นตอน', ['O/M/N', 'O/M/S']]
];

function codeGuideRow(code) {
  const { label, time } = state.shiftDefs[code];
  const hours = /^(\d{2}:\d{2}–\d{2}:\d{2}) \((.+)\)$/.exec(time);
  return `<tr role="row">
    <th scope="row" role="rowheader"><span class="chip ${famOf(code)}">${esc(code)}</span></th>
    <td class="shift-code-meaning" role="cell">${esc(label)}</td>
    <td class="shift-code-time" role="cell">${hours ? `<span>${esc(hours[1])}</span><small>${esc(hours[2])}</small>` : esc(time)}</td>
  </tr>`;
}

export function codesModal() {
  const known = new Set(CODE_GROUPS.flatMap(([, codes]) => codes));
  const extra = Object.keys(state.shiftDefs).filter(code => !known.has(code));
  const groups = extra.length ? [...CODE_GROUPS, ['รหัสอื่น ๆ', extra]] : CODE_GROUPS;
  openModal('ความหมายรหัสกะ', `
    <div class="shift-code-guide">
      <table class="shift-code-table" role="table" aria-label="ความหมายรหัสกะ">
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">รหัส</th><th scope="col" role="columnheader">ความหมาย</th><th scope="col" role="columnheader">เวลาและรายละเอียด</th></tr></thead>
        ${groups.map(([label, codes]) => {
          const available = codes.filter(code => state.shiftDefs[code]);
          return available.length ? `<tbody role="rowgroup">
            <tr class="shift-code-group" role="row"><th scope="rowgroup" role="rowheader" colspan="3">${esc(label)}</th></tr>
            ${available.map(codeGuideRow).join('')}
          </tbody>` : '';
        }).join('')}
      </table>
      <section class="shift-code-key" aria-labelledby="shiftCodeKeyTitle">
        <h3 id="shiftCodeKeyTitle">สัญลักษณ์ในตาราง</h3>
        ${overtimeLegendHtml()}
        <ul>
          <li><i class="chip lg-we" aria-hidden="true"></i>เสาร์–อาทิตย์</li>
          <li><i class="chip lg-hol" aria-hidden="true"></i>วันหยุดนักขัตฤกษ์</li>
          <li><i class="mk-corner" aria-hidden="true"></i>เปลี่ยนจากตารางเดิม</li>
          <li><i class="chip c-O" aria-hidden="true">·</i>วันหยุดประจำ</li>
        </ul>
      </section>
    </div>`, '<button type="button" class="btn" data-click="closeModal()">ปิด</button>');
}
