/* ==========================================================================
   หน้าเข้าสู่ระบบ — เข้าสู่ระบบที่ระบบกลาง (apps/auth, Supabase Auth)
   --------------------------------------------------------------------------
   หน้าเว็บไม่รับรหัสผ่านเอง ถ้ายังไม่เข้าสู่ระบบ (/api/me ตอบ 401) จะพาไปหน้าเข้าสู่ระบบของระบบกลาง
   เข้าสู่ระบบแล้วระบบกลางส่งกลับมาที่นี่ ระบบหลังบ้านตรวจ session และบัญชีที่ผูกกับพนักงานทุกครั้ง
   หน้านี้แสดงเฉพาะระหว่างตรวจ, เมื่อบัญชียังไม่ผูกกับพนักงาน (403) หรือเมื่อเชื่อมต่อไม่ได้
   ========================================================================== */

import { view } from '../../app/state.js';
import { esc } from '../../shared/dom.js';

const sessionBrand = `
  <header class="session-brand">
    <img src="/assets/tnc-logo.png" alt="TNC" width="36" height="36">
    <div><b>ShiftFlow</b><span>ตารางกะฝ่ายผลิต</span></div>
  </header>`;

function connectionErrorHtml() {
  return `
    <main class="session-shell session-recovery">
      <section class="session-card session-recovery-card" aria-labelledby="session-title">
        ${sessionBrand}
        <div class="session-recovery-body">
          <h1 id="session-title" tabindex="-1">เชื่อมต่อไม่สำเร็จ</h1>
          <p class="session-description">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง</p>
          <div class="session-actions">
            <button class="btn primary" type="button" data-session-retry>ลองอีกครั้ง</button>
          </div>
          <p class="session-recovery-help">หากยังเข้าไม่ได้ ให้ติดต่อผู้ดูแลระบบ</p>
        </div>
      </section>
    </main>`;
}

// ไปหน้าเข้าสู่ระบบของระบบกลาง (URL มาจากระบบหลังบ้านเท่านั้น)
export function goToLogin(loginUrl, { replace = false } = {}) {
  let url = null;
  try { url = new URL(loginUrl || view.loginUrl); } catch { url = null; }
  if (!url || !['http:', 'https:'].includes(url.protocol)) { view.authMsg = 'ไม่พบที่อยู่ของระบบเข้าสู่ระบบ'; return false; }
  view.authMsg = 'กำลังไปหน้าเข้าสู่ระบบ…';
  if (replace) window.location.replace(url.toString());
  else window.location.assign(url.toString());
  return true;
}

export function loginHtml() {
  const needsAccess = view.unlinked || view.accessPending;
  if (!needsAccess && !view.loginUrl) return connectionErrorHtml();

  const title = view.accessPending ? 'รอกำหนดบทบาท'
    : view.unlinked ? 'บัญชีนี้ยังเข้าใช้งานไม่ได้'
    : 'เข้าสู่ระบบ';
  const actions = [
    view.loginUrl ? '<button class="btn primary" type="button" data-click="SF.toLogin()">เข้าสู่ระบบ</button>' : '',
    view.accessPending ? '<button class="btn primary" type="button" data-session-retry>ตรวจสอบสิทธิ์อีกครั้ง</button>' : '',
    needsAccess ? '<button class="btn" type="button" data-click="SF.logout()">ใช้บัญชีอื่น</button>' : ''
  ].join('');
  return `
    <main class="session-shell">
      ${sessionBrand}
      <section class="session-card session-status" aria-labelledby="session-title">
        <h1 id="session-title" tabindex="-1">${esc(title)}</h1>
        ${view.authMsg ? `<p class="session-description">${esc(view.authMsg)}</p>` : ''}
        <div class="session-actions">${actions}</div>
      </section>
    </main>`;
}
