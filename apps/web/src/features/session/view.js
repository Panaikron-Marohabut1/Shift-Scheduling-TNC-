/* ==========================================================================
   หน้าเข้าสู่ระบบ — ชื่อบทบาท + รหัสผ่านทดลอง แล้วสร้าง session ที่ระบบหลังบ้าน
   --------------------------------------------------------------------------
   รหัสผ่าน 1234 ใช้เฉพาะช่วงทดลอง (ตรวจในหน้าเว็บ) เมื่อทีมเชื่อมระบบล็อกอินของบริษัทแล้ว
   ให้เปลี่ยนที่ signIn() จุดเดียว — ตัวตนจริงยังมาจาก session ของระบบหลังบ้าน (/api/demo/session)
   ========================================================================== */
import { view } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { api } from '../../api/client.js';
import { ROLE_LIST, norm, findRole, accountFor } from '../../app/profiles.js';

const TRIAL_PASSWORD = '1234';

export function loginHtml() {
  return `
    <div class="login">
      <section class="login-side">
        <div class="login-brand"><b>ShiftFlow</b><span>ระบบตารางกะฝ่ายผลิต</span></div>
      </section>
      <section class="login-main">
        <form class="login-form" data-submit="SF.login()" novalidate>
          <h1>เข้าสู่ระบบ</h1>
          <div class="field">
            <label for="lgUser">ชื่อบทบาท</label>
            <input class="inp" id="lgUser" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(view.loginUser)}">
            <div class="role-picks" aria-label="เลือกบทบาท">${ROLE_LIST.map(r => `<button type="button" class="${norm(view.loginUser) === norm(r[0]) ? 'on' : ''}" data-click="SF.pickRole(${js(r[0])})">${esc(r[0])}</button>`).join('')}</div>
          </div>
          <div class="field">
            <label for="lgPass">รหัสผ่าน</label>
            <input class="inp" id="lgPass" type="password" autocomplete="current-password">
          </div>
          ${view.loginErr ? `<p class="form-err" role="alert">${esc(view.loginErr)}</p>` : ''}
          <button class="btn primary block" type="submit">เข้าสู่ระบบ</button>
        </form>
      </section>
    </div>`;
}

// คืนค่า { roleKey, actor } เมื่อเข้าสู่ระบบสำเร็จ หรือ null พร้อมตั้งข้อความผิดพลาด
export async function signIn() {
  const name = ($('#lgUser') || {}).value || '';
  const pass = ($('#lgPass') || {}).value || '';
  view.loginUser = name;
  if (!name.trim() || !pass) { view.loginErr = 'กรอกชื่อบทบาทและรหัสผ่าน'; return null; }
  const role = findRole(name);
  const account = role && accountFor(role[0]);
  if (!role || pass !== TRIAL_PASSWORD) { view.loginErr = 'ชื่อบทบาทหรือรหัสผ่านไม่ถูกต้อง'; return null; }
  if (!account) { view.loginErr = 'ยังไม่มีบัญชีของบทบาทนี้ในฐานข้อมูล (pnpm db:seed)'; return null; }
  try {
    const session = await api('/demo/session', { method: 'POST', body: { userId: account.userId } });
    return { roleKey: role[0], actor: session.actor };
  } catch (error) {
    view.loginErr = error.message || 'เข้าสู่ระบบไม่สำเร็จ';
    return null;
  }
}
