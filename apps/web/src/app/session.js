/* ==========================================================================
   เข้าสู่ระบบ / ออกจากระบบ และโหลดข้อมูลใหม่หลังมีการเปลี่ยนแปลง
   ========================================================================== */

import { api } from '../api/client.js';
import { loadNotifications, loadYear, merge, refreshAll, reloadLoadedYears, resetData } from './data.js';
import { buildRole, roleKeyOf } from './profiles.js';
import { pendingYears, renderApp } from './render.js';
import { DEMO_TODAY, saveLocal, state, view } from './state.js';
import { closeModal } from '../shared/modal.js';
import { showToast } from '../shared/toast.js';
import { unreadCount } from '../features/notifications/store.js';
import { newSinceLastCheck, resetNotificationCheck } from '../features/notifications/view.js';
import { goToLogin } from '../features/session/view.js';

/* ---------- เข้า-ออกระบบ ---------- */
// actor มาจาก /api/me (ระบบหลังบ้านตรวจ session ของ Supabase และบัญชีที่ผูกกับพนักงานแล้ว)
export async function enter(actor) {
  const key = roleKeyOf(actor);
  state.actor = actor;
  state.roles = { [key]: buildRole(key, actor) };
  state.activeRole = key;
  state.activeView = (state.roles[key].nav[0] || { id: 'driver' }).id;
  state.selectedShiftFilter = 'ALL';
  state.operatorShowFullGrid = false;
  state.currentYear = DEMO_TODAY.getFullYear();
  state.currentMonth = DEMO_TODAY.getMonth();
  state.annualScheduleYear = DEMO_TODAY.getFullYear();
  Object.assign(view, { signed: true, authMsg: '', unlinked: false, moreNav: false, mode: 'month', day: DEMO_TODAY.getDate(), q: '', rq: null, cell: null, loading: true });
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
// ออกจากระบบกลางด้วย (ลบ cookie ของ Supabase) แล้วกลับไปหน้าเข้าสู่ระบบ
export async function logout() {
  closeModal();
  saveLocal();
  let result;
  try { result = await api('/auth/logout', { method: 'POST' }); }
  catch (error) { showToast(error.message || 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง', 'alert'); return; }
  leave(result.loginUrl, 'ออกจากระบบแล้ว');
  goToLogin(result.loginUrl);
}
export function leave(loginUrl = view.loginUrl, message = '') {
  Object.assign(view, { signed: false, loading: false, authMsg: message, loginUrl: loginUrl || '', unlinked: false });
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
