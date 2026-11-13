import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const origin = process.env.APP_TEST_ORIGIN;
const sessions = JSON.parse(process.env.TNC_SWAP_BROWSER_SESSIONS || '{}');
assert.equal(new URL(origin).hostname, 'localhost');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const errors = [];

async function pageFor(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    localStorage.setItem('shiftflow.web.demo.v1', JSON.stringify({ peopleEdits: { byId: {
      'DEMO-A1': { name: 'REGULAR-DEMO-ONLY' },
    }, added: [] } }));
    localStorage.setItem('shiftflow.web.demo.v1.swap-pilot', JSON.stringify({ publishedMonths: ['2095-01'] }));
  });
  assert.match(sessions[role], /^sb-session=[0-9a-f-]{36}$/);
  await context.addCookies([{ name: 'sb-session', value: sessions[role].slice('sb-session='.length), url: origin }]);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2096-08-01T12:00:00Z'));
  await page.goto(origin);
  return page;
}

const responseFor = (page, pathname) => page.waitForResponse(response =>
  new URL(response.url()).pathname === pathname && response.request().method() === 'POST');

try {
  const worker = await pageFor('worker');
  for (const width of [390, 1440]) {
    await worker.setViewportSize({width, height: 1000});
    for (const [day, labels] of [[19, ['ขอสลับกะ', 'ขอลา', 'ขอทำงานล่วงเวลา (OT)']], [29, ['ขอสลับกะ', 'ขอทำงานล่วงเวลา (OT)', 'ขอย้ายวันหยุดนักขัตฤกษ์']]]) {
      await worker.locator(`[data-click='SF.cell("DEMO-A1", ${day})']`).first().click();
      const options = worker.getByRole('region', {name: 'คำขอสำหรับวันที่เลือก'});
      const originalDay = await worker.locator('#modalRoot .cellinfo span').textContent();
      await options.locator('button').first().click();
      await worker.locator('#modalRoot').getByRole('button', {name: 'ย้อนกลับ', exact: true}).click();
      assert.equal(await options.count(), 1, 'Back from a dated form restores the original calendar-day dialog');
      assert.equal(await worker.locator('#modalRoot .cellinfo span').textContent(), originalDay);
      assert.doesNotMatch(await options.textContent(), /\d+ ประเภท/);
      assert.deepEqual(await options.locator('button b').allTextContents(), labels);
      assert.equal(await options.getByText('ฟอร์มเดโม่', {exact: true}).count(), 2);
      assert.ok(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await worker.locator('#modalRoot').getByText('ปิด', {exact: true}).click();
    }
  }
  // 17:00 UTC is midnight of the next calendar date in Bangkok.
  await worker.clock.setFixedTime(new Date('2096-08-19T17:00:00Z'));
  await worker.locator(`[data-click='SF.cell("DEMO-A1", 19)']`).first().click();
  assert.equal(await worker.locator('#modalRoot .cellinfo').count(), 1);
  assert.equal(await worker.locator('#modalRoot .request-options, #modalRoot [data-click^="SF.swapWith("]').count(), 0);
  assert.doesNotMatch(await worker.locator('#modalRoot').textContent(), /วันที่ผ่านมาแล้ว/);
  await worker.locator('#modalRoot').getByText('ปิด', {exact: true}).click();
  await worker.locator(`[data-click='SF.cell("DEMO-A1", 20)']`).first().click();
  assert.equal(await worker.getByRole('region', {name: 'คำขอสำหรับวันที่เลือก'}).getByRole('button', {name: /^ขอสลับกะ/}).count(), 1);
  await worker.locator('#modalRoot').getByText('ปิด', {exact: true}).click();
  await worker.clock.setFixedTime(new Date('2096-08-01T12:00:00Z'));
  await worker.locator('[data-click="SF.newRequest()"]').first().click();
  const generalOptions = worker.getByRole('region', {name: 'เลือกคำขอ'});
  assert.equal(await generalOptions.locator('button').count(), 4);
  assert.doesNotMatch(await generalOptions.textContent(), /\d+ ประเภท/);
  await generalOptions.getByRole('button', { name: /^ขอสลับกะ/ }).click();
  await worker.locator('#modalRoot').getByRole('button', {name: 'ย้อนกลับ', exact: true}).click();
  assert.equal(await generalOptions.locator('button').count(), 4, 'Back from the general menu restores that menu');
  await generalOptions.getByRole('button', { name: /^ขอสลับกะ/ }).click();
  await worker.locator('#centralSwapMode').selectOption('two');
  assert.equal(await worker.locator('#centralSwapDay option[value="12"]').count(), 0);
  await worker.locator('#centralSwapDay').selectOption('19');
  const partners = worker.locator('#centralSwapPartner');
  const groups = await partners.locator('optgroup').evaluateAll(items => items.map(item => item.label));
  assert.ok(groups.includes('Shift B') && !groups.includes('Shift A'));
  assert.deepEqual(groups, [...new Set(groups)].sort());
  const partnerName = await partners.locator('optgroup[label="Shift B"] option[value="DEMO-B1"]').textContent();
  assert.doesNotMatch(partnerName, /ทีม B|Shift B/);
  await partners.selectOption('DEMO-B1');
  assert.equal(await worker.locator('#centralSwapSecond option[value="2096-08-20"]').count(), 0);
  await worker.locator('#centralSwapSecond').selectOption('2096-08-29');
  await worker.locator('#centralSwapChecks li.pass').first().waitFor();
  const rules = worker.getByRole('region', { name: 'ตรวจเงื่อนไขคำขอ' });
  const requesterRules = rules.getByRole('region', { name: /^ผู้ขอ/ });
  const partnerRules = rules.getByRole('region', { name: /^ผู้ถูกขอ/ });
  const sharedRules = rules.getByRole('region', { name: 'เงื่อนไขร่วม' });
  const pendingRules = rules.getByRole('region', { name: 'กฎที่รอยืนยัน' });
  const quota = requesterRules.locator('#centralSwapQuota');
  assert.match(await quota.textContent({ timeout: 3000 }), /ใช้แล้ว 1 จาก \d+ ครั้ง/);
  assert.match(await quota.textContent(), /เหลือ \d+ ครั้ง/);
  assert.equal(await partnerRules.locator('#centralSwapQuota').count(), 0);
  assert.equal(await rules.getByText('เจ้าของกะ', { exact: true }).count(), 0);
  assert.equal(await rules.getByText('วันที่ในตาราง', { exact: true }).count(), 0);
  for (const participantRules of [requesterRules, partnerRules]) {
    assert.equal(await participantRules.getByText('วันทำงานต่อเนื่อง', { exact: true }).count(), 1);
    assert.equal(await participantRules.getByText('ช่วงเวลาทำงาน', { exact: true }).count(), 1);
    assert.match(await participantRules.textContent(), /วันที่ 7 ติดต่อกัน/);
    assert.match(await participantRules.textContent(), /เวลาเลิกกะดึกในวันถัดไป/);
    assert.equal(await participantRules.getByText('สังกัดทีม', { exact: true }).count(), 0);
  }
  assert.equal(await sharedRules.getByText('สังกัดทีม', { exact: true }).count(), 1);
  assert.match(await sharedRules.textContent(), /ผู้ขออยู่ Shift A คู่สลับอยู่ Shift B/);
  assert.match(await sharedRules.textContent(), /แม้กะของวันนี้เริ่มแล้ว/);
  assert.match(await sharedRules.textContent(), /ยื่นย้อนหลังหรือข้ามเดือนไม่ได้/);
  assert.match(await rules.getByText(/^วันที่สลับกะ /).textContent(), /19 ส\.ค\..*29 ส\.ค\./);
  assert.equal(await rules.locator('.checks-t').count(), 0);
  const coverDate = sharedRules.locator('li').filter({ hasText: 'วันที่คู่สลับมาทำแทน' });
  assert.match(await coverDate.textContent(), /19 ส\.ค\./);
  assert.doesNotMatch(await coverDate.textContent(), /29 ส\.ค\./);
  assert.equal(await pendingRules.locator('li.pending').count(), 4);
  const preview = worker.locator('#modalRoot table tbody tr');
  const names = await preview.locator('td:first-child').allTextContents();
  assert.equal(await requesterRules.getByRole('heading').textContent(), `ผู้ขอ · ${names[0]}`);
  assert.equal(await partnerRules.getByRole('heading').textContent(), `ผู้ถูกขอ (คู่สลับ) · ${names[1]}`);
  for (const width of [390, 1440]) {
    await worker.setViewportSize({ width, height: 1000 });
    assert.ok(await rules.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  }
  assert.doesNotMatch(await worker.locator('#modalRoot').textContent(), /REGULAR-DEMO-ONLY/);
  assert.equal(await preview.count(), 4);
  const previewChanges = await preview.evaluateAll(rows => rows.map(row =>
    [row.cells[2], row.cells[3]].map(cell => cell.querySelector('.sw').textContent.trim())));
  assert.deepEqual(previewChanges, [['M','O'],['O','M'],['O','N'],['N','O']]);
  assert.equal(await worker.locator('#payDaySelect').count(), 0);
  const sent = responseFor(worker, '/api/requests');
  await worker.locator('#modalRoot').getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  const response = await sent;
  assert.equal(response.status(), 201, await response.text());
  const { requestId } = await response.json();

  const firstApprover = await pageFor('b');
  const secondApprover = await pageFor('a');
  for (const [page, expectedStatus] of [[firstApprover, 'PENDING'], [secondApprover, 'APPROVED']]) {
    await page.locator(`[data-click='SF.nav("requests")']`).first().click();
    const detail = page.locator(`[data-click='openRequestDetails("${requestId}")']`).first();
    if (page === firstApprover) {
      assert.equal(await detail.locator('xpath=ancestor::tr').locator('.steps-inline .now').count(), 2);
    }
    await detail.click();
    assert.match(await page.locator('#modalRoot').textContent(), /รอตรวจสอบ/);
    await page.locator('#modalRoot').getByText('ปิด', { exact: true }).click();
    const decided = responseFor(page, `/api/requests/${requestId}/decisions`);
    await page.locator(`[data-click='approveRequest("${requestId}")']`).first().click();
    const result = await decided;
    assert.equal(result.status(), 201, await result.text());
    assert.equal((await result.json()).status, expectedStatus);
  }
  const roster = await secondApprover.request.get(`${origin}/api/schedules?month=2096-08`);
  const changed = (await roster.json()).assignments.filter(item => item.swap?.requestId === requestId);
  assert.deepEqual(changed.map(item => [item.employee_code, item.work_date, item.shift_code]), [
    ['DEMO-A1','2096-08-19','O'], ['DEMO-A1','2096-08-29','N'],
    ['DEMO-B1','2096-08-19','M'], ['DEMO-B1','2096-08-29','O'],
  ]);
  assert.equal(await secondApprover.locator(`[data-click='promptCancelApproved("${requestId}")']`).count(), 0);
  await worker.reload();
  await worker.locator(`[data-click='SF.nav("my-requests")']`).first().click();
  const workerRequest = worker.locator(`[data-click='openRequestDetails("${requestId}")']`).first();
  await workerRequest.click();
  await worker.locator('#modalRoot').getByRole('button', { name: 'ยกเลิกและคืนตาราง' }).click();
  assert.match(await worker.locator('#modalRoot').textContent(), /คืนโควตา 1 สิทธิ์/);
  await worker.setViewportSize({ width: 390, height: 1000 });
  assert.ok(await worker.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  const cancelPath = `/api/requests/${requestId}/cancel`;
  const confirmCancellation = worker.locator('#modalRoot').getByRole('button', { name: 'ยืนยันยกเลิกและคืนตาราง' });
  let attemptKey;
  await worker.route(`**${cancelPath}`, async route => {
    attemptKey = route.request().headers()['idempotency-key'];
    await route.abort();
  }, { times: 1 });
  await confirmCancellation.click();
  const cancelError = worker.locator('#modalRoot').getByRole('alert');
  await cancelError.waitFor();
  assert.match(await cancelError.textContent(), /เชื่อมต่อไม่สำเร็จ/);
  const cancellation = responseFor(worker, cancelPath);
  await confirmCancellation.click();
  const cancelled = await cancellation;
  assert.equal(cancelled.status(), 201, await cancelled.text());
  assert.match(attemptKey, /^[0-9a-f-]{36}$/);
  assert.equal(cancelled.request().headers()['idempotency-key'], attemptKey);
  assert.equal((await cancelled.json()).status, 'CANCELLED');
  const restoredRoster = await worker.request.get(`${origin}/api/schedules?month=2096-08`);
  const restored = (await restoredRoster.json()).assignments.filter(item => changed.some(cell => cell.assignment_id === item.assignment_id));
  assert.deepEqual(restored.map(item => [item.employee_code, item.work_date, item.shift_code]), [
    ['DEMO-A1','2096-08-19','M'], ['DEMO-A1','2096-08-29','O'],
    ['DEMO-B1','2096-08-19','O'], ['DEMO-B1','2096-08-29','N'],
  ]);
  assert.ok(restored.every(item => !item.swap));
  await worker.setViewportSize({ width: 1440, height: 1000 });
  await workerRequest.locator('xpath=ancestor::tr').getByText('ยกเลิกแล้ว', { exact: true }).waitFor();
  await workerRequest.click();
  assert.match(await worker.locator('#modalRoot').textContent(), /คืนตารางและโควตาแล้ว/);
  assert.equal(await worker.locator('#modalRoot').getByRole('button', { name: 'ยกเลิกและคืนตาราง' }).count(), 0);
  await worker.locator('#modalRoot').getByRole('button', { name: 'ปิด', exact: true }).last().click();

  const supervisor = await pageFor('a');
  await supervisor.locator(`[data-click='SF.nav("my-shift")']`).first().click();
  await supervisor.locator('[data-click="SF.newRequest()"]').first().click();
  await supervisor.locator('#modalRoot').getByRole('button', { name: /^ขอสลับกะ/ }).click();
  assert.equal(await supervisor.locator('#centralSwapMode').inputValue(), 'one');
  await supervisor.locator('#centralSwapMode').selectOption('two');
  const emptyState = supervisor.locator('#modalRoot').getByText('เดือนนี้ไม่มีคู่สลับกะคนละวัน', { exact: true });
  await emptyState.waitFor({ timeout: 4000 });
  assert.equal(await supervisor.locator('#centralSwapDay, #centralSwapPartner, #centralSwapSecond').count(), 0);
  assert.equal(await supervisor.locator('#modalRoot').getByRole('button', { name: 'ส่งคำขอ' }).isDisabled(), true);
  await supervisor.locator('#modalRoot').getByRole('button', { name: 'ดูตัวเลือกสลับกะวันเดียวกัน' }).click();
  assert.equal(await supervisor.locator('#centralSwapMode').inputValue(), 'one');
  await supervisor.locator('#centralSwapDay').selectOption('26');
  await supervisor.locator('#centralSwapPartner').selectOption('DEMO-B0');
  assert.equal(await supervisor.locator('#modalRoot table tbody tr').count(), 2);
  const supervisorRules = supervisor.getByRole('region', { name: 'ตรวจเงื่อนไขคำขอ' });
  await supervisorRules.getByRole('region', { name: /^ผู้ถูกขอ/ }).getByText('ช่วงเวลาทำงาน', { exact: true }).waitFor();
  assert.equal(await supervisorRules.getByText('เจ้าของกะ', { exact: true }).count(), 0);
  assert.equal(await supervisorRules.getByText('วันที่ในตาราง', { exact: true }).count(), 0);
  assert.match(await supervisorRules.getByText(/^วันที่สลับกะ /).textContent(), /26 ส\.ค\./);
  assert.doesNotMatch(await supervisorRules.locator('li').allTextContents().then(rows => rows.join(' ')), /26 ส\.ค\./);
  assert.match(await supervisor.locator('#modalRoot ol.steps').textContent(), /ผู้จัดการ/);
  const sentBySupervisor = responseFor(supervisor, '/api/requests');
  await supervisor.locator('#modalRoot').getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  const supervisorResponse = await sentBySupervisor;
  assert.equal(supervisorResponse.status(), 201, await supervisorResponse.text());
  const supervisorRequestId = (await supervisorResponse.json()).requestId;
  const manager = await pageFor('manager');
  await manager.locator(`[data-click='SF.nav("manager-monitoring")']`).first().click();
  const managerDecision = responseFor(manager, `/api/requests/${supervisorRequestId}/decisions`);
  await manager.locator(`[data-click='approveRequest("${supervisorRequestId}")']`).first().click();
  const managerResponse = await managerDecision;
  assert.equal(managerResponse.status(), 201, await managerResponse.text());
  assert.equal((await managerResponse.json()).status, 'APPROVED');

  const newRequester = await pageFor('worker');
  await newRequester.locator('[data-click="SF.newRequest()"]').first().click();
  await newRequester.locator('#modalRoot').getByRole('button', { name: /^ขอสลับกะ/ }).click();
  await newRequester.locator('#centralSwapDay').selectOption('17');
  await newRequester.locator('#centralSwapPartner').selectOption('DEMO-B1');
  const sentForRejection = responseFor(newRequester, '/api/requests');
  await newRequester.locator('#modalRoot').getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  const sentResponse = await sentForRejection;
  assert.equal(sentResponse.status(), 201, await sentResponse.text());
  const rejectedId = (await sentResponse.json()).requestId;
  const rejectingSupervisor = await pageFor('b');
  await rejectingSupervisor.locator(`[data-click='SF.nav("requests")']`).first().click();
  await rejectingSupervisor.locator(`[data-click='promptRejectRequest("${rejectedId}")']`).first().click();
  const reason = 'กำลังคนไม่พอสำหรับการทดสอบ';
  await rejectingSupervisor.locator('#rejectReasonInput').fill(reason);
  const rejection = responseFor(rejectingSupervisor, `/api/requests/${rejectedId}/decisions`);
  await rejectingSupervisor.locator('#modalRoot').getByRole('button', { name: 'ยืนยันปฏิเสธคำขอ' }).click();
  assert.equal((await (await rejection).json()).status, 'REJECTED');
  const requester = await pageFor('worker');
  await requester.locator(`[data-click='SF.nav("my-requests")']`).first().click();
  await requester.locator(`[data-click='openRequestDetails("${rejectedId}")']`).first().click();
  assert.match(await requester.locator('#modalRoot').textContent(), new RegExp(reason));
  assert.match(await requester.locator('#modalRoot dd').filter({ hasText: /ไม่อนุมัติ.*\d{2}:\d{2}/ }).textContent(), /ไม่อนุมัติ/);

  await manager.locator(`[data-click='SF.nav("manager-settings")']`).first().click();
  const input = manager.locator('#set-central-swap');
  await input.waitFor();
  const quotaUrl = `${origin}/api/settings/swap-quota`;
  const beforeQuota = await (await manager.request.get(quotaUrl)).json();
  const nextLimit = beforeQuota.nextLimit + 1;
  await input.fill(String(nextLimit));
  const savingQuota = manager.waitForResponse(response => response.url() === quotaUrl && response.request().method() === 'PUT');
  await manager.getByRole('button', { name: 'บันทึกสำหรับเดือนถัดไป' }).click();
  const savedQuota = await savingQuota;
  assert.equal(savedQuota.status(), 200, await savedQuota.text());
  const settings = await savedQuota.json();
  assert.equal(settings.currentLimit, beforeQuota.currentLimit);
  assert.equal(settings.nextMonth, beforeQuota.nextMonth);
  assert.equal(settings.nextLimit, nextLimit);
  assert.deepEqual(errors, []);
  console.log('Central swap browser check passed: both approval routes, approved cancellation, rejection details and Manager next-month quota.');
} finally {
  await browser.close();
}
