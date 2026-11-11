import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const origin = process.env.APP_TEST_ORIGIN;
assert.equal(new URL(origin).hostname, 'localhost');
const session = process.env.TNC_HR_BROWSER_SESSION;
assert.match(session, /^sb-session=[0-9a-f-]{36}$/);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addCookies([{ name: 'sb-session', value: session.slice('sb-session='.length), url: origin }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2098-11-30T17:00:00Z'));
  await page.goto(origin);
  await page.locator(`[data-click='SF.nav("hr-export")']`).first().click();
  const table = page.locator('#hr-closed-roster-table');
  await table.waitFor();
  assert.equal(await page.locator('#hr-closed-roster-month').inputValue(), '2098-11');
  const screenRows = await table.locator('tbody tr').evaluateAll(rows =>
    rows.map(row => Array.from(row.cells, cell => cell.textContent)));
  assert.equal(screenRows.length, 9);
  assert.ok(screenRows.every(row => row.length === 4));
  const downloadWait = page.waitForEvent('download');
  await page.locator('#hr-closed-roster-download').click();
  const download = await downloadWait;
  assert.equal(download.suggestedFilename(), 'TNC-Closed-Roster-2098-11.csv');
  const csv = await readFile(await download.path(), 'utf8');
  assert.equal(csv[0], '\uFEFF');
  assert.deepEqual(csv.slice(1).trimEnd().split('\r\n').slice(1),
    screenRows.map(row => row.map(value => `"${value}"`).join(',')));
  await page.locator('#hr-closed-roster-month').fill('2098-12');
  await page.getByRole('alert').getByText('ตารางเดือนนี้ยังไม่ปิด').waitFor();
  assert.equal(await page.locator('#hr-closed-roster-download').count(), 0);
  assert.deepEqual(errors, []);
  console.log('HR browser check passed: published closed roster, matching CSV, and current month denied.');
} finally {
  await browser.close();
}
