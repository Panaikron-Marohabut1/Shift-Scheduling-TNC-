import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const origin=process.env.APP_TEST_ORIGIN??'http://localhost:3021';
if(origin!=='http://localhost:3021')throw new Error('Run through pnpm test:browser with its temporary database.');
const output=resolve('.local/ui-check');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
async function login(pattern,mobile) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole('button',{name:pattern}).click();
 await page.getByRole('button',{name:'โหลดล่าสุด',exact:true}).waitFor();
 return {context,page};
}
async function nav(page,label) {
 const menu=page.getByRole('button',{name:'เปิดเมนู',exact:true});if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name:label,exact:true}).click();
}
async function get(context,path) {const response=await context.request.get(`${origin}/api${path}`);assert.equal(response.status(),200);return response.json();}
async function capture(page,name) {
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Document fits the viewport');
 await page.screenshot({path:resolve(output,name),fullPage:true,animations:'disabled'});
}
try {
 for(const [source,target,date,first,mobile] of [['A','D','2026-11-20','A',false],['B','C','2026-11-24','B',true]]) {
  const employee=await login(new RegExp(`พนักงานทดสอบ ${source}1`),mobile);
  const requester=await login(new RegExp(`หัวหน้าทดสอบ ${first}0`),mobile);
  const partner=await login(new RegExp(`หัวหน้าทดสอบ ${target}0`),mobile);
  const me=(await get(employee.context,'/me')).actor;
  const before=await get(employee.context,'/schedules?month=2026-11');
  const a=before.assignments.find(row=>row.employee_id===me.employeeId&&row.work_date===date);
  const b=before.assignments.find(row=>row.employee_code===`DEMO-${target}1`&&row.work_date===date);
  const candidates=await get(employee.context,`/swap/candidates?assignmentId=${a.assignment_id}`);
  assert.deepEqual([...new Set(candidates.candidates.map(row=>row.team_code))],['A','B','C','D'].filter(code=>code!==source));
  await employee.page.getByRole('button',{name:'เลือกเดือน',exact:true}).click();
  await employee.page.getByRole('button',{name:'พฤศจิกายน 2569',exact:true}).click();
  await employee.page.getByRole('button',{name:new RegExp(`^${Number(date.slice(8))} พ.ย. 2569 .* เลือกสลับกะ$`)}).click();
  await employee.page.getByRole('button',{name:'เลือกคู่สลับ',exact:true}).click();
  await employee.page.getByRole('option',{name:new RegExp(`พนักงานทดสอบ ${target}1`)}).click();
  await employee.page.getByText(`หัวหน้าทีม ${target}`,{exact:true}).waitFor();
  await capture(employee.page,`${mobile?'mobile':'desktop'}-swap-${source.toLowerCase()}-${target.toLowerCase()}.png`);
  await employee.page.getByRole('button',{name:'ส่งคำขอให้หัวหน้าทีม'}).click();
  await employee.page.getByText(`รอ หัวหน้าทดสอบ ${first}0 · ตารางยังไม่เปลี่ยน`,{exact:true}).waitFor();
  const record=(await get(employee.context,'/requests')).find(r=>r.snapshot.source.work_date===date);
  assert.ok(record);assert.equal(record.demoSupported,true);
  await employee.page.reload();await nav(employee.page,'คำขอของฉัน');
  await employee.page.getByText(`รอ หัวหน้าทดสอบ ${first}0 · ตารางยังไม่เปลี่ยน`,{exact:true}).waitFor();
  const partnerRecord=(await get(partner.context,'/requests')).find(r=>r.request_id===record.request_id);
  assert.equal(partnerRecord.canDecide,false,'Partner supervisor cannot approve out of order');
  for(const approver of [requester,partner]) {
   await approver.page.reload();
   const card=approver.page.locator('.request-card').filter({has:approver.page.getByRole('heading',{name:new RegExp(`สลับกะ · ${Number(date.slice(8))} พ.ย.`)})});
   await card.getByRole('button',{name:'ตรวจและอนุมัติ',exact:true}).click();
   await card.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).click();
   await card.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).waitFor({state:'hidden'});
   if(approver===requester) {
    const still=await get(employee.context,'/schedules?month=2026-11');
    for(const old of [a,b])assert.deepEqual(still.assignments.find(row=>row.assignment_id===old.assignment_id),old,'First approval leaves both shifts unchanged');
   }
  }
  await employee.page.reload();await nav(employee.page,'คำขอของฉัน');
  const card=employee.page.locator('.employee-request').filter({has:employee.page.getByRole('heading',{name:new RegExp(`สลับกะ · ${Number(date.slice(8))} พ.ย.`)})});
  await card.getByText('อนุมัติครบสองฝ่ายแล้ว ตารางกะทั้งสองคนอัปเดตเรียบร้อย',{exact:true}).waitFor();
  await capture(partner.page,`${mobile?'mobile':'desktop'}-supervisor-${target.toLowerCase()}-approved.png`);
  const after=await get(employee.context,'/schedules?month=2026-11'),other=await get(partner.context,'/schedules?month=2026-11');
  assert.equal(after.schedule.version,other.schedule.version);
  for(const [own,incoming] of [[a,b],[b,a]]) {
   const current=after.assignments.find(row=>row.assignment_id===own.assignment_id);
   assert.equal(current.shift_code,incoming.shift_code);assert.equal(current.version,own.version+1);
   assert.deepEqual(other.assignments.find(row=>row.assignment_id===own.assignment_id),current);
  }
  const evidence=(await get(employee.context,'/audit?view=activity')).filter(row=>row.entity_id===record.request_id);
  assert.equal(evidence.filter(row=>row.action==='REQUEST_APPROVED').length,2);
  assert.equal(evidence.filter(row=>row.action==='SCHEDULE_SWAP_APPLIED').length,1);
  await employee.context.close();await requester.context.close();await partner.context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('FOUR-TEAM BROWSER PASS: desktop A → D, mobile B → C, assigned approval order, refresh, atomic schedules and audit.');
}finally {await browser.close();}
