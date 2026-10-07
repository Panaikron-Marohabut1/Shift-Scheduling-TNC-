import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const origin=process.env.APP_TEST_ORIGIN??'http://localhost:3021';
if(origin!=='http://localhost:3021')throw new Error('Run through pnpm test:browser with its temporary fixture database.');
const output=resolve('.local/ui-check');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[],writes=[];
async function login(name,mobile=false) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>{if(r.method()==='POST'&&/\/api\/requests/.test(r.url()))writes.push(r.url());});
 await page.goto(origin);await page.getByRole('button',{name}).click();await page.getByRole('button',{name:'โหลดล่าสุด',exact:true}).waitFor();
 // The shell appears before the initial API reads finish; inspect the rendered view.
 await page.locator('.page-content > .view-stack').waitFor();
 return {page,context};
}
async function get(context,path) {const response=await context.request.get(`${origin}/api${path}`);assert.equal(response.status(),200);return response.json();}
async function nav(page,label) {const menu=page.getByRole('button',{name:'เปิดเมนู',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('button',{name:label,exact:true}).click();}
async function capture(page,name) {assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(output,name),animations:'disabled'});}
async function fits(popup,page) {const rect=await popup.boundingBox(),view=page.viewportSize();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=view.width&&rect.y+rect.height<=view.height,'Popover stays in the viewport');}
async function tapMarker(marker,page) {await marker.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await marker.tap();}
try {
 const desktop=await login(/หัวหน้าทดสอบ C0/);
 await nav(desktop.page,'ตารางกะ');
 const data=await get(desktop.context,'/schedules?month=2026-10');
 const source=data.assignments.find(row=>row.employee_code==='DEMO-A1'&&row.work_date==='2026-10-08');
 const partner=data.assignments.find(row=>row.employee_code==='DEMO-B1'&&row.work_date==='2026-10-08');
 const marker=desktop.page.locator(`.schedule-table .grid-shift[data-assignment-id="${source.assignment_id}"]`);
 const popup=desktop.page.getByRole('dialog',{name:'รายละเอียดการสลับกะ',exact:true});
 assert.equal(await desktop.page.locator('.schedule-table .has-swap').count(),data.assignments.filter(row=>row.swap).length);
 assert.equal(await marker.getAttribute('data-swap-request'),String(source.swap.requestId));
 assert.equal(await marker.innerText(),source.shift_code,'The shift code stays readable');
 await marker.hover();await popup.waitFor();
 await popup.getByText(partner.name,{exact:true}).waitFor();
 assert.equal(await popup.locator('.shift-swap-date,.shift-swap-status,.shift-swap-time,.shift-swap-action').count(),0,'Only partner and shift summary is shown');
 assert.equal(await popup.locator('.shift-swap-change .shift').first().innerText().then(text=>text.includes('N')),true);
 assert.equal(await popup.getByRole('button',{name:'ขอสลับกะวันนี้'}).count(),0,'Unrelated supervisor cannot act for an employee');
 await fits(popup,desktop.page);await capture(desktop.page,'desktop-swap-marker.png');
 await popup.hover();await desktop.page.waitForTimeout(300);await popup.waitFor();
 await desktop.page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
 await marker.focus();await popup.waitFor();await desktop.page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
 assert.equal(await marker.evaluate(el=>el===document.activeElement),true,'Escape keeps keyboard focus on the cell');
 await marker.click();await popup.waitFor();await popup.getByRole('button',{name:'ปิดรายละเอียดการสลับกะ'}).click();await popup.waitFor({state:'hidden'});
 await marker.click();await popup.waitFor();await desktop.page.locator('.topbar-title').click();await popup.waitFor({state:'hidden'});
 await marker.click();await popup.waitFor();await desktop.page.locator('.grid-scroll').evaluate(el=>{el.scrollLeft+=120;});await popup.waitFor({state:'hidden'});
 await desktop.page.locator('.grid-scroll').evaluate(el=>{el.scrollLeft=0;});
 await desktop.page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('B');
 const reverse=desktop.page.locator(`.schedule-table .grid-shift[data-assignment-id="${partner.assignment_id}"]`);
 await reverse.hover();await popup.waitFor();await popup.getByText(source.name,{exact:true}).waitFor();
 await desktop.page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
 await desktop.page.getByRole('button',{name:'เลือกเดือน',exact:true}).click();await desktop.page.getByRole('button',{name:'พฤศจิกายน 2569',exact:true}).click();
 await desktop.page.locator('.day-heading th').nth(29).waitFor();assert.equal(await desktop.page.locator(`[data-assignment-id="${source.assignment_id}"]`).count(),0,'Month change does not carry old cell markers');

 const hr=await login(/ผู้ตรวจทดสอบ HR/,true);
 const hrMarker=hr.page.locator(`.schedule-table .grid-shift[data-assignment-id="${source.assignment_id}"]`);
 const hrPopup=hr.page.getByRole('dialog',{name:'รายละเอียดการสลับกะ',exact:true});
 await tapMarker(hrMarker,hr.page);await hrPopup.waitFor();await hrPopup.getByText(partner.name,{exact:true}).waitFor();
 assert.equal(await hrPopup.getByRole('button',{name:'ขอสลับกะวันนี้'}).count(),0);await fits(hrPopup,hr.page);await capture(hr.page,'mobile-swap-marker.png');
 await hrPopup.getByRole('button',{name:'ปิดรายละเอียดการสลับกะ'}).tap();await hrPopup.waitFor({state:'hidden'});
 const unsafeName='<img src=x onerror=alert(1)> ชื่อทดสอบที่ยาวมากสำหรับตรวจการตัดบรรทัด '.repeat(4);
 await hr.page.route('**/api/schedules?month=2026-10',async route=>{
  const response=await route.fetch(),body=await response.json();
  body.assignments.find(row=>row.assignment_id===source.assignment_id).swap.partner.name=unsafeName;
  await route.fulfill({response,json:body});
 });
 await hr.page.reload();await tapMarker(hrMarker,hr.page);await hrPopup.waitFor();
 assert.equal(await hrPopup.locator('.shift-swap-partner').textContent(),unsafeName);
 assert.equal(await hrPopup.locator('img').count(),0,'Partner names stay text instead of HTML');await fits(hrPopup,hr.page);
 await capture(hr.page,'mobile-swap-marker-long-name.png');

 const employee=await login(/พนักงานทดสอบ B1/,true);
 const own=employee.page.locator(`.schedule-table .grid-shift[data-assignment-id="${partner.assignment_id}"]`);
 const ownDetails=employee.page.locator(`.schedule-table [data-swap-detail="${partner.assignment_id}"]`);
 const ownPopup=employee.page.getByRole('dialog',{name:'รายละเอียดการสลับกะ',exact:true});
 assert.ok(await employee.page.locator('.seven-day-strip .has-swap').count()>0,'The seven-day view also marks applied swaps');
 assert.equal(await employee.page.locator('button button').count(),0,'Information and request controls are siblings, never nested buttons');
 await tapMarker(ownDetails,employee.page);await ownPopup.waitFor();await ownPopup.getByText(source.name,{exact:true}).waitFor();
 assert.equal(await ownPopup.getByRole('button').count(),1,'The summary only has a close button');
 await ownPopup.getByRole('button',{name:'ปิดรายละเอียดการสลับกะ',exact:true}).tap();
 await tapMarker(own,employee.page);
 await employee.page.getByRole('heading',{name:'ขอสลับกะข้ามทีม',exact:true}).waitFor();
 assert.equal(await employee.page.getByLabel('วันที่ต้องการสลับ').inputValue(),String(partner.assignment_id),'Own swap action uses the same canonical assignment');
 assert.equal(await employee.page.locator('.swap-source .shift b').innerText(),partner.shift_code,'The form uses the current received shift');
 await employee.page.getByRole('button',{name:'กลับไปตาราง',exact:true}).tap();
 const dayDetails=employee.page.locator(`.seven-day-strip [data-swap-detail="${partner.assignment_id}"]`);
 const day=dayDetails.locator('..').locator('.day-card');
 await tapMarker(dayDetails,employee.page);await ownPopup.waitFor();await ownPopup.getByText(source.name,{exact:true}).waitFor();
 await capture(employee.page,'mobile-own-swap-calendar.png');
 await ownPopup.getByRole('button',{name:'ปิดรายละเอียดการสลับกะ',exact:true}).tap();
 await tapMarker(day,employee.page);await employee.page.getByRole('heading',{name:'ขอสลับกะข้ามทีม',exact:true}).waitFor();
 assert.equal(await employee.page.getByLabel('วันที่ต้องการสลับ').inputValue(),String(partner.assignment_id),'The seven-day calendar reopens the same swapped date');

 const employeeDesktop=await login(/พนักงานทดสอบ A1/);
 const desktopOwn=employeeDesktop.page.locator(`.schedule-table .grid-shift[data-assignment-id="${source.assignment_id}"]`);
 await desktopOwn.focus();await employeeDesktop.page.keyboard.press('Enter');
 await employeeDesktop.page.getByRole('heading',{name:'ขอสลับกะข้ามทีม',exact:true}).waitFor();
 assert.equal(await employeeDesktop.page.getByLabel('วันที่ต้องการสลับ').inputValue(),String(source.assignment_id),'Keyboard activation requests the already-swapped date');
 await employeeDesktop.page.getByRole('button',{name:'กลับไปตาราง',exact:true}).click();
 await employeeDesktop.page.evaluate(()=>window.scrollTo(0,0));
 await desktopOwn.scrollIntoViewIfNeeded();await employeeDesktop.page.waitForTimeout(250);
 await desktopOwn.click();await employeeDesktop.page.getByRole('heading',{name:'ขอสลับกะข้ามทีม',exact:true}).waitFor();
 assert.equal(await employeeDesktop.page.locator('.swap-source .shift b').innerText(),source.shift_code);
 assert.deepEqual(writes,[],'Viewing provenance never submits a swap request');assert.deepEqual(errors,[]);
 console.log('SWAP MARKER BROWSER PASS: compact summary, read-only scopes, separate info controls, direct own-date requests in both calendars, current shifts, keyboard/touch, safe long names and no writes.');
}catch(error) {console.error(error);throw error;}
finally {
 for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'ignoreErrors'});
 await browser.close();
}
