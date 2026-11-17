import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });

const saved = [1, 2, 3].map(id => ({ notification_id: id, title: `Notice ${id}`, message: 'Test', is_read: false, created_at: '2026-11-17T10:00:00Z' }));
let failOnce = true;

async function openInbox() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.route(`${origin}/**`, route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/me') return route.fulfill({ json: { actor: { role: 'EMPLOYEE', userId: 1, employeeId: 1, teamCode: 'A' }, capabilities: { remotePilot: true } } });
    if (pathname === '/api/notifications') return route.fulfill({ json: saved });
    if (pathname === '/api/notifications/1/read' && route.request().method() === 'PATCH') {
      if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { message: 'บันทึกไม่สำเร็จ' } }); }
      saved[0].is_read = true;
      return route.fulfill({ json: { notificationIds: [1] } });
    }
    if (pathname === '/api/notifications/read-all' && route.request().method() === 'PATCH') {
      const unread = saved.filter(item => !item.is_read);
      unread.forEach(item => { item.is_read = true; });
      return route.fulfill({ json: { notificationIds: unread.map(item => item.notification_id) } });
    }
    if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
    return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
  });
  await page.goto(`${origin}/?today=2026-11-18`);
  await page.locator('.side-nav button[data-click=\'SF.nav("notifications")\']').press('Enter');
  await page.getByRole('heading', { name: /^แจ้งเตือน/ }).waitFor();
  return { context, page };
}

try {
  let { context, page } = await openInbox();
  await page.getByText('ยังไม่อ่าน 3', { exact: true }).waitFor();
  const single = page.getByRole('button', { name: /Notice 1/ });
  await single.press('Enter');
  await page.getByText('บันทึกไม่สำเร็จ', { exact: true }).waitFor();
  assert.equal(await page.locator('.nt-row.unread').count(), 3);
  await single.press('Enter');
  await page.getByText('ยังไม่อ่าน 2', { exact: true }).waitFor();
  await context.close();

  ({ context, page } = await openInbox());
  await page.getByText('ยังไม่อ่าน 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'อ่านทั้งหมดแล้ว' }).click();
  await page.locator('.nt-row.unread').first().waitFor({ state: 'hidden' });
  await context.close();

  ({ context, page } = await openInbox());
  assert.equal(await page.locator('.nt-row').count(), 3);
  assert.equal(await page.locator('.nt-row.unread').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'อ่านทั้งหมดแล้ว' }).count(), 0);
  await context.close();
  console.log('Chrome passed: notification failure/retry, single and bulk read across fresh sessions.');
} finally {
  await browser.close();
}
