/* ==========================================================================
   หน้าตารางกะ: แถบควบคุม (เดือน รายเดือน/รายวัน ตัวกรอง ค้นหา) คำอธิบายสัญลักษณ์ และรายการรหัสกะ
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { openModal } from '../../shared/modal.js';
import { monthLabel, thaiMonthName } from '../../shared/scheduling/dates.js';
import { dataMonth } from '../../shared/scheduling/roster.js';
import { pageHead } from '../../shared/ui.js';
import { swatch } from './codes.js';
import { dayNav, dayViewHtml } from './day-view.js';
import { draftNote } from './days.js';
import { gridHtml } from './month-grid.js';
import { monthNav, scheduleState, statusChips } from './month-nav.js';

export function teamSections() {
  const map = { A: 'shiftA', B: 'shiftB', C: 'shiftC', D: 'shiftD' };
  return Object.keys(map).filter(k => state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === k).map(k => state.shiftsData[map[k]]);
}
export const matchQ = e => { const q = view.q.trim().toLowerCase(); return !q || e.name.toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q); };

export function scheduleHtml() {
  const S = scheduleState();
  const base = dataMonth();
  const right = [];
  if (state.activeRole === 'Manager') right.push(`<button class="btn ghost" data-click="SF.toAnnual(${S.y})">${icon('left')} ตารางรายปี</button>`);
  if (S.canExport) right.push(`<button class="btn" data-click="SF.exportYear(${S.y})">${icon('export')} ส่งออกทั้งปี ${S.y + 543}</button>`);
  if (S.canPublish) right.push(`<button class="btn primary" data-click="SF.pubAsk(${S.y})">อนุมัติและประกาศใช้ทั้งปี ${S.y + 543}</button>`);
  return `
    ${pageHead('ตารางกะ', right.join(''))}
    <div class="bar">
      ${view.mode === 'month' ? monthNav(true) : dayNav(S)}
      <button class="btn ghost" data-click="SF.today()">วันนี้</button>
      <div class="seg" role="group" aria-label="มุมมอง">
        <button class="${view.mode === 'month' ? 'on' : ''}" aria-pressed="${view.mode === 'month'}" data-click="SF.mode('month')">รายเดือน</button>
        <button class="${view.mode === 'day' ? 'on' : ''}" aria-pressed="${view.mode === 'day'}" data-click="SF.mode('day')">รายวัน</button>
      </div>
      <div class="seg" role="group" aria-label="ทีม">
        ${['ALL', 'A', 'B', 'C', 'D'].map(t => `<button class="${state.selectedShiftFilter === t ? 'on' : ''}" aria-pressed="${state.selectedShiftFilter === t}" data-click="filterScheduleShiftType(${js(t)})">${t === 'ALL' ? 'ทุกทีม' : t}</button>`).join('')}
      </div>
      <label class="sr" for="schedQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" id="schedQ" type="search" placeholder="ค้นหาชื่อ" value="${esc(view.q)}" data-input="SF.search(this.value)" autocomplete="off">
    </div>
    ${view.mode === 'month' ? `
      <div class="mstatus">${statusChips(S)}</div>
      ${!S.published ? `<p class="note warn proj-note">${draftNote(S.y)}</p>` : !S.hasData ? `<p class="note warn proj-note">${esc(monthLabel(S.y, S.m))} ยังไม่มีตารางกะจริง ระบบคาดการณ์จากรอบ 2 วันสลับ 2 วันของเดือน${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543} ${S.monthLocked ? 'เดือนนี้ถูกล็อก ดูได้อย่างเดียว' : 'กดช่องกะเพื่อยื่นคำขอได้ตามปกติ'}</p>` : ''}
      ${gridHtml(S)}
      ${legendHtml()}` : dayViewHtml(S)}`;
}

function legendHtml() {
  const item = (cls, label) => `<span><i class="cd ${cls}"></i>${label}</span>`;
  return `
    <div class="legend">
      ${item('c-M', 'กะเช้า')}${item('c-N', 'กะดึก')}${item('c-D', 'เวลาทำการปกติ')}${item('c-L', 'ลา')}${item('c-H', 'ใช้สิทธิ์นักขัตฤกษ์ (H)')}${item('c-X', 'OT เพิ่มเติม')}
      <span><i class="mk-ot"></i>มี OT</span>
      <span><i class="mk-corner"></i>มุมแดง = เปลี่ยนจากตารางเดิม</span>
      <span><i class="lg-day we"></i>เสาร์-อาทิตย์</span>
      <span><i class="lg-day hol"></i>วันหยุดนักขัตฤกษ์</span>
      <button class="link" data-click="SF.codes()">ดูรหัสกะทั้งหมด</button>
    </div>`;
}

export function codesModal() {
  openModal('ความหมายรหัสกะ', `
    <table class="tbl codes">
      <thead><tr><th>รหัส</th><th>ความหมาย</th><th>เวลา</th></tr></thead>
      <tbody>${Object.keys(state.shiftDefs).map(c => `<tr><td>${swatch(c)}</td><td>${esc(state.shiftDefs[c].label)}</td><td>${esc(state.shiftDefs[c].time)}</td></tr>`).join('')}</tbody>
    </table>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
}
