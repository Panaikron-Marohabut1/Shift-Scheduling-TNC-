/* ==========================================================================
   ข้อความแจ้งผลมุมล่างของจอ (แสดงเป็นข้อความธรรมดาเสมอ ไม่ตีความเป็น HTML)
   ========================================================================== */

import { $ } from './dom.js';
import { toastIcon } from './icons.js';

export function showToast(message, kind = 'check') {
  const container = $('#toastRoot');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = toastIcon(kind); // ไอคอนเป็นค่าคงที่ของระบบ
  const text = document.createElement('span');
  text.textContent = String(message == null ? '' : message); // ข้อความ (อาจมีชื่อคนหรือข้อความจากระบบหลังบ้าน) แสดงเป็นตัวอักษรเท่านั้น
  toast.append(' ', text);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}
