import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const employeeCode = 'DEMO-A1';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});

function roster(month) {
  const [year, number] = month.split('-').map(Number);
  const december = month === '2026-12';
  const assignments = Array.from({ length: new Date(year, number, 0).getDate() }, (_, index) => {
    const day = index + 1;
    const shift = december ? { 5: 'N', 6: 'NT', 7: 'O', 8: 'M', 9: 'MT' }[day] ?? 'M' : 'M';
    const source = december ? { 5: { holidayDate: '2026-12-05', shiftCode: 'NT' }, 8: { holidayDate: '2026-12-07', shiftCode: 'MT' } }[day] : undefined;
    return {
      assignment_id: number * 100 + day,
      employee_id: 1,
      employee_code: employeeCode,
      team_id: 1,
      team_code: 'A',
      name: 'พนักงานทดสอบ A1',
      position: 'OPERATOR',
      status: 'ACTIVE',
      work_date: `${month}-${String(day).padStart(2, '0')}`,
      shift_code: shift,
      is_working: shift !== 'O',
      holidayOvertime: source,
    };
  });
  const holidays = december ? [
    { date: '2026-12-05', name: 'วันพ่อแห่งชาติ' },
    { date: '2026-12-07', name: 'ชดเชยวันพ่อแห่งชาติ' },
  ] : [];
  const holidayOvertimePreview = month === '2026-10'
    ? [{ holidayDate: '2026-10-13', workDate: '2026-10-13', shiftCode: 'MT' }]
    : [];
  return { month, schedule: { status: 'PUBLISHED' }, assignments, holidays, holidayOvertimePreview };
}

const markerStyles = {
  regular: { background: 'rgb(232, 89, 12)', radius: '50%', rotated: false },
  holiday: { background: 'rgb(156, 31, 94)', radius: '1px', rotated: true },
};
async function assertMarker(locator, kind) {
  const actual = await locator.evaluate(el => {
    const mark = getComputedStyle(el, '::after');
    return { background: mark.backgroundColor, radius: mark.borderRadius, rotated: mark.transform !== 'none' };
  });
  assert.deepEqual(actual, markerStyles[kind]);
}

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/**`, route => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (pathname === '/api/me') return route.fulfill({ json: {
        actor: { role: 'EMPLOYEE', employeeId: 1, teamCode: 'A' },
        capabilities: { remotePilot: true, centralSwap: true, centralLeave: true, centralHoliday: true, swapPolicy: true, monthClose: true },
      } });
      if (pathname === '/api/schedules') return route.fulfill({ json: roster(searchParams.get('month')) });
      if (pathname === '/api/settings/swap-quota/mine') return route.fulfill({ json: { remaining: 2, limit: 2 } });
      if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
    });
    await page.goto(`${origin}/?today=2026-12-08`);
    const dialog = page.getByRole('dialog');
    const calendar = page.getByRole('region', { name: 'ปฏิทินกะของฉัน' });
    const legend = root => root.getByRole('group', { name: 'สัญลักษณ์ OT' });
    const calendarDay = (day, month = 'ธันวาคม') => calendar.getByRole('button', { name: new RegExp(`^${day} ${month}`) });
    const assertSource = async button => {
      await button.click();
      await dialog.getByText('OT จากวันหยุดนักขัตฤกษ์', { exact: true }).waitFor();
      await dialog.getByText(/7 ธ\.ค\. 2569 · ชดเชยวันพ่อแห่งชาติ/).waitFor();
      await page.keyboard.press('Escape');
    };
    await legend(calendar).getByText('OT ปกติ', { exact: true }).waitFor();
    await legend(calendar).getByText('OT นักขัตฤกษ์', { exact: true }).waitFor();
    for (const [day, code, kind] of [[5, 'NT', 'holiday'], [6, 'NT', 'regular'], [8, 'MT', 'holiday'], [9, 'MT', 'regular']]) {
      const button = calendarDay(day);
      assert.equal(await button.locator('.cal-code').innerText(), code);
      assert.match(await button.getAttribute('aria-label'), kind === 'holiday' ? /OT นักขัตฤกษ์/ : /OT ปกติ/);
      await assertMarker(button, kind);
    }
    assert.equal(await calendarDay(10).evaluate(el => getComputedStyle(el, '::after').content), 'none');
    await assertMarker(page.locator('.today-chip'), 'holiday');
    await assertSource(calendarDay(8));
    await calendarDay(9).click();
    await dialog.getByText('OT ปกติ', { exact: true }).waitFor();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'ตารางกะทุกทีม', exact: true }).click();
    const grid = page.getByRole('region', { name: 'ตารางกะรายเดือน' });
    await legend(grid).getByText('OT นักขัตฤกษ์', { exact: true }).waitFor();
    const monthStatus = grid.getByRole('group', { name: 'สถานะตารางกะ' });
    await monthStatus.getByText('ประกาศใช้แล้ว', { exact: true }).waitFor();
    const shiftKey = grid.locator('.legend');
    assert.deepEqual(await shiftKey.getByRole('heading').allTextContents(), ['กะทำงาน', 'OT', 'ลาและวันพัก', 'วันตามปฏิทิน', 'การเปลี่ยนแปลง']);
    assert.equal(await shiftKey.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await shiftKey.getByRole('button', { name: 'รหัสกะทั้งหมด' }).press('Enter');
    const codeDialog = page.getByRole('dialog', { name: 'ความหมายรหัสกะ' });
    await codeDialog.waitFor();
    const codeTable = codeDialog.getByRole('table');
    assert.deepEqual(await codeTable.getByRole('columnheader').allTextContents(), ['รหัส', 'ความหมาย', 'เวลาและรายละเอียด']);
    await codeTable.getByRole('row', { name: /^MT กะเช้า/ }).getByText('07:30–19:30', { exact: true }).waitFor();
    const codeBody = codeDialog.locator('.modal-body');
    assert.equal(await codeBody.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await codeDialog.getByRole('heading', { name: 'สัญลักษณ์ในตาราง' }).scrollIntoViewIfNeeded();
    assert.equal(await codeBody.evaluate(el => el.scrollTop > 0), true);
    await codeDialog.getByText('OT นักขัตฤกษ์', { exact: true }).waitFor();
    await codeDialog.locator('footer').getByRole('button', { name: 'ปิด' }).click();
    await codeDialog.waitFor({ state: 'hidden' });
    await shiftKey.getByRole('button', { name: 'รหัสกะทั้งหมด' }).press('Enter');
    await codeDialog.waitFor();
    await page.keyboard.press('Escape');
    const gridButton = day => grid.locator(`button[data-click='SF.cell("${employeeCode}", ${day})']`);
    for (const [day, code, kind] of [[5, 'NT', 'holiday'], [6, 'NT', 'regular'], [8, 'MT', 'holiday'], [9, 'MT', 'regular']]) {
      const button = gridButton(day);
      assert.equal(await button.innerText(), code);
      const cell = button.locator('..');
      await assertMarker(cell, kind);
      assert.equal(await cell.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
    }
    const header = grid.locator('thead th');
    assert.match(await header.nth(5).getAttribute('class'), /\bhol\b/);
    assert.match(await header.nth(6).getAttribute('class'), /\bwe\b/);
    assert.notEqual(await header.nth(5).evaluate(el => getComputedStyle(el).backgroundColor), await header.nth(6).evaluate(el => getComputedStyle(el).backgroundColor));
    await assertSource(gridButton(8));
    await page.getByRole('button', { name: 'รายวัน', exact: true }).click();
    assert.equal(await page.locator('.day-ot-kind').innerText(), 'OT นักขัตฤกษ์');
    await assertMarker(page.locator('.daycol .chip.is-holiday-ot'), 'holiday');
    await page.getByRole('button', { name: 'กะของฉัน', exact: true }).first().press('Enter');
    const previous = calendar.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true });
    await previous.click();
    await calendar.getByRole('button', { name: 'พฤศจิกายน 2569', exact: true }).waitFor();
    assert.equal(await legend(calendar).count(), 0);
    await previous.click();
    const preview = calendarDay(13, 'ตุลาคม');
    await legend(calendar).getByText('OT นักขัตฤกษ์', { exact: true }).waitFor();
    assert.match(await preview.getAttribute('aria-label'), /OT นักขัตฤกษ์ ผลคำนวณย้อนหลัง/);
    await assertMarker(preview, 'holiday');
    await preview.click();
    await dialog.getByText('วันนักขัตฤกษ์ที่ใช้คำนวณ', { exact: true }).waitFor();
    assert.equal(await dialog.locator('.kinds button').count(), 0);
    await page.keyboard.press('Escape');
    await previous.click();
    await previous.click();
    await calendarDay(12, 'สิงหาคม').getByText('วันแม่แห่งชาติ', { exact: true }).waitFor();
    assert.equal(await calendar.getByText('วันหยุดนักขัตฤกษ์ · ข้อมูลทดสอบ', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'ตารางกะทุกทีม', exact: true }).click();
    await page.getByRole('button', { name: 'รายเดือน', exact: true }).click();
    await header.nth(12).waitFor();
    assert.equal(await header.nth(12).getAttribute('title'), 'วันแม่แห่งชาติ');
    await monthStatus.getByText('ข้อมูลถูกล็อก', { exact: true }).waitFor();
    assert.equal(await monthStatus.getByText('วันหยุดนักขัตฤกษ์ · ข้อมูลทดสอบ', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Chrome passed: OT markers and provenance, roster legend and status, and read-only historical holidays (desktop and mobile).');
} finally {
  await browser.close();
}
