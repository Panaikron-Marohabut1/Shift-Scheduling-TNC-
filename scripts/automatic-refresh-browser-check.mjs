import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://shiftflow.test';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });

try {
  const page = await browser.newPage();
  const errors = [];
  let releaseRefresh;
  const pendingRefresh = new Promise(resolve => { releaseRefresh = resolve; });
  let holdRefresh = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-18T06:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-18T06:00:01Z'));
  await page.addInitScript(() => {
    window.testTabHidden = false;
    window.testRequestReads = 0;
    Object.defineProperty(document, 'hidden', { get: () => window.testTabHidden });
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (input === '/api/requests') window.testRequestReads++;
      return fetch(input, options);
    };
  });
  await page.route(`${origin}/**`, async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/me') return route.fulfill({ json: {
      actor: { role: 'EMPLOYEE', employeeId: 1, teamCode: 'A', name: 'ShiftFlow test' },
      capabilities: { remotePilot: true },
    } });
    if (pathname === '/api/schedules') return route.fulfill({ json: { schedule: null, assignments: [] } });
    if (pathname === '/api/requests' && holdRefresh) await pendingRefresh;
    if (pathname.startsWith('/api/')) return route.fulfill({ json: [] });
    return route.fulfill({ path: resolve('apps/web', pathname === '/' ? 'index.html' : `.${pathname}`) });
  });
  const reads = () => page.evaluate(() => window.testRequestReads);
  const setHidden = hidden => page.evaluate(hidden => {
    window.testTabHidden = hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  try {
    await page.goto(origin);
    await page.locator('#sideMenu').waitFor();
    assert.equal(await reads(), 1, 'sign-in loads the requests once');

    await setHidden(true);
    await page.clock.runFor(59_999);
    assert.equal(await reads(), 1, 'hidden tabs skip scheduled refresh');

    holdRefresh = true;
    await setHidden(false);
    assert.equal(await reads(), 2, 'returning to a stale tab starts one refresh');
    await page.clock.runFor(1);
    assert.equal(await reads(), 2, 'an adjacent timer tick shares the refresh');

    // Jump wall time independently of the request deadline, then fire the visibility event again.
    await page.clock.setSystemTime(new Date('2026-11-18T06:02:01Z'));
    await setHidden(true);
    await setHidden(false);
    assert.equal(await reads(), 2, 'an unfinished refresh continues to block another automatic refresh');

    const finished = page.waitForResponse(response => response.url() === `${origin}/api/requests`);
    holdRefresh = false;
    releaseRefresh();
    await finished;
    await page.evaluate(async () => {
      const { afterApi } = await import('/src/app/session.js');
      await afterApi();
    });
    assert.equal(await reads(), 3, 'explicit refresh after a change still runs without waiting for the timer');
    await setHidden(true);
    await setHidden(false);
    assert.equal(await reads(), 4, 'a settled automatic refresh releases the next stale-tab refresh');
    assert.deepEqual(errors, []);
    console.log('Passed: hidden-tab refresh, one refresh on return, in-flight protection, and explicit refresh.');
  } finally {
    releaseRefresh();
    await page.close();
  }
} finally {
  await browser.close();
}
