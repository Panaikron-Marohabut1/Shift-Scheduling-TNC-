import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const origin = process.env.APP_TEST_ORIGIN;
const fixture = JSON.parse(process.env.TNC_PEOPLE_BROWSER_FIXTURE);
assert.equal(new URL(origin).hostname, 'localhost');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const errors = [];

async function pageFor(cookie) {
  assert.match(cookie, /^sb-session=[0-9a-f-]{36}$/);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: 'sb-session', value: cookie.slice('sb-session='.length), url: origin }]);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}

const responseFor = (page, path, method) => page.waitForResponse(response =>
  new URL(response.url()).pathname === path && response.request().method() === method);

try {
  if (fixture.mode === 'admin') {
    const pending = await pageFor(fixture.pending);
    await pending.goto(origin);
    await pending.getByText(/รอ.{0,40}บทบาท|รอ.{0,40}สิทธิ์/).first().waitFor();
    const page = await pageFor(fixture.session);
    const readPaths = [];
    page.on('request', request => readPaths.push(new URL(request.url()).pathname));
    await page.goto(origin);
    const screen = page.locator('#admin-access');
    const form = screen.getByRole('listitem').filter({ hasText: 'DEMO-B2' }).getByTestId('admin-access-form');
    await form.locator(`#admin-role-${fixture.userId}`).selectOption('EMPLOYEE');
    const saved = responseFor(page, `/api/admin/access/${fixture.userId}/assign`, 'POST');
    await form.getByRole('button', { name: 'กำหนดบทบาท', exact: true }).click();
    const result = await saved;
    assert.equal(result.status(), 201, await result.text());
    await form.waitFor({ state: 'detached' });
    assert.ok(readPaths.includes('/api/admin/access/pending'));
    assert.ok(!readPaths.some(path => /^\/api\/(schedules|requests|employees|audit|notifications)\b/.test(path)));
    await page.locator(`[data-click='SF.nav("admin-accounts")']`).filter({ visible: true }).first().click();
    const accounts = page.locator('#admin-accounts');
    const search = accounts.getByRole('searchbox');
    await search.fill('DEMO-B2');
    const activeAccount = accounts.getByRole('row').filter({ hasText: 'DEMO-B2' });
    await activeAccount.getByText('เปิดใช้งาน').waitFor();
    assert.equal(await accounts.locator('tbody tr').count(), 1);
    await accounts.getByRole('button', { name: 'ให้สิทธิ์ล่าสุด' }).click();
    await accounts.getByRole('columnheader', { name: 'ให้สิทธิ์โดย' }).waitFor();
    assert.match(await activeAccount.textContent(), /พนักงานกะ \(Employee\)/);
    assert.ok(readPaths.includes('/api/admin/access/accounts'));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await accounts.evaluate(element => element.scrollWidth <= element.clientWidth));
    }
    const signedIn = responseFor(pending, '/api/me', 'GET');
    await pending.reload();
    const employeeSession = await signedIn;
    assert.equal(employeeSession.status(), 200);
    assert.equal((await employeeSession.json()).actor.role, 'EMPLOYEE');
    await pending.getByText('กะของฉัน', { exact: true }).first().waitFor({ state: 'attached' });
  } else {
    assert.equal(fixture.mode, 'manager');
    const page = await pageFor(fixture.session);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    await page.locator(`[data-click='SF.nav("people")']`).first().click();
    const row = page.locator(`#central-people [data-employee-code="${fixture.employeeCode}"]`);
    await row.getByRole('button', { name: 'แก้ไข', exact: true }).click();
    const form = page.locator('#centralEmployeeForm');

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const { name, fields, formWidth, scrollWidth } = await form.evaluate(element => {
        const box = node => node.getBoundingClientRect().toJSON();
        return {
          name: box(element.querySelector('p')),
          fields: ['teamCode', 'effectiveOn', 'role', 'position'].map(key => box(element.elements[key])),
          formWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      });
      assert.ok(name.bottom < fields[0].top, `Employee name should sit above the fields at ${width}px`);
      assert.ok(scrollWidth <= formWidth, `Form should fit without horizontal scrolling at ${width}px`);
      if (width === 1440) {
        assert.equal(fields[0].width, fields[1].width);
        assert.equal(fields[2].width, fields[3].width);
        assert.equal(fields[0].top, fields[1].top);
        assert.equal(fields[2].top, fields[3].top);
        assert.ok(fields.every(field => field.width >= 180));
      } else {
        assert.ok(fields.every(field => Math.abs(field.width - formWidth) <= 1));
        assert.ok(fields.slice(1).every((field, index) => field.top > fields[index].bottom));
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await form.locator('#centralEmployeeTeam').selectOption('D');
    await form.locator('#centralEmployeeEffectiveOn').fill('2026-11-16');
    const saved = responseFor(page, `/api/manager/people/${fixture.employeeId}`, 'PATCH');
    await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง', exact: true }).click();
    const result = await saved;
    assert.equal(result.status(), 200, await result.text());
    await form.waitFor({ state: 'detached' });
    assert.match(await row.textContent(), /Shift D/);
  }
  assert.deepEqual(errors, []);
  console.log(`Milestone 4 ${fixture.mode} browser check passed.`);
} finally {
  await browser.close();
}
