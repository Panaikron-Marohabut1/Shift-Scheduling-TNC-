import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const appOrigin = 'http://shiftflow.test';
const loginUrl = 'http://signin.shiftflow.test/login';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});

try {
  for (const scenario of ['logout-retry', 'session-expired', 'missing-login-url']) {
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let logoutPosts = 0;
    let expired = false;
    const redirectView = Promise.withResolvers();
    await page.exposeFunction('reportRedirectView', redirectView.resolve);
    await page.route(loginUrl, async route => {
      // Capture the app while the login response is still pending.
      await Promise.race([redirectView.promise, new Promise(resolve => setTimeout(resolve, 2000).unref())]);
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<button>ใช้บัญชี Microsoft 365</button>' });
    });
    await page.route(`${appOrigin}/**`, route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/start') return route.fulfill({
        contentType: 'text/html; charset=utf-8', body: '<a href="/">เปิด ShiftFlow</a>',
      });
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role: 'EMPLOYEE', employeeId: 1, teamCode: 'A' },
        capabilities: { remotePilot: true, centralSwap: true },
      } });
      if (pathname === '/api/schedules') return route.fulfill({ json: {
        schedule: { status: 'PUBLISHED' },
        assignments: [{ employee_id: 1, employee_code: 'DEMO-A1', name: 'พนักงานทดสอบ A1',
          team_code: 'A', team_id: 1, position: 'OPERATOR', status: 'ACTIVE', work_date: '2026-11-17', shift_code: 'M' }],
      } });
      if (pathname === '/api/auth/logout') {
        assert.equal(route.request().method(), 'POST');
        logoutPosts++;
        if (scenario === 'logout-retry' && logoutPosts === 1) {
          return route.fulfill({ status: 503, json: { message: 'ออกจากระบบไม่สำเร็จ' } });
        }
        return route.fulfill({ json: { ok: true, ...(scenario === 'missing-login-url' ? {} : { loginUrl }) } });
      }
      if (pathname === '/api/notifications' && expired) {
        return route.fulfill({ status: 401, json: { code: 'SESSION_EXPIRED', loginUrl } });
      }
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });

    await page.goto(`${appOrigin}/start`);
    await page.getByRole('link', { name: 'เปิด ShiftFlow' }).click();
    const roster = page.getByRole('heading', { name: 'กะของฉัน', exact: true });
    await roster.waitFor();
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const loading = !!document.querySelector('#session-loading');
        const fallback = !!document.querySelector('#session-title');
        if (!loading && !fallback) return;
        observer.disconnect();
        void window.reportRedirectView({ loading, fallback, roster: !!document.querySelector('.my-home') });
      });
      observer.observe(document.querySelector('#app'), { childList: true, subtree: true });
    });

    const signOut = async () => {
      await page.getByTitle('บัญชีของฉัน', { exact: true }).press('Enter');
      await page.getByRole('dialog').getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
    };
    if (scenario === 'session-expired') {
      expired = true;
      await page.evaluate(async () => {
        const { api } = await import('/src/api/client.js');
        await api('/notifications').catch(() => {});
      });
    } else {
      await signOut();
      if (scenario === 'logout-retry') {
        await page.getByText('ออกจากระบบไม่สำเร็จ', { exact: true }).waitFor();
        await roster.waitFor();
        await signOut();
      }
    }

    if (scenario === 'missing-login-url') {
      await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).waitFor();
      assert.equal(await roster.count(), 0);
    } else {
      await page.getByRole('button', { name: 'ใช้บัญชี Microsoft 365' }).waitFor();
      if (scenario === 'logout-retry') assert.equal(logoutPosts, 2);
      const handoff = await Promise.race([redirectView.promise, Promise.resolve(null)]);
      assert.deepEqual(handoff, { loading: true, fallback: false, roster: false }, scenario);
      await page.goBack();
      await page.getByRole('link', { name: 'เปิด ShiftFlow' }).waitFor();
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Chrome passed: logout retry, expired session, missing login URL, and no fallback flash during slow sign-in navigation.');
} finally {
  await browser.close();
}
