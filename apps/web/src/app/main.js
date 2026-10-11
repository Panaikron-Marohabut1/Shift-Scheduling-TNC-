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
import { afterApi, leave, refreshNotificationsOnly } from './session.js';
import { loadLocal, state, view } from './state.js';
import { $ } from '../shared/dom.js';
import { closeModal, modalOpen } from '../shared/modal.js';
import { seedYearData } from '../shared/scheduling/annual.js';
import { isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { clearPatternCache } from '../shared/scheduling/roster.js';
import { showToast } from '../shared/toast.js';
import { watchTranslate } from '../shared/translate.js';
import { onDriverChange } from '../features/external/view.js';
import { onManagerChange } from '../features/manager/refresh.js';
import { onNotificationsChange } from '../features/notifications/view.js';
import { onRequestChanged } from '../features/requests/decisions.js';
import { onSubmitted } from '../features/requests/submit.js';

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
window.addEventListener('session-expired', () => { if (view.signed) { closeModal(); showToast('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง', 'alert'); leave(); } });

// รีเฟรชข้อมูลจากฐานข้อมูลทุก 30 วินาที (ข้ามระหว่างเปิดหน้าต่างย่อยหรือกำลังพิมพ์)
setInterval(() => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (!view.signed || view.loading || modalOpen() || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  if (state.actor.role === 'EXTERNAL') void refreshNotificationsOnly();
  else void afterApi();
}, 30000);

/* ---------- เริ่มระบบ: เปิดเว็บทุกครั้งเริ่มที่หน้าเข้าสู่ระบบ ---------- */
async function boot() {
  watchTranslate();
  const app = $('#app');
  if (app) app.innerHTML = '<p class="boot">กำลังโหลดข้อมูล…</p>';
  loadLocal();
  seedYearData();
  try { state.accounts = await api('/demo/accounts'); } catch (error) { showToast(error.message || 'เชื่อมต่อระบบหลังบ้านไม่สำเร็จ', 'alert'); }
  markReady();
  view.signed = false;
  renderApp();
}
void boot();
