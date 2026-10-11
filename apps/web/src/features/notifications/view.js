/* ==========================================================================
   หน้าแจ้งเตือน: รายการแจ้งเตือนของผู้ใช้ (ยังไม่อ่านมีจุดสีน้ำเงิน)
   กดรายการ → ทำเครื่องหมายว่าอ่านแล้ว และเปิดรายละเอียดคำขอที่เกี่ยวข้อง (ถ้ามี)
   ========================================================================== */

import { esc, js } from '../../shared/dom.js';
import { pageHead } from '../../shared/ui.js';
import { markAllRead, markRead, myNotifications } from './store.js';
import { openRequestDetails } from '../requests/detail.js';
import { getVisibleRequests } from '../requests/permissions.js';

let repaint = () => {};
export function onNotificationsChange(fn) { repaint = fn; }

const timeText = ts => new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function notificationsHtml() {
  const list = myNotifications();
  const unread = list.filter(n => !n.read).length;
  return `
    ${pageHead(`แจ้งเตือน <span class="count">${unread ? `ยังไม่อ่าน ${unread}` : ''}</span>`, unread ? '<button class="btn" data-click="readAllNotifications()">อ่านทั้งหมดแล้ว</button>' : '')}
    ${list.length ? `
      <div class="panel flush">
        <ul class="nt-list">${list.map(n => `
          <li><button class="nt-row ${n.read ? '' : 'unread'}" data-click="openNotification(${js(n.id)})">
            <i class="nt-dot" aria-hidden="true"></i>
            <span class="nt-main"><b>${esc(n.title)}</b><span>${esc(n.message)}</span></span>
            <span class="nt-time">${esc(timeText(n.ts))}${n.read ? '' : '<span class="sr"> (ยังไม่อ่าน)</span>'}</span>
          </button></li>`).join('')}
        </ul>
      </div>` : '<p class="empty">ยังไม่มีแจ้งเตือน เมื่อมีคำขอที่เกี่ยวข้องกับคุณหรือมีการเปลี่ยนตาราง จะแจ้งที่นี่</p>'}`;
}

export function openNotification(id) {
  const item = myNotifications().find(n => n.id === id);
  if (!item) return;
  markRead(id);
  repaint();
  const visible = item.reqId != null && getVisibleRequests().some(r => String(r.id) === String(item.reqId));
  if (visible) openRequestDetails(item.reqId);
}
export function readAllNotifications() { markAllRead(); repaint(); }

// จำนวนที่ยังไม่อ่านครั้งก่อน — ใช้แจ้ง "มีแจ้งเตือนใหม่" ตอนข้อมูลรีเฟรช
let lastUnread = null;
export function newSinceLastCheck(count) {
  const added = lastUnread === null ? count : Math.max(0, count - lastUnread);
  lastUnread = count;
  return added;
}
export function resetNotificationCheck() { lastUnread = null; }
