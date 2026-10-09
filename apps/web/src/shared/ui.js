/* ==========================================================================
   ส่วนประกอบหน้าจอที่ใช้ร่วมกัน: หัวหน้า (ชื่อหน้า + ปุ่มด้านขวา) และเบอร์โทรที่กดโทรได้
   ========================================================================== */

import { esc } from './dom.js';

export function pageHead(title, right) { return `<div class="phead"><h1>${title}</h1>${right ? `<div class="phead-r">${right}</div>` : ''}</div>`; }
export const telOf = phone => (String(phone || '').replace(/\D/g, '')
  ? `<a class="tel" href="tel:${esc(String(phone).replace(/\D/g, ''))}">${esc(phone)}</a>`
  : `<span class="tel">${esc(phone || '-')}</span>`);
