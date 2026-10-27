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
import { loadLocal, saveLocal, state, view } from './state.js';
import { $ } from '../shared/dom.js';
import { closeModal, modalOpen } from '../shared/modal.js';
import { seedYearData } from '../shared/scheduling/annual.js';
import { isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { clearPatternCache } from '../shared/scheduling/roster.js';
import { watchTranslate } from '../shared/translate.js';
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
});
// session ของระบบกลางหมดอายุระหว่างใช้งาน → กลับไปหน้าเข้าสู่ระบบ (กลับมาที่หน้านี้หลังเข้าสู่ระบบ)
window.addEventListener('session-expired', ev => {
  if (!view.signed) return;
  closeModal();
  saveLocal();
  leave((ev.detail || {}).loginUrl, 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง');
  goToLogin();
});

// รีเฟรชข้อมูลจากฐานข้อมูลทุก 30 วินาที (ข้ามระหว่างเปิดหน้าต่างย่อยหรือกำลังพิมพ์)
setInterval(() => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (!view.signed || view.loading || modalOpen() || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  if (state.actor.role === 'EXTERNAL') void refreshNotificationsOnly();
  else void afterApi();
}, 30000);

/* ---------- เริ่มระบบ: ถามระบบหลังบ้านว่าใครเข้าสู่ระบบอยู่ ---------- */
// 401 → ไปหน้าเข้าสู่ระบบของระบบกลาง · 403 → บัญชียังไม่ผูกกับพนักงาน · อื่น ๆ → เชื่อมต่อไม่ได้
async function boot() {
  watchTranslate();
  const app = $('#app');
  if (app) app.innerHTML = '<p class="boot">กำลังโหลดข้อมูล…</p>';
  loadLocal();
  seedYearData();
  markReady();
  let me;
  try { me = await api('/me'); }
  catch (error) {
    const details = error.details || {};
    Object.assign(view, { signed: false, loginUrl: details.loginUrl || '', unlinked: error.code === 'ACCOUNT_NOT_LINKED', authMsg: error.message || 'เชื่อมต่อระบบหลังบ้านไม่สำเร็จ' });
    if (error.status === 401 && goToLogin(details.loginUrl)) return;
    renderApp();
    return;
  }
  await enter(me.actor);
}
void boot();
