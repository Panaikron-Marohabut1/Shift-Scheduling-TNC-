import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const origin=process.env.APP_TEST_ORIGIN;
if(origin!=='http://localhost:3021')throw new Error('Run through pnpm test:browser with its temporary database.');
const output=resolve('.local/ui-check');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
async function login(name,mobile) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole('button',{name:new RegExp(name)}).click();
 await page.getByRole('button',{name:'โหลดล่าสุด',exact:true}).waitFor();return {context,page};
}
async function nav(page,name) {
 const menu=page.getByRole('button',{name:'เปิดเมนู',exact:true});if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name,exact:true}).click();
}
async function get(context,path) {
 const response=await context.request.get(`${origin}/api${path}`);assert.equal(response.status(),200);return response.json();
}
const employeeCard=(page,id)=>page.locator('.employee-request').filter({has:page.locator('.employee-request-meta',{hasText:new RegExp(`คำขอ #${id}$`)})});
const supervisorCard=(page,id)=>page.locator('.request-card').filter({hasText:new RegExp(`คำขอ #${id} ·`)});
async function submit(employee,day,partner) {
 await nav(employee.page,'กะของฉัน');await employee.page.getByRole('button',{name:'เลือกเดือน',exact:true}).click();
 await employee.page.getByRole('button',{name:'กันยายน 2569',exact:true}).click();
 await employee.page.getByRole('button',{name:new RegExp(`^${day} ก.ย. 2569 .* เลือกสลับกะ$`)}).click();
 await employee.page.getByRole('button',{name:'เลือกคู่สลับ',exact:true}).click();
 await employee.page.getByRole('option',{name:new RegExp(`พนักงานทดสอบ ${partner}1`)}).click();
 await employee.page.getByRole('button',{name:'ส่งคำขอให้หัวหน้าทีม',exact:true}).click();
 await employee.page.getByRole('heading',{name:'คำขอของฉัน',exact:true}).waitFor();
 const date=`2026-09-${String(day).padStart(2,'0')}`;
 const record=(await get(employee.context,'/requests')).find(r=>r.status==='PENDING'&&r.snapshot.source.work_date===date);
 assert.ok(record?.canCancel);await employeeCard(employee.page,record.request_id).getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).waitFor();return record;
}
async function capture(page,name) {
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Cancellation UI fits viewport');
 await page.screenshot({path:resolve(output,name),fullPage:true,animations:'disabled'});
}
try {
 for(const [source,partner,day,mobile] of [['A','B',1,false],['B','C',5,true]]) {
  const employee=await login(`พนักงานทดสอบ ${source}1`,mobile),supervisor=await login(`หัวหน้าทดสอบ ${source}0`,mobile);
  const before=await get(employee.context,'/schedules?month=2026-09');
  const record=await submit(employee,day,partner),card=employeeCard(employee.page,record.request_id),writes=[];
  await supervisor.page.reload();const review=supervisorCard(supervisor.page,record.request_id);
  await review.getByRole('button',{name:'ตรวจและอนุมัติ',exact:true}).click();
  assert.equal((await get(employee.context,'/requests')).find(r=>r.request_id===record.request_id).canCancel,true,'Opening a review leaves cancellation available');
  await card.getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).click();
  await card.getByRole('button',{name:'กลับ',exact:true}).click();
  assert.equal(await employee.page.locator(':focus').innerText(),'ยกเลิกคำขอ');
  assert.equal((await get(employee.context,'/requests')).find(r=>r.request_id===record.request_id).status,'PENDING','Backing out never cancels the request');
  await card.getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).click();
  await capture(employee.page,`${mobile?'mobile':'desktop'}-cancel-confirm.png`);
  let release;const held=new Promise(resolveDone=>{release=resolveDone;});
  await employee.page.route(`**/api/requests/${record.request_id}/cancel`,async route=>{
   writes.push(route.request().headers()['idempotency-key']);
   if(mobile&&writes.length===1){await route.abort('failed');return;}
   const response=await route.fetch();await held;await route.fulfill({response});
  });
  if(mobile) {
   await card.getByRole('button',{name:'ยืนยันยกเลิกคำขอ',exact:true}).click();
   await card.getByRole('alert').getByText(/เชื่อมต่อไม่สำเร็จ/).waitFor();
   assert.equal((await get(employee.context,'/requests')).find(r=>r.request_id===record.request_id).status,'PENDING','Network failure does not fabricate success');
  }
  await card.getByRole('button',{name:'ยืนยันยกเลิกคำขอ',exact:true}).click();
  await card.getByRole('button',{name:'กำลังยกเลิก…',exact:true}).waitFor();
  assert.equal(await card.getByRole('button',{name:'กำลังยกเลิก…',exact:true}).isDisabled(),true);
  assert.equal(await card.getByRole('button',{name:'กลับ',exact:true}).isDisabled(),true);
  assert.equal(await card.locator('.pill.pending').innerText(),'รออนุมัติ','UI waits for the server response before showing success');
  release();await card.getByText('ยกเลิกคำขอแล้ว ตารางกะเดิมยังคงอยู่',{exact:true}).waitFor();
  assert.equal(new Set(writes).size,1,'Retries reuse the same idempotency key');assert.equal(writes.length,mobile?2:1);
  assert.deepEqual(await get(employee.context,'/schedules?month=2026-09'),before);
  await employee.page.reload();await nav(employee.page,'คำขอของฉัน');
  await card.getByText('ยกเลิกแล้ว',{exact:true}).waitFor();assert.equal(await card.getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).count(),0);
  assert.equal(await card.getByText(/ไม่ได้ดำเนินการ/).count(),2);
  await capture(employee.page,`${mobile?'mobile':'desktop'}-cancelled-request.png`);
  await review.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).click();
  await review.getByRole('alert').getByText(/คำขอนี้สิ้นสุดแล้ว/).waitFor();
  await review.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
  await review.getByText('ยกเลิกแล้ว',{exact:true}).waitFor();assert.equal(await review.getByRole('button',{name:'ตรวจและอนุมัติ',exact:true}).count(),0);
  const notifications=await get(supervisor.context,'/notifications');assert.ok(notifications.some(n=>n.request_id===record.request_id&&n.title==='คำขอถูกยกเลิก'));
  await nav(employee.page,'ประวัติของฉัน');
  await employee.page.getByRole('heading',{name:'ประวัติการทำรายการของฉัน',exact:true}).waitFor();
  assert.equal(await employee.page.locator('.personal-history-row').filter({hasText:`คำขอ #${record.request_id}`}).count(),1);
  const evidence=(await get(employee.context,'/audit?view=personal')).filter(e=>e.entity_id===record.request_id&&e.entity_type==='REQUEST');
  assert.deepEqual(evidence.map(e=>e.action).sort(),['REQUEST_CANCELLED','REQUEST_SUBMITTED']);
  if(!mobile) {
   // Corrected request: first approval wins while the employee still has an old cancel form open.
   const fresh=await submit(employee,day,partner),freshCard=employeeCard(employee.page,fresh.request_id);
   await freshCard.getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).click();
   await supervisor.page.reload();const freshReview=supervisorCard(supervisor.page,fresh.request_id);
   await freshReview.getByRole('button',{name:'ตรวจและอนุมัติ',exact:true}).click();
   await freshReview.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).click();
   await freshReview.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).waitFor({state:'hidden'});
   await freshCard.getByRole('button',{name:'ยืนยันยกเลิกคำขอ',exact:true}).click();
   await freshCard.getByRole('alert').getByText(/คำขอมีการเปลี่ยนแปลง/).waitFor();
   await freshCard.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
   await freshCard.getByText(`รอ หัวหน้าทดสอบ ${partner}0 · ตารางยังไม่เปลี่ยน`,{exact:true}).waitFor();
   assert.equal(await freshCard.getByRole('button',{name:'ยกเลิกคำขอ',exact:true}).count(),0);
   assert.equal((await get(employee.context,'/audit?view=personal')).some(e=>e.entity_id===fresh.request_id&&e.action==='REQUEST_CANCELLED'),false);
  }
  await employee.context.close();await supervisor.context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('CANCELLATION BROWSER PASS: desktop/mobile, review still cancellable, back, saving, network retry, refresh/history, re-submit, stale supervisor/employee conflicts and no schedule changes.');
}finally{await browser.close();}
