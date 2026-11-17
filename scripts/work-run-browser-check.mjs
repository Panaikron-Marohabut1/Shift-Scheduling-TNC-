import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const runFromScreenshot = {
  '2026-11-16': { shift_code: 'M' },
  '2026-11-17': { shift_code: 'M' },
  '2026-11-18': { shift_code: 'N', swap: { originalShiftCode: 'O' } },
  '2026-11-19': { shift_code: 'NT' },
  '2026-11-20': { shift_code: 'N', holidayOvertime: { shiftCode: 'NT' } },
  '2026-11-21': { shift_code: 'N' },
};
const cases = [
  { name: 'screenshot and refresh after an approved swap', date: '2026-11-17', slots: runFromScreenshot,
    count: '6 / 6 วัน', refresh: true },
  { name: 'swap to work, OT, and scheduled holiday OT', date: '2026-11-20', slots: runFromScreenshot, count: '6 / 6 วัน' },
  { name: 'day off resets the count', date: '2026-11-22', slots: runFromScreenshot, count: '0 / 6 วัน' },
  { name: 'swap to off cuts the run', date: '2026-11-18', slots: {
    ...runFromScreenshot, '2026-11-17': { shift_code: 'O', swap: { originalShiftCode: 'M' } },
  }, count: '4 / 6 วัน' },
  { name: 'approved ordinary leave cuts the run', date: '2026-11-19', slots: {
    ...runFromScreenshot, '2026-11-18': { shift_code: 'L' },
  }, count: '3 / 6 วัน' },
  { name: 'approved holiday leave is not work', date: '2026-11-18', slots: {
    ...runFromScreenshot, '2026-11-18': { shift_code: 'L', holidayLeave: { holidayDate: '2026-11-16' } },
  }, count: '0 / 6 วัน' },
  { name: 'previous month is counted', date: '2026-12-01', slots: {
    '2026-11-30': { shift_code: 'M' }, '2026-12-01': { shift_code: 'M' },
  }, count: '2 / 6 วัน' },
  { name: 'January loads only December from the previous year', date: '2027-01-01', boundary: '2026-12', slots: {
    '2026-12-31': { shift_code: 'M' }, '2027-01-01': { shift_code: 'M' },
  }, count: '2 / 6 วัน' },
  { name: 'December includes published January shifts', date: '2026-12-31', boundary: '2027-01', slots: {
    '2026-12-31': { shift_code: 'M' }, '2027-01-01': { shift_code: 'M' },
  }, count: '2 / 6 วัน' },
  { name: 'draft shifts are excluded', date: '2026-12-31', boundary: '2027-01', draft: '2027-01', slots: {
    '2026-12-31': { shift_code: 'M' }, '2027-01-01': { shift_code: 'M' },
  }, count: 'อย่างน้อย 1 / 6 วัน' },
  { name: 'a missing day is not counted as work or treated as a known break', date: '2026-11-19', slots: {
    ...runFromScreenshot, '2026-11-18': null,
  }, count: 'อย่างน้อย 3 / 6 วัน' },
  { name: 'an absent assignment today is not reported as a day off', date: '2026-11-19', slots: {
    ...runFromScreenshot, '2026-11-19': null,
  }, count: 'ข้อมูลกะไม่ครบ' },
];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});

try {
  for (const [index, scenario] of cases.entries()) {
    const page = await browser.newPage({ timezoneId: 'America/Los_Angeles', viewport: { width: index % 2 ? 390 : 1440, height: 960 } });
    page.setDefaultTimeout(5000);
    const months = new Set();
    const errors = [];
    let slots = scenario.slots;
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/**`, route => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role: 'EMPLOYEE', employeeId: 1, teamCode: 'A' },
        capabilities: { remotePilot: true, centralSwap: true, monthClose: true, maxConsecutiveWorkDays: 6 },
      } });
      if (pathname === '/api/schedules') {
        const month = searchParams.get('month');
        months.add(month);
        const [year, number] = month.split('-').map(Number);
        const assignments = Array.from({ length: new Date(year, number, 0).getDate() }, (_, i) => {
          const work_date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const slot = Object.hasOwn(slots, work_date) ? slots[work_date] : { shift_code: 'O' };
          return slot && {
            assignment_id: i + 1, employee_id: 1, employee_code: 'DEMO-A1', name: 'พนักงานทดสอบ A1',
            position: 'OPERATOR', team_id: 1, team_code: 'A', status: 'ACTIVE', work_date,
            is_working: !['O', 'L'].includes(slot.shift_code), ...slot,
          };
        }).filter(Boolean);
        return route.fulfill({ json: { schedule: { status: month === scenario.draft ? 'DRAFT' : 'PUBLISHED' }, assignments } });
      }
      if (pathname === '/api/settings/swap-quota/mine') return route.fulfill({ json: { remaining: 2, limit: 2 } });
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });
    await page.goto(`${origin}/?today=${scenario.date}`);
    const header = page.getByRole('region', { name: 'กะประจำวัน' });
    const fact = (label) => header.getByText(label, { exact: true }).locator('..').locator('dd');
    await header.waitFor();
    if (scenario.draft) {
      await page.waitForFunction(async month => {
        const { state } = await import('/src/app/state.js');
        const [year, number] = month.split('-').map(Number);
        return state.apiMonths[`${year}-${number - 1}`]?.schedule?.status === 'DRAFT';
      }, scenario.draft);
    }
    const run = fact('ทำงานต่อเนื่องตามตาราง');
    await run.filter({ hasText: scenario.count }).waitFor();
    assert.equal(await run.innerText(), scenario.count, scenario.name);
    assert.equal(await header.getByText('ทำงานต่อเนื่องถึงวันนี้', { exact: true }).count(), 0);
    assert.equal(await header.getByText('ตามตารางรอบนี้', { exact: true }).count(), 0);
    if (scenario.boundary) {
      const otherYear = [...months].filter(month => !month.startsWith(scenario.date.slice(0, 4)));
      assert.deepEqual(otherYear, [scenario.boundary]);
    }
    if (scenario.refresh) {
      slots = { ...slots, '2026-11-16': { shift_code: 'O', swap: { originalShiftCode: 'M' } } };
      await page.evaluate(async () => {
        const { state } = await import('/src/app/state.js');
        const { afterApi } = await import('/src/app/session.js');
        state.managerConfig.maxConsecutiveWorkDays = 9;
        await afterApi();
      });
      assert.equal(await run.innerText(), '5 / 6 วัน');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), scenario.name);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${scenario.name}`);
  }
} finally {
  await browser.close();
}
