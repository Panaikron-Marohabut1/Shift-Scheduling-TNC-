/* ==========================================================================
   ปุ่ม "ยื่นคำขอ": ประเภทคำขอทั้งหมด และเงื่อนไขที่ยื่นได้ (ปีประกาศใช้แล้ว และเดือนยังไม่ล็อก)
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { openModal } from '../../shared/modal.js';
import { isYearPublished } from '../../shared/scheduling/annual.js';
import { daysIn } from '../../shared/scheduling/dates.js';
import { isMonthLocked, isSchedulePublished } from '../../shared/scheduling/roster.js';
import { draftNote, isToday } from '../schedule/days.js';

// ประเภทคำขอ (ตามที่ประชุมกับหัวหน้ากะ): ไม่มี "เปลี่ยนกะของตัวเอง" เพราะทุกกะต้องมีคนทำครบ 7 คน
// จะหยุดหรือเปลี่ยนกะต้องมีคนมาแทนเสมอ (สลับกะ / ลาโดยมีคนมาแทน / OT)
export const KINDS = [
  { k: 'swap', label: 'ขอสลับกะ', hint: 'เลือกเพื่อนต่างทีมและวันที่ต้องการสลับกะ' },
  { k: 'leave', label: 'ขอลา', hint: 'เลือกประเภทการลา และระบุคนที่จะมาทำกะแทนคุณ' },
  { k: 'ot', label: 'ขอทำงานล่วงเวลา (OT)', hint: 'เลือกวันที่และกะที่คุณจะเข้าทำงานเพิ่ม' },
  { k: 'dayoff', label: 'ขอย้ายวันหยุดนักขัตฤกษ์', hint: 'เลือกไปทำงานในวันหยุดเดิม แล้วระบุวันที่จะหยุดแทน' }
];
// ทุกบทบาทที่มีกะ (พนักงานและหัวหน้ากะ) เปลี่ยนตารางได้ผ่านคำขอเท่านั้น
export function kindsAllowed() {
  const kinds = state.actor?.remotePilot ? KINDS.filter(kind => kind.k === 'swap' && state.actor.centralSwap) : KINDS;
  return state.actor?.centralSwap
    ? kinds.map(kind => kind.k === 'swap' ? { ...kind, hint: 'แลกกะกับเพื่อนในวันเดียวกัน หรือทำกะแทนกันคนละวัน', central: true } : kind)
    : kinds;
}
export const kindLabel = k => (KINDS.find(x => x.k === k) || {}).label || '';
export function requestOptions(list, day, { fromCell = false, title = 'คำขอสำหรับวันที่เลือก', emptyMessage = 'วันนี้ไม่มีคำขอให้เลือก' } = {}) {
  return `<section class="request-options" aria-labelledby="requestOptionsTitle">
    <h3 id="requestOptionsTitle">${esc(title)}</h3>
    ${list.length ? `<ul class="kinds">${list.map(kind => `
      <li><button type="button" class="request-option" data-click="SF.form(${js(kind.k)}, ${day || 0}, ${js(fromCell ? 'cell' : 'menu')})">
        <span class="request-option-copy">
          <span class="request-option-title"><b>${esc(kind.label)}</b>${kind.central ? '' : '<small>ฟอร์มเดโม่</small>'}</span>
          <span>${esc(kind.hint)}</span>
        </span>
        ${icon('right')}
      </button></li>`).join('')}</ul>` : `<p class="notice">${esc(emptyMessage)}</p>`}
  </section>`;
}
// ยื่นคำขอได้เมื่อปีนั้นประกาศใช้แล้ว และเดือนนั้นยังไม่ถูกล็อก (กฎเดียวกับการกดช่องในตารางกะ)
export const LOCKED_NOTE = 'เดือนนี้ถูกล็อกข้อมูลแล้ว ดูได้อย่างเดียว ยื่นคำขอได้ตั้งแต่เดือนปัจจุบันเป็นต้นไป';
export const PAST_DATE_NOTE = 'วันที่ผ่านมาแล้ว ดูรายละเอียดได้อย่างเดียว';
export function draftBlocked(kind) {
  if (state.actor?.remotePilot && (!state.actor.centralSwap || (kind && kind !== 'swap'))) {
    openModal('ยังยื่นคำขอไม่ได้', '<p>รอบทดสอบนี้เปิดให้ยื่นเฉพาะคำขอสลับกะจากตารางส่วนกลาง</p>', '<button class="btn" data-click="closeModal()">ปิด</button>');
    return true;
  }
  const y = state.currentYear, m = state.currentMonth;
  const central = state.actor?.centralSwap && (!kind || kind === 'swap');
  const published = central ? isSchedulePublished(y, m) : isYearPublished(y);
  if (published && !isMonthLocked(y, m)) return false;
  const message = published ? LOCKED_NOTE : central ? 'ตารางกะเดือนนี้ยังไม่ประกาศใช้' : draftNote(y);
  openModal('ยังยื่นคำขอไม่ได้', `<p>${esc(message)}</p>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
  return true;
}
export function newRequestModal() {
  if (draftBlocked()) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = isToday(state.currentYear, state.currentMonth, DEMO_TODAY.getDate()) ? DEMO_TODAY.getDate() : Math.min(state.currentDay, n);
  openModal('ยื่นคำขอ', requestOptions(kindsAllowed(), d, { title: 'เลือกคำขอ' }), '<button class="btn" data-click="closeModal()">ยกเลิก</button>');
}
