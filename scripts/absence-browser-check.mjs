import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const browser = await chromium.launch({
  headless: true, executablePath: process.env.BROWSER_EXECUTABLE,
  args: [`--unsafely-treat-insecure-origin-as-secure=${origin}`],
});

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(5000);
    let absence = null;
    let writes = 0;
    const requests = [];
    let holiday = { holidayDate: '2026-11-19', shiftCode: 'NT' };
    await page.route(`${origin}/**`, route => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role: 'MANAGER', employeeId: null },
        capabilities: { remotePilot: true, absenceTracking: true, monthClose: true },
      } });
      if (pathname === '/api/schedules/assignments/123/absence') {
        const input = route.request().postDataJSON();
        requests.push(input);
        if (++writes === 1) {
          holiday = { ...holiday, holidayDate: '2026-11-18' };
          return route.fulfill({ status: 409, json: { code: 'ABSENCE_CHANGED', message: 'กรุณาลองใหม่' } });
        }
        absence = input.active ? { id: 99, shiftCode: 'NT', startTime: '19:30:00', endTime: '07:30:00', holidayDate: holiday.holidayDate } : null;
        return route.fulfill({ json: { absence } });
      }
      if (pathname === '/api/schedules') {
        const month = searchParams.get('month');
        const assignment = (day, id, code) => ({
          assignment_id: id, employee_id: 1, employee_code: 'DEMO-D1', team_id: 4, team_code: 'D',
          name: 'พนักงานทดสอบ D1', position: 'OPERATOR', status: 'ACTIVE', version: 2,
          work_date: `${month}-${day}`, shift_code: code, is_working: code !== 'O',
        });
        const work = assignment('19', 123, 'N');
        const assignments = [work, assignment('20', 124, 'O')];
        if (month === '2026-11') Object.assign(work, { holidayOvertime: holiday, absence });
        return route.fulfill({ json: { schedule: { status: 'PUBLISHED' }, assignments, absenceHistoryAvailable: true } });
      }
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });

    await page.goto(`${origin}/?today=2026-11-17`);
    await page.getByRole('button', { name: 'ตารางกะ', exact: true }).first().press('Enter');
    const grid = page.getByRole('region', { name: 'ตารางกะรายเดือน' });
    const gridCell = day => grid.locator(`button[data-click='SF.cell("DEMO-D1", ${day})']`);
    const dialog = page.getByRole('dialog');
    const mark = dialog.getByRole('button', { name: 'บันทึกขาดงาน', exact: true });
    const cancel = dialog.getByRole('button', { name: 'ยกเลิกการบันทึกขาดงาน', exact: true });
    await gridCell(19).press('Enter');
    await mark.press('Enter');
    await page.getByText('กรุณาลองใหม่', { exact: true }).waitFor();
    await dialog.getByText('18 พ.ย. 2569', { exact: true }).waitFor();
    assert.equal(await cancel.count(), 0);
    await mark.press('Enter');
    await cancel.waitFor();
    assert.equal(await gridCell(19).locator('..').getAttribute('class').then(value => value.includes('is-absent')), true);
    await cancel.press('Enter');
    await mark.waitFor();
    assert.equal(await gridCell(19).innerText(), 'NT');
    assert.match(await gridCell(19).locator('..').getAttribute('class'), /is-holiday-ot/);
    assert.deepEqual(requests, [
      { active: true, version: 2, absenceId: null, holidayDate: '2026-11-19' },
      { active: true, version: 2, absenceId: null, holidayDate: '2026-11-18' },
      { active: false, version: 2, absenceId: 99 },
    ]);
    await page.keyboard.press('Escape');
    await gridCell(20).press('Enter');
    await dialog.waitFor();
    assert.equal(await mark.count(), 0);
    await page.keyboard.press('Escape');
    await grid.getByRole('button', { name: 'เดือนก่อนหน้า' }).click();
    await gridCell(19).press('Enter');
    await dialog.waitFor();
    assert.equal(await mark.count(), 0);
    assert.equal(writes, 3);
    await page.close();
  }
  console.log('Chrome passed: Manager mark, conflict recovery, cancellation, original holiday OT, off days and locked month (desktop and mobile).');
} finally {
  await browser.close();
}
