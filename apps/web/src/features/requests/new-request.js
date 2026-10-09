/* ==========================================================================
   ปุ่ม "ยื่นคำขอ": ประเภทคำขอทั้งหมด และเงื่อนไขที่ยื่นได้ (ปีประกาศใช้แล้ว และเดือนยังไม่ล็อก)
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { isYearPublished } from '../../shared/scheduling/annual.js';
import { daysIn } from '../../shared/scheduling/dates.js';
import { isMonthLocked } from '../../shared/scheduling/roster.js';
import { draftNote, isToday } from '../schedule/days.js';

export const KINDS = [
  { k: 'swap', label: 'สลับกะ', hint: 'สลับกะกับเพื่อนต่างทีม หรือขอลาให้เพื่อนต่างทีมทำ OT แทน' },
  { k: 'change', label: 'เปลี่ยนกะ', hint: 'เปลี่ยนกะของตัวเองในวันนั้น' },
  { k: 'leave', label: 'ลา', hint: 'พักร้อน ลากิจ ลาป่วย เลือกเพื่อนในทีมมาทำแทนได้' },
  { k: 'dayoff', label: 'เปลี่ยนวันหยุด', hint: 'ย้ายวันหยุดไปวันอื่นภายใน 7 วัน' },
  { k: 'ot', label: 'ขอทำ OT', hint: 'ทำงานล่วงเวลา เต็มกะหรือครึ่งวัน' },
  { k: 'holiday', label: 'วันหยุดนักขัตฤกษ์', hint: 'ขอหยุดตามสิทธิ์วันหยุดนักขัตฤกษ์ (H)' }
];
// ทุกบทบาทที่มีกะ (พนักงานและหัวหน้ากะ) เปลี่ยนตารางได้ผ่านคำขอเท่านั้น
export const kindsAllowed = () => KINDS;
export const kindLabel = k => (KINDS.find(x => x.k === k) || {}).label || '';
export function kindButtons(list, day) {
  return `<ul class="kinds">${list.map(x => `<li><button data-click="SF.form(${js(x.k)}, ${day || 0})"><b>${esc(x.label)}</b><span>${esc(x.hint)}</span></button></li>`).join('')}</ul>`;
}
// ยื่นคำขอได้เมื่อปีนั้นประกาศใช้แล้ว และเดือนนั้นยังไม่ถูกล็อก (กฎเดียวกับการกดช่องในตารางกะ)
export const LOCKED_NOTE = 'เดือนนี้ถูกล็อกข้อมูลแล้ว ดูได้อย่างเดียว ยื่นคำขอได้ตั้งแต่เดือนปัจจุบันเป็นต้นไป';
export function draftBlocked() {
  const y = state.currentYear, m = state.currentMonth;
  if (isYearPublished(y) && !isMonthLocked(y, m)) return false;
  openModal('ยังยื่นคำขอไม่ได้', `<p>${isYearPublished(y) ? LOCKED_NOTE : draftNote(y)}</p>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
  return true;
}
export function newRequestModal() {
  if (draftBlocked()) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = isToday(state.currentYear, state.currentMonth, DEMO_TODAY.getDate()) ? DEMO_TODAY.getDate() : Math.min(state.currentDay, n);
  openModal('ยื่นคำขอ', kindButtons(kindsAllowed(), d), '<button class="btn" data-click="closeModal()">ยกเลิก</button>');
}
