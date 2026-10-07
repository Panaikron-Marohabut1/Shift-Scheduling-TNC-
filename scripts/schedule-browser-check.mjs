import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const origin=process.env.APP_TEST_ORIGIN??'http://localhost:3000';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
try {
 for(const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  // Bangkok date is 6 October while the browser's timezone is UTC.
  await page.clock.setFixedTime(new Date('2026-10-06T16:10:00Z'));
  await page.goto(origin);await page.getByRole('button',{name:/พนักงานทดสอบ A1/}).click();
  await page.locator('.day-heading .day-today').waitFor();
  assert.equal(await page.locator('.day-heading [aria-current="date"]').count(),1);
  assert.equal(await page.locator('.day-heading .day-today').getAttribute('data-work-date'),'2026-10-06');
  assert.equal(await page.locator('tbody td.day-today').count(),12);
  assert.equal(await page.locator('.day-heading .today-label').innerText(),'วันนี้');
  assert.equal(await page.locator('.day-heading .day-today').getAttribute('aria-label'),'6 ต.ค. 2569 วันนี้');
  if(mobile)await page.locator('.grid-scroll').evaluate(el=>{el.scrollLeft=el.querySelector('th.day-today').offsetLeft-el.querySelector('th.name-column').offsetWidth-35;});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Schedule controls fit viewport');
  await page.screenshot({path:resolve('.local/ui-check',`${mobile?'mobile':'desktop'}-today-schedule.png`),fullPage:true,animations:'disabled'});
  await page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('B');
  assert.equal(await page.locator('tbody td.day-today').count(),3,'Today remains highlighted after team filtering');
  await page.getByRole('button',{name:'เดือนถัดไป',exact:true}).click();
  await page.locator('.month-picker[data-month="2026-11"]').waitFor();
  assert.equal(await page.locator('.day-today').count(),0,'Another month must not mark the same day number as today');
  assert.equal(await page.getByRole('button',{name:'เดือนถัดไป',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'เดือนก่อนหน้า',exact:true}).click();
  await page.locator('.day-heading .day-today').waitFor();
  assert.equal(await page.getByLabel('กรองทีมในตาราง',{exact:true}).inputValue(),'B');
  // After Thai midnight, UTC is still 6 October. The highlight must move to 7.
  await page.clock.setFixedTime(new Date('2026-10-06T17:10:00Z'));await page.reload();
  await page.locator('.day-heading [data-work-date="2026-10-07"][aria-current="date"]').waitFor();
  assert.equal(await page.locator('td.day-today[data-work-date="2026-10-07"]').count(),12);
  // Weekend styling must not override the today marker or shift-code colours.
  await page.clock.setFixedTime(new Date('2026-10-10T05:00:00Z'));await page.reload();
  await page.locator('.day-heading th.weekend.day-today').waitFor();
  assert.equal(await page.locator('.day-heading th.day-today').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(4, 120, 87)');
  assert.equal(await page.locator('.own-row td.day-today').count(),1);
  await context.close();
 }
 for(const pattern of [/หัวหน้าทดสอบ A0/,/ผู้จัดการทดสอบ/,/ผู้ตรวจทดสอบ HR/]) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-06T16:10:00Z'));
  await page.goto(origin);await page.getByRole('button',{name:pattern}).click();
  if(pattern.source.includes('ผู้จัดการ'))await page.getByRole('button',{name:'ดูตารางกะทุกทีม',exact:true}).click();
  else if(pattern.source.includes('หัวหน้า'))await page.getByRole('button',{name:'ตารางกะ',exact:true}).click();
  await page.locator('.day-heading .day-today').waitFor();assert.equal(await page.locator('tbody td.day-today').count(),12);
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('SCHEDULE BROWSER PASS: month navigation, today across roles, filters, other months, Thai midnight and weekends on desktop/mobile.');
}finally{await browser.close();}
