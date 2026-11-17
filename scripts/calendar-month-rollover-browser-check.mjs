import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const cases = [
  { role: 'EMPLOYEE', width: 1440, stayOnCurrent: true },
  { role: 'EMPLOYEE', width: 390, stayOnCurrent: false },
  { role: 'SUPERVISOR', width: 1440, stayOnCurrent: true },
  { role: 'SUPERVISOR', width: 390, stayOnCurrent: false },
  { role: 'EMPLOYEE', width: 1440, stayOnCurrent: true, yearEnd: true },
];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});

function roster(month, role) {
  if (month === '2027-03') return { month, schedule: null, assignments: [] };
  const [year, number] = month.split('-').map(Number);
  const assignments = Array.from({ length: new Date(year, number, 0).getDate() }, (_, index) => ({
    assignment_id: number * 100 + index + 1,
    employee_id: 1,
    employee_code: 'DEMO-A1',
    team_id: 1,
    team_code: 'A',
    name: 'พนักงานทดสอบ A1',
    position: role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERATOR',
    status: 'ACTIVE',
    work_date: `${month}-${String(index + 1).padStart(2, '0')}`,
    shift_code: 'M',
    is_working: true,
  }));
  const holidays = month === '2026-12' ? [{ date: '2026-12-05', name: 'วันพ่อแห่งชาติ' }] : [];
  if (holidays.length) assignments[4].holidayOvertime = { holidayDate: '2026-12-05', shiftCode: 'MT' };
  const holidayOvertimePreview = month === '2026-10'
    ? [{ holidayDate: '2026-10-13', workDate: '2026-10-13', shiftCode: 'MT' }]
    : [];
  const status = month === '2027-02' ? 'DRAFT' : 'PUBLISHED';
  return { month, schedule: { status }, assignments, holidays, holidayOvertimePreview };
}

try {
  for (const { role, width, stayOnCurrent, yearEnd } of cases) {
    const currentMonth = yearEnd ? 'ธันวาคม 2569' : 'พฤศจิกายน 2569';
    const previousMonth = yearEnd ? 'พฤศจิกายน 2569' : 'ตุลาคม 2569';
    const nextMonth = yearEnd ? 'มกราคม 2570' : 'ธันวาคม 2569';
    const monthEndDay = yearEnd ? 31 : 30;
    const monthEnd = yearEnd ? '2026-12-31' : '2026-11-30';
    const page = await browser.newPage({ timezoneId: 'America/Los_Angeles', viewport: { width, height: 960 } });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date(`${monthEnd}T16:58:55Z`) });
    await page.clock.pauseAt(new Date(`${monthEnd}T16:59:01Z`));
    await page.route(`${origin}/**`, route => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role, employeeId: 1, teamCode: 'A' },
        capabilities: { remotePilot: true, centralSwap: true, centralLeave: true, centralHoliday: true, swapPolicy: true, monthClose: true },
      } });
      if (pathname === '/api/schedules') return route.fulfill({ json: roster(searchParams.get('month'), role) });
      if (pathname === '/api/settings/swap-quota/mine') return route.fulfill({ json: { remaining: 2, limit: 2 } });
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });
    const header = page.locator('.my-now');
    const calendar = page.getByRole('region', { name: 'ปฏิทินกะของฉัน' });
    const marker = calendar.locator('[aria-current="date"]');
    const previous = calendar.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true });
    const next = calendar.getByRole('button', { name: 'เดือนถัดไป', exact: true });
    const today = calendar.getByRole('button', { name: 'เดือนนี้', exact: true });
    const locked = calendar.getByText('ข้อมูลถูกล็อก', { exact: true });
    const dialog = page.getByRole('dialog');
    const dayButton = (month, day) => calendar.getByRole('button', { name: new RegExp(`^${day} ${month}`) });
    const assertMonth = async month => {
      await calendar.getByRole('button', { name: month, exact: true }).waitFor();
      await calendar.getByText('ประกาศใช้แล้ว', { exact: true }).waitFor();
    };
    const assertCurrentDay = async (month, day) => {
      await assertMonth(month);
      await header.getByText('กะวันนี้', { exact: true }).waitFor({ timeout: 5000 });
      assert.equal(await marker.count(), 1);
      assert.equal(await calendar.locator('.cal-d.tdy').count(), 1);
      assert.equal(await marker.locator('.n').innerText(), String(day));
      assert.match(await header.locator('.my-duty-date strong').innerText(), new RegExp(`ที่ ${day} ${month}`));
      assert.equal(await header.getByRole('button', { name: 'ยื่นคำขอ', exact: true }).count(), 1);
      assert.equal(await locked.count(), 0);
    };
    const assertOtherMonth = async (month, shouldBeLocked) => {
      await assertMonth(month);
      assert.equal(await header.count(), 0);
      assert.equal(await calendar.locator('.cal-d.tdy, [aria-current="date"]').count(), 0);
      assert.equal(await locked.count(), shouldBeLocked ? 1 : 0);
      assert.equal(await page.getByRole('region', { name: 'สรุปตารางกะประจำเดือน' }).getByText('สรุปตารางกะ', { exact: true }).count(), 1);
    };
    const assertDayRequest = async (month, day, expectedOption) => {
      await dayButton(month, day).click();
      await dialog.waitFor();
      if (expectedOption) await dialog.getByRole('button', { name: expectedOption }).waitFor();
      else assert.equal(await dialog.locator('.request-option').count(), 0);
      await page.keyboard.press('Escape');
    };
    const openMyShift = async () => {
      if (role === 'SUPERVISOR') await page.getByRole('button', { name: 'กะของฉัน', exact: true }).first().press('Enter');
    };
    await page.goto(origin);
    await openMyShift();
    await assertCurrentDay(currentMonth, monthEndDay);
    assert.equal(await calendar.locator('.cal-d.past').count(), monthEndDay - 1);
    await assertDayRequest(currentMonth, monthEndDay - 1);
    await previous.click();
    await assertOtherMonth(previousMonth, true);
    assert.equal(await calendar.locator('.cal-d:not(.past)').count(), 0);
    await assertDayRequest(previousMonth, 13);
    if (!yearEnd) {
      assert.equal(await dayButton(previousMonth, 13).locator('.cal-code').innerText(), 'MT');
      await calendar.getByText('OT นักขัตฤกษ์ · ผลคำนวณย้อนหลัง', { exact: true }).waitFor();
    }
    await today.click();
    await assertCurrentDay(currentMonth, monthEndDay);
    await next.click();
    await assertOtherMonth(nextMonth, false);
    assert.equal(await calendar.locator('.cal-d.past').count(), 0);
    await assertDayRequest(nextMonth, 2, /ขอลา/);
    if (!yearEnd) {
      assert.equal(await dayButton(nextMonth, 5).locator('.cal-code').innerText(), 'MT');
      await assertDayRequest(nextMonth, 5, /ใช้สิทธิ์วันหยุดนักขัตฤกษ์/);
    }
    if (stayOnCurrent) await today.click();

    if (yearEnd) {
      await page.clock.setSystemTime(new Date('2026-12-31T17:00:00Z'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    } else {
      await page.clock.fastForward(58_000);
      if (stayOnCurrent) await assertCurrentDay(currentMonth, monthEndDay);
      else await assertOtherMonth(nextMonth, false);
      await page.clock.fastForward(1_000);
    }
    if (stayOnCurrent) {
      await header.waitFor({ state: 'detached', timeout: 5000 });
      await assertOtherMonth(currentMonth, true);
      await today.click();
    }
    await assertCurrentDay(nextMonth, 1);
    await assertDayRequest(nextMonth, 1, /ขอลา/);
    await previous.click();
    await assertOtherMonth(currentMonth, true);
    await assertDayRequest(currentMonth, monthEndDay);
    await page.reload();
    await openMyShift();
    await assertCurrentDay(nextMonth, 1);
    if (yearEnd) {
      await next.click();
      await calendar.getByText('ฉบับร่าง ยังไม่ประกาศใช้', { exact: true }).waitFor();
      assert.equal(await header.count(), 0);
      await assertDayRequest('กุมภาพันธ์ 2570', 2);
      await next.click();
      await calendar.getByText('ตารางกะคาดการณ์ · ดูได้อย่างเดียว', { exact: true }).waitFor();
      assert.equal(await header.count(), 0);
      await assertDayRequest('มีนาคม 2570', 2);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Chrome passed: previous/current/next month states, Bangkok November and year-end rollovers, request access, holiday OT, draft and projected rosters (5 cases).');
} finally {
  await browser.close();
}
