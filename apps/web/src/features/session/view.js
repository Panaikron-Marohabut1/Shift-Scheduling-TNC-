/* ==========================================================================
   หน้าเข้าสู่ระบบ — เข้าสู่ระบบที่ระบบกลาง (shift/Backend, Supabase Auth)
   --------------------------------------------------------------------------
   หน้าเว็บไม่รับรหัสผ่านเอง ถ้ายังไม่เข้าสู่ระบบ (/api/me ตอบ 401) จะพาไปหน้าเข้าสู่ระบบของระบบกลาง
   เข้าสู่ระบบแล้วระบบกลางส่งกลับมาที่นี่ ระบบหลังบ้านตรวจ session และบัญชีที่ผูกกับพนักงานทุกครั้ง
   หน้านี้แสดงเฉพาะระหว่างตรวจ, เมื่อบัญชียังไม่ผูกกับพนักงาน (403) หรือเมื่อเชื่อมต่อไม่ได้
   ========================================================================== */

import { view } from '../../app/state.js';
import { esc } from '../../shared/dom.js';

// ไปหน้าเข้าสู่ระบบของระบบกลาง (URL มาจากระบบหลังบ้านเท่านั้น)
export function goToLogin(loginUrl) {
  let url = null;
  try { url = new URL(loginUrl || view.loginUrl); } catch { url = null; }
  if (!url || !['http:', 'https:'].includes(url.protocol)) { view.authMsg = 'ไม่พบที่อยู่ของระบบเข้าสู่ระบบ'; return false; }
  view.authMsg = 'กำลังไปหน้าเข้าสู่ระบบ…';
  window.location.assign(url.toString());
  return true;
}

export function loginHtml() {
  const actions = [
    view.loginUrl ? '<button class="btn primary block" type="button" data-click="SF.toLogin()">เข้าสู่ระบบ</button>' : '',
    view.unlinked ? '<button class="btn block" type="button" data-click="SF.logout()">ออกจากระบบ / ใช้บัญชีอื่น</button>' : '',
    !view.loginUrl && !view.unlinked && view.authMsg ? '<button class="btn primary block" type="button" data-click="SF.retry()">ลองอีกครั้ง</button>' : ''
  ].join('');
  return `
    <div class="login">
      <section class="login-side">
        <div class="login-brand"><b>ShiftFlow</b><span>ระบบตารางกะฝ่ายผลิต</span></div>
      </section>
      <section class="login-main">
        <div class="login-form">
          <h1>เข้าสู่ระบบ</h1>
          <p${view.unlinked ? ' class="form-err" role="alert"' : ''}>${esc(view.authMsg || 'กำลังตรวจสอบการเข้าสู่ระบบ…')}</p>
          ${actions}
        </div>
      </section>
    </div>`;
}
