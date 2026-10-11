/* ==========================================================================
   หน้าต่างย่อย (modal): เปิด ปิด และตรวจว่ากำลังเปิดอยู่หรือไม่
   ชื่อหน้าต่าง (title) เป็นข้อความธรรมดา ระบบ esc ให้เอง
   ========================================================================== */

import { $, esc } from './dom.js';
import { icon } from './icons.js';
import { translateTree } from './translate.js';

// title = ข้อความธรรมดา (esc ให้เอง) · bodyHtml / footerHtml = HTML ที่สร้างด้วย esc() แล้ว
export function openModal(title, bodyHtml, footerHtml) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="overlay" data-click="overlayClose(event)">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
        <header><h2 id="modalTitle">${esc(title)}</h2><button class="sq" data-click="closeModal()" aria-label="ปิด">${icon('x')}</button></header>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<footer>${footerHtml}</footer>` : ''}
      </div>
    </div>`;
  translateTree(root);
  const box = $('.modal', root);
  if (box) box.focus({ preventScroll: true });
}
export function closeModal() { const root = $('#modalRoot'); if (root) root.innerHTML = ''; }
export const modalOpen = () => !!($('#modalRoot') && $('#modalRoot').innerHTML);
