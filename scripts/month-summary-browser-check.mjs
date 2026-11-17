import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});

const december = {
  1: { shift_code: 'M' },
  2: { shift_code: 'M', swap: { originalShiftCode: 'O' } },
  3: { shift_code: 'O', swap: { originalShiftCode: 'N' } },
  4: { shift_code: 'D', start_time: '08:00:00', end_time: '16:30:00' },
  5: { shift_code: 'N', holidayOvertime: { shiftCode: 'NT', holidayDate: '2026-12-05' } },
  6: { shift_code: 'NT' },
  7: { shift_code: 'L', leaveBaseCode: 'N', leaveMinutes: 690 },
  9: { shift_code: 'MTh' },
  31: { shift_code: 'N' },
};

const officeShift = { shift_code: 'D', start_time: '08:00:00', end_time: '16:30:00' };
const localSlots = { 4: officeShift, 5: officeShift, 6: officeShift, 7: { shift_code: 'N', start_time: '20:00:00', end_time: '06:00:00' }, 8: officeShift };
const applied = [
  { d: 4, code: 'M', from: 'D', prev: null },
  { d: 5, code: 'VGh', from: 'D', prev: null },
  { d: 6, code: 'L', from: 'N', prev: 'N' },
  { d: 7, code: 'NTh', from: 'N', prev: null },
  { d: 8, code: 'D', from: 'D', prev: null },
].map(row => ({ empId: 'DEMO-A1', y: 2026, m: 11, ...row }));
const localSchedule = {
  scheduleOverrides: { '2026-11': { 'DEMO-A1': Object.fromEntries(applied.map(slot => [slot.d, slot.code])) } },
  localRequests: applied.map((slot, index) => ({
    id: index + 1, y: slot.y, m: slot.m, day: slot.d, status: 'อนุมัติแล้ว', type: 'ปรับกะ',
    requesterId: slot.empId, applied: [slot],
  })),
};

function roster(month, decemberSlots, absenceHistoryAvailable) {
  if (month === '2027-02') return { month, schedule: null, assignments: [] };
  const [year, number] = month.split('-').map(Number);
  const slots = month === '2026-12' ? decemberSlots : { 1: { shift_code: 'M' } };
  const assignments = Array.from({ length: new Date(year, number, 0).getDate() }, (_, i) => {
    const day = i + 1;
    const slot = Object.hasOwn(slots, day) ? slots[day] : { shift_code: 'O' };
    return slot && {
      assignment_id: number * 100 + day, employee_id: 1, employee_code: 'DEMO-A1',
      name: 'พนักงานทดสอบ A1', position: 'OPERATOR', team_id: 1, team_code: 'A', status: 'ACTIVE',
      work_date: `${month}-${String(day).padStart(2, '0')}`, is_working: !['O', 'L'].includes(slot.shift_code), ...slot,
    };
  }).filter(Boolean);
  const holidayOvertimePreview = month === '2026-12'
    ? [{ workDate: '2026-12-01', holidayDate: '2026-12-01', shiftCode: 'MT' }]
    : [];
  return { month, schedule: { status: 'PUBLISHED' }, assignments, holidayOvertimePreview, absenceHistoryAvailable };
}

try {
  for (const [width, local] of [[1440, false], [320, false], [390, true]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
    await page.clock.setFixedTime(new Date(local ? '2026-12-17T16:00:00+07:00' : '2027-01-01T00:30:00+07:00'));
    if (local) {
      await page.addInitScript(data => localStorage.setItem('shiftflow.web.demo.v1', JSON.stringify(data)), localSchedule);
    }
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let slots = local ? localSlots : december;
    let absenceHistoryAvailable = true;
    await page.route(`${origin}/**`, route => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role: 'EMPLOYEE', employeeId: 1, teamCode: 'A' },
        capabilities: local ? {} : { remotePilot: true, centralSwap: true, centralHoliday: true, monthClose: true },
      } });
      if (pathname === '/api/schedules') return route.fulfill({ json: roster(searchParams.get('month'), slots, absenceHistoryAvailable) });
      if (pathname === '/api/settings/swap-quota/mine') return route.fulfill({ json: { remaining: 2, limit: 2 } });
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });

    await page.goto(origin);
    const calendar = page.getByRole('region', { name: 'ปฏิทินกะของฉัน' });
    const summary = page.getByRole('region', { name: 'สรุปตารางกะประจำเดือน' });
    const value = label => summary.getByText(label, { exact: true }).locator('..').locator('dd');
    const check = async (label, expected) => {
      await value(label).filter({ hasText: expected }).waitFor();
      assert.equal(await value(label).innerText(), expected, label);
    };
    const prev = calendar.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true });
    const next = calendar.getByRole('button', { name: 'เดือนถัดไป', exact: true });
    const refresh = () => page.evaluate(async () => (await import('/src/app/session.js')).afterApi());

    if (local) {
      await check('ทำงานปกติ', '20 ชม. 30 นาที / 2 กะ');
      await check('OT ปกติ', '6 ชม. / 1 กะ');
      await check('ลา', '16 ชม. 15 นาที / 1.5 กะ');
      await check('รวมเวลาทำงานตามตาราง', '26 ชม. 30 นาที / 3 กะ');
      assert.deepEqual(errors, []);
      await page.close();
      continue;
    }

    await check('รวมเวลาทำงานตามตาราง', '12 ชม. / 1 กะ');
    await prev.click();
    await check('ทำงานปกติ', '44 ชม. 30 นาที / 4 กะ');
    await check('OT ปกติ', '18 ชม. / 2 กะ');
    await check('OT นักขัตฤกษ์', '12 ชม. / 1 กะ');
    await check('ลา', '11 ชม. 30 นาที / 1 กะ');
    await check('ขาดงาน', 'ยังไม่มีรายการขาดงานที่บันทึก');
    await check('รวมเวลาทำงานตามตาราง', '74 ชม. 30 นาที / 7 กะ');
    await check('OT คำนวณย้อนหลัง', '1 กะ');
    assert.ok(await summary.locator('dd').evaluateAll(values => values.every(value => value.scrollWidth <= value.clientWidth)));
    if (width === 1440) {
      const { width: calendarWidth } = await calendar.boundingBox();
      const { width: summaryWidth, y: summaryTop } = await summary.boundingBox();
      const { x: requestsLeft, width: requestsWidth } = await page.getByRole('complementary', { name: 'คำขอของฉัน' }).boundingBox();
      const { x: summaryLeft } = await summary.boundingBox();
      const { y: hintTop, height: hintHeight } = await calendar.locator('.my-cal-hint').boundingBox();
      assert.ok(summaryWidth > calendarWidth && Math.abs(summaryLeft + summaryWidth - requestsLeft - requestsWidth) < 2);
      assert.ok(summaryTop >= hintTop + hintHeight);
      const headline = await summary.locator('.my-sum-header').evaluate(header => {
        const [title, total] = Array.from(header.children, element => element.getBoundingClientRect());
        const box = header.getBoundingClientRect();
        return { sharedLine: title.bottom > total.top && total.bottom > title.top,
          centerOffset: Math.abs((title.left + total.right) / 2 - (box.left + box.right) / 2) };
      });
      assert.ok(headline.sharedLine && headline.centerOffset < 2);
      const gapDifference = await summary.evaluate(section => {
        const header = section.querySelector('.my-sum-header').getBoundingClientRect();
        const stats = section.querySelector('.my-stats').getBoundingClientRect();
        const card = section.parentElement.getBoundingClientRect();
        return Math.abs((stats.top - header.bottom) - (card.bottom - stats.bottom));
      });
      assert.ok(gapDifference < 1, 'The metric row has equal space above and below');
    }

    slots = { ...december, 5: { ...december[5], absence: { id: 1, shiftCode: 'NT', startTime: '19:30:00', endTime: '07:30:00' } } };
    await refresh();
    await check('ขาดงาน', '12 ชม. / 1 กะ');
    await check('OT นักขัตฤกษ์', '0 ชม. / 0 กะ');
    await check('รวมเวลาทำงานตามตาราง', '62 ชม. 30 นาที / 6 กะ');
    await calendar.getByRole('button', { name: /^5 ธันวาคม.+ขาดงาน/ }).getByText('ขาดงาน', { exact: true }).waitFor();
    slots = december;
    await refresh();
    await check('ขาดงาน', 'ยังไม่มีรายการขาดงานที่บันทึก');
    await check('OT นักขัตฤกษ์', '12 ชม. / 1 กะ');
    await check('รวมเวลาทำงานตามตาราง', '74 ชม. 30 นาที / 7 กะ');

    slots = { ...december, 7: { shift_code: 'L' }, 8: { shift_code: 'OT' }, 31: null };
    await refresh();
    await check('ลา', 'ไม่ทราบชั่วโมง / 1 กะ');
    await check('OT ปกติ', 'อย่างน้อย 18 ชม. / 3 กะ');
    await check('รวมเวลาทำงานตามตาราง', 'อย่างน้อย 62 ชม. 30 นาที / อย่างน้อย 7 กะ');
    await summary.getByText('ข้อมูลกะไม่ครบ สรุปจากรายการที่มีข้อมูล', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await summary.locator('dd').evaluateAll(values => values.every(value => value.scrollWidth <= value.clientWidth)));

    slots = december;
    absenceHistoryAvailable = false;
    await refresh();
    await check('ขาดงาน', 'พ้นระยะเวลาเก็บประวัติขาดงาน');
    await check('รวมเวลาทำงานตามตาราง', 'ยืนยันยอดรวมไม่ได้');

    absenceHistoryAvailable = true;
    await refresh();
    await next.click();
    await check('รวมเวลาทำงานตามตาราง', '12 ชม. / 1 กะ');
    await next.click();
    await summary.getByRole('heading', { name: 'สรุปกะคาดการณ์' }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Chrome passed: hours by shift type, approved leave and swap, local overrides, absence add/cancel reads, historical preview, month boundary, and incomplete/projected rosters (desktop and mobile).');
} finally {
  await browser.close();
}
