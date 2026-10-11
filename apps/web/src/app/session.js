/* ==========================================================================
   เข้าสู่ระบบ / ออกจากระบบ และโหลดข้อมูลใหม่หลังมีการเปลี่ยนแปลง
   ========================================================================== */

import { api } from '../api/client.js';
import { loadNotifications, loadYear, merge, refreshAll, reloadLoadedYears, resetData } from './data.js';
import { buildRole, roleKeyOf } from './profiles.js';
import { pendingYears, renderApp } from './render.js';
import { DEMO_TODAY, saveLocal, state, view } from './state.js';
import { $ } from '../shared/dom.js';
import { closeModal } from '../shared/modal.js';
import { showToast } from '../shared/toast.js';
import { unreadCount } from '../features/notifications/store.js';
import { newSinceLastCheck, resetNotificationCheck } from '../features/notifications/view.js';

/* ---------- เข้า-ออกระบบ ---------- */
export async function enter(roleKey, actor) {
  const key = roleKey === 'Shift Employee B' ? 'Shift Employee' : roleKeyOf(actor);
  state.actor = actor;
  state.roles = { [key]: buildRole(key, actor) };
  state.activeRole = key;
  state.activeView = (state.roles[key].nav[0] || { id: 'driver' }).id;
  state.selectedShiftFilter = 'ALL';
  state.operatorShowFullGrid = false;
  state.currentYear = DEMO_TODAY.getFullYear();
  state.currentMonth = DEMO_TODAY.getMonth();
  state.annualScheduleYear = DEMO_TODAY.getFullYear();
  Object.assign(view, { signed: true, loginErr: '', loginUser: '', moreNav: false, mode: 'month', day: DEMO_TODAY.getDate(), q: '', rq: null, cell: null, loading: true });
  renderApp();
  try {
    if (actor.role !== 'EXTERNAL') await Promise.all([loadYear(state.currentYear), refreshAll()]);
    else await loadNotifications();
  } catch (error) { showToast(error.message || 'โหลดข้อมูลไม่สำเร็จ', 'alert'); }
  view.loading = false;
  window.scrollTo(0, 0);
  renderApp();
  resetNotificationCheck();
  const unread = newSinceLastCheck(unreadCount());
  if (unread) showToast(`คุณมีแจ้งเตือนที่ยังไม่อ่าน ${unread} รายการ`);
}
export async function logout() {
  closeModal();
  saveLocal();
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* session หมดอายุแล้ว */ }
  leave();
}
export function leave() {
  Object.assign(view, { signed: false, loading: false, loginErr: '', loginUser: '' });
  state.actor = null;
  state.roles = {};
  state.apiRequests = [];
  state.apiLogs = [];
  state.apiNotifications = [];
  resetNotificationCheck();
  resetData();
  Object.keys(pendingYears).forEach(y => { delete pendingYears[y]; });
  merge();
  renderApp();
  const el = $('#lgUser');
  if (el) el.focus();
}

/* ---------- หลังมีการเปลี่ยนแปลงข้อมูล ---------- */
export async function afterApi() {
  try { await Promise.all([refreshAll(), reloadLoadedYears()]); } catch { /* แสดงข้อมูลเดิม */ }
  renderApp();
  announceNew();
}
// ผู้ใช้ภายนอก (คนขับรถ) ไม่โหลดตารางพนักงาน รีเฟรชเฉพาะแจ้งเตือน
export async function refreshNotificationsOnly() {
  await loadNotifications();
  renderApp();
  announceNew();
}
// มีแจ้งเตือนใหม่ระหว่างใช้งาน (เช่น คนอื่นอนุมัติคำขอของเรา) → ขึ้นข้อความแจ้งมุมล่าง
function announceNew() {
  if (!view.signed) return;
  const added = newSinceLastCheck(unreadCount());
  if (added) showToast(`มีแจ้งเตือนใหม่ ${added} รายการ — ดูได้ที่เมนูแจ้งเตือน`);
}
