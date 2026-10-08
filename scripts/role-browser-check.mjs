import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const origin=process.env.APP_TEST_ORIGIN??'http://localhost:3000',preflight=!!process.env.ROLE_PREFLIGHT;
const output=resolve('.local/ui-check');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
const accounts=[
  ['manager',/ผู้จัดการทดสอบ/,'ติดตามสถานะคำขอ',5],
  ['supervisor-a',/หัวหน้าทดสอบ A0/,'คำขอที่ต้องตรวจสอบ',4],
  ['supervisor-b',/หัวหน้าทดสอบ B0/,'คำขอที่ต้องตรวจสอบ',4],
  ['supervisor-c',/หัวหน้าทดสอบ C0/,'คำขอที่ต้องตรวจสอบ',4],
  ['supervisor-d',/หัวหน้าทดสอบ D0/,'คำขอที่ต้องตรวจสอบ',4],
  ['employee-a',/พนักงานทดสอบ A1/,'กะของฉัน',3],
  ['employee-b',/พนักงานทดสอบ B1/,'กะของฉัน',3],
  ['hr',/ผู้ตรวจทดสอบ HR/,'ตารางกะ',3],
  ['external',/ผู้ใช้ภายนอกทดสอบ/,'ตารางรับส่งพนักงานวันนี้',0]
];
async function nav(page,label) {
  const menu=page.getByRole('button',{name:'เปิดเมนู',exact:true});if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name:label,exact:true}).click();
}
async function capture(page,name,mobile) {
  assert.equal(await page.evaluate(width=>document.documentElement.scrollWidth<=width,page.viewportSize().width),true,`${name}: document overflow`);
  if(!preflight)await page.screenshot({path:resolve(output,`${mobile?'mobile':'desktop'}-${name}.png`),fullPage:true,animations:'disabled'});
}
try {
 for(const mobile of [false,true])for(const [profile,pattern,initial,navCount] of accounts) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  const calls=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push({path:new URL(r.url()).pathname,method:r.method()});});page.on('download',d=>downloads.push(d.suggestedFilename()));
  await page.goto(origin);await page.getByRole('button',{name:pattern}).waitFor();
  assert.equal(await page.locator('.account').count(),9,'Exactly nine selectable accounts');
  if(profile==='manager')await capture(page,'account-selection',mobile);
  await page.getByRole('button',{name:pattern}).click();await page.getByRole('heading',{name:initial,exact:true}).waitFor();
  assert.equal(await page.locator('.nav-link').count(),navCount,`${profile}: legacy menu count`);
  await capture(page,profile,mobile);
  await page.reload();await page.getByRole('heading',{name:initial,exact:true}).waitFor();
  if(profile==='manager') {
   assert.equal(await page.getByRole('button',{name:'ตรวจและอนุมัติ',exact:true}).count(),0);
   await nav(page,'พนักงานและทีม');await page.getByRole('heading',{name:'รายชื่อพนักงาน'}).waitFor();
   assert.equal(await page.locator('.data-table tbody tr').count(),12);assert.equal(await page.getByRole('columnheader',{name:'เบอร์ติดต่อ'}).count(),0);
   await capture(page,'manager-people',mobile);
   await page.getByLabel('ทีมพนักงาน',{exact:true}).selectOption('B');assert.equal(await page.locator('.data-table tbody tr').count(),3);
   await page.getByLabel('ค้นหาพนักงาน',{exact:true}).fill('B1');assert.equal(await page.locator('.data-table tbody tr').count(),1);
   await page.getByLabel('ค้นหาพนักงาน',{exact:true}).fill('ไม่มีชื่อนี้');await page.getByText('ไม่พบสมาชิกกะที่ตรงกับการค้นหา').waitFor();
   await nav(page,'ตารางรายปี (Annual Schedule)');await page.locator('.annual-month-card').nth(11).waitFor();
   assert.equal(await page.locator('.annual-month-card').count(),12);assert.equal(await page.locator('.annual-no-data').count(),9);assert.equal(await page.locator('.annual-month-card .pill').count(),3);
   await capture(page,'manager-annual',mobile);
   await page.getByRole('button',{name:'ปีถัดไป',exact:true}).click();await page.locator('.annual-no-data').nth(11).waitFor();
   await page.getByRole('button',{name:'ปีก่อนหน้า',exact:true}).click();await page.locator('.annual-month-card .pill').nth(2).waitFor();
   await nav(page,'ตั้งค่าระบบ (Settings)');await page.getByRole('heading',{name:'ช่วงเวลากะ'}).waitFor();
   assert.equal(await page.locator('.settings-time-grid input:disabled').count(),3);
   await capture(page,'manager-settings',mobile);
  }else if(profile.startsWith('supervisor')) {
   await nav(page,'ภาพรวมกำลังพล');await page.locator('.team-overview-row').nth(3).waitFor();await capture(page,`${profile}-overview`,mobile);
  }else if(profile==='hr') {
   await nav(page,'ข้อมูลและส่งออก CSV');await page.getByRole('heading',{name:'ส่งออกไฟล์ข้อมูล (Export Center)'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'ส่งออก CSV',exact:true}).count(),3);
   for(const b of await page.getByRole('button',{name:'ส่งออก CSV',exact:true}).all())assert.equal(await b.isDisabled(),true);
   await capture(page,'hr-export',mobile);await nav(page,'ตรวจสอบ OT และประวัติ');await page.getByRole('heading',{name:'ตรวจสอบชั่วโมง OT'}).waitFor();await capture(page,'hr-audit',mobile);
  }else if(profile==='external') {
   await page.getByText('ยังไม่มีข้อมูลรับส่ง',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'รับทราบและยืนยันตารางงาน'}).isDisabled(),true);
   assert.deepEqual(calls.filter(c=>!['/api/me','/api/demo/accounts','/api/demo/session'].includes(c.path)),[],'External must not fetch internal data');
  }
  if(!preflight&&profile!=='external') {
   if(profile==='manager') {await nav(page,'ติดตามสถานะคำขอ');await page.getByRole('button',{name:'ดูตารางกะทุกทีม',exact:true}).click();}
   else if(profile.startsWith('supervisor'))await nav(page,'ตารางกะ');
   else if(profile==='hr')await nav(page,'ตารางกะรวม (Schedule)');
   await page.locator('.team-row').nth(3).waitFor();
   assert.deepEqual(await page.locator('.team-row').evaluateAll(rows=>rows.map(r=>r.dataset.team)),['A','B','C','D']);
   assert.deepEqual(await page.locator('.week-heading th[scope="colgroup"]').allTextContents(),['สัปดาห์ 1 (1–7)','สัปดาห์ 2 (8–14)','สัปดาห์ 3 (15–21)','สัปดาห์ 4 (22–28)','สัปดาห์ 5 (29–31)']);
   const cells=page.locator('.schedule-table button.grid-shift[data-own-assignment="true"]');
   assert.equal(await cells.count(),profile.startsWith('employee')?31:0,'Only own employee assignments are actionable');
   await page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('C');assert.equal(await page.locator('.team-row').count(),1);assert.equal(await cells.count(),0,'C/D read only');
   await page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('D');assert.equal(await cells.count(),0);
   await page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('B');assert.equal(await page.locator('.schedule-table tbody .name-column').count(),3);
   await page.getByRole('button',{name:'เลือกเดือน',exact:true}).click();await page.getByRole('button',{name:'พฤศจิกายน 2569',exact:true}).click();
   await page.locator('.day-heading th').nth(29).waitFor();
   assert.equal(await page.getByLabel('กรองทีมในตาราง',{exact:true}).inputValue(),'B','Month changes retain team filter');
   assert.equal(await page.locator('.day-heading th').count(),30);
   await page.getByLabel('กรองทีมในตาราง',{exact:true}).selectOption('ALL');
   const grid=page.locator('.grid-scroll');
   await grid.evaluate(el=>{el.scrollLeft=250;});
   const sticky=await page.locator('.schedule-table tbody .name-column').first().boundingBox(),bounds=await grid.boundingBox();
   assert.ok(Math.abs(sticky.x-bounds.x)<3,'Name column stays fixed while scrolling');await grid.evaluate(el=>{el.scrollLeft=0;});
   await capture(page,`${profile}-teams`,mobile);
   await page.getByRole('button',{name:'เปลี่ยนบัญชี',exact:true}).click();await page.getByRole('group',{name:'บัญชีทดสอบ',exact:true}).getByRole('button',{name:pattern}).click();await page.getByRole('heading',{name:initial,exact:true}).waitFor();
   if(profile==='manager')await page.getByRole('button',{name:'ดูตารางกะทุกทีม',exact:true}).click();
   else if(profile.startsWith('supervisor'))await nav(page,'ตารางกะ');
   await page.getByLabel('กรองทีมในตาราง',{exact:true}).waitFor();assert.equal(await page.getByLabel('กรองทีมในตาราง',{exact:true}).inputValue(),'ALL','Account change resets team filter');
  }
  assert.deepEqual(downloads,[],'Prepared features must not download files');
  assert.deepEqual(calls.filter(c=>c.method==='POST'&&!['/api/demo/session','/api/auth/logout'].includes(c.path)),[],'Prepared screens must not mutate data');
  await context.close();
 }
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('ROLE BROWSER PASS: nine accounts, four supervisors, role menus, refresh sessions, prepared screens, filters/search, annual actual data, disabled controls and External data isolation on desktop/mobile.');
}finally{await browser.close();}
