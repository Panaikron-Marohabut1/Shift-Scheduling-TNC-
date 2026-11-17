/* ==========================================================================
   ShiftFlow — จุดเริ่มของหน้าเว็บ
   --------------------------------------------------------------------------
   เปิดเว็บ → โหลดบัญชีเดโม → แสดงหน้าเข้าสู่ระบบ
   ผูกการทำงานระหว่างส่วนต่าง ๆ (หลังส่งคำขอ / อนุมัติ / แก้ข้อมูล ให้วาดหน้าจอใหม่)
   ปุ่ม Esc, หมดเวลาเข้าสู่ระบบ และรีเฟรชข้อมูลจากฐานข้อมูลทุก 30 วินาที
   ========================================================================== */

import { api } from '../api/client.js';
import { toggleMonthPicker } from './actions.js';
import { markReady, renderApp } from './render.js';
import { afterApi, enter, leave, refreshNotificationsOnly } from './session.js';
import { bindSideHover, HOVER_SIDE } from './shell.js';
import { loadLocal, nextBangkokMidnightDelay, saveLocal, state, syncToday, view } from './state.js';
import { $ } from '../shared/dom.js';
import { closeModal, modalOpen } from '../shared/modal.js';
import { seedYearData } from '../shared/scheduling/annual.js';
import { isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { clearPatternCache } from '../shared/scheduling/roster.js';
import { watchTranslate } from '../shared/translate.js';
import { loadAdminAccess } from '../features/admin/access.js';
import { onDriverChange } from '../features/external/view.js';
import { onManagerChange } from '../features/manager/refresh.js';
import { onNotificationsChange } from '../features/notifications/view.js';
import { onRequestChanged } from '../features/requests/decisions.js';
import { onSubmitted } from '../features/requests/submit.js';
import { goToLogin } from '../features/session/view.js';

onSubmitted(async () => {
  state.activeView = state.activeRole === 'Shift Employee' ? 'my-requests' : isSupervisorRoleName(state.activeRole) ? 'my-requests' : state.activeView;
  await afterApi();
});
onRequestChanged(async fromApi => { if (fromApi) await afterApi(); else { clearPatternCache(); renderApp(); } });
onManagerChange(() => renderApp());
onDriverChange(() => renderApp());
onNotificationsChange(() => renderApp());

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (modalOpen()) closeModal();
  else if (state.monthPickerOpen) toggleMonthPicker(false);
  else if (view.sideOpen) {
    view.sideOpen = false;
    renderApp();
    [...document.querySelectorAll('.mtop-menu, .side-toggle')].find(b => b.offsetParent)?.focus();
  }
});
// เปลี่ยนเป็นจอที่ใช้เมาส์ (เช่นขยายหน้าต่าง): ปิดเมนูซ้อนทับ เพราะเมนูขยายด้วยการชี้แทน
bindSideHover();
if (typeof matchMedia === 'function') {
  matchMedia(HOVER_SIDE).addEventListener('change', () => {
    view.sideOpen = false;
    if (view.signed) renderApp();
  });
}
// session ของระบบกลางหมดอายุระหว่างใช้งาน → กลับไปหน้าเข้าสู่ระบบ (กลับมาที่หน้านี้หลังเข้าสู่ระบบ)
window.addEventListener('session-expired', ev => {
  if (!view.signed && !view.accessPending) return;
  closeModal();
  if (state.actor && state.actor.role !== 'ADMIN') saveLocal();
  leave((ev.detail || {}).loginUrl, 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง');
});

let dateTimer;
function refreshCalendarDate() {
  clearTimeout(dateTimer);
  if (syncToday() && view.signed) renderApp();
  const delay = nextBangkokMidnightDelay();
  if (delay !== null) dateTimer = setTimeout(refreshCalendarDate, delay);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshCalendarDate();
});
refreshCalendarDate();

// รีเฟรชข้อมูลจากฐานข้อมูลทุก 30 วินาที (ข้ามระหว่างเปิดหน้าต่างย่อยหรือกำลังพิมพ์)
setInterval(() => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (!view.signed || view.loading || view.sideOpen || modalOpen() || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  if (state.actor.role === 'ADMIN') void loadAdminAccess(renderApp);
  else if (state.actor.role === 'EXTERNAL') void refreshNotificationsOnly();
  else void afterApi();
}, 30000);

/* ---------- เริ่มระบบ: ถามระบบหลังบ้านว่าใครเข้าสู่ระบบอยู่ ---------- */
// 401 → ไปหน้าเข้าสู่ระบบของระบบกลาง · 403 → บัญชียังไม่ผูกกับพนักงาน · อื่น ๆ → เชื่อมต่อไม่ได้
async function boot({ retry = false } = {}) {
  view.loading = true;
  view.accessPending = false;
  renderApp();
  if (retry) $('#session-loading')?.focus();
  let me;
  try { me = await api('/me'); }
  catch (error) {
    const details = error.details || {};
    Object.assign(view, { signed: false, loading: false, loginUrl: details.loginUrl || '', unlinked: error.code === 'ACCOUNT_NOT_LINKED',
      accessPending: error.code === 'ACCESS_PENDING', authMsg: error.message || 'เชื่อมต่อระบบหลังบ้านไม่สำเร็จ' });
    if (error.status === 401 && goToLogin(details.loginUrl)) return;
    renderApp();
    if (retry) ($('[data-session-retry]') || $('#session-title'))?.focus();
    return;
  }
  if (me.actor.role !== 'ADMIN' && me.capabilities?.remotePilot !== true) {
    loadLocal(me.capabilities?.swapPolicy === true || me.capabilities?.monthClose === true);
    seedYearData();
  }
  await enter({ ...me.actor, centralSwap: me.capabilities?.centralSwap === true, centralLeave: me.capabilities?.centralLeave === true,
    centralOT: me.capabilities?.centralOT === true,
    centralHoliday: me.capabilities?.centralHoliday === true,
    absenceTracking: me.capabilities?.absenceTracking === true,
    maxConsecutiveWorkDays: me.capabilities?.maxConsecutiveWorkDays,
    swapPolicy: me.capabilities?.swapPolicy === true,
    hrClosedRoster: me.capabilities?.hrClosedRoster === true, monthClose: me.capabilities?.monthClose === true,
    remotePilot: me.capabilities?.remotePilot === true,
    peopleManagement: me.capabilities?.peopleManagement === true });
}
watchTranslate();
markReady();
$('#app')?.addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('[data-session-retry]') && !view.loading) {
    void boot({ retry: true });
  }
});
void boot();
