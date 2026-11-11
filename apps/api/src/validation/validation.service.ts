import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Actor, Assignment, Check, SwapPair } from '../shared/types';
type DisplayCheck = Check & {label:string;workDate?:string;employeeName?:string};

export const pendingPolicies:DisplayCheck[]=[
 {rule:'SWAP_QUOTA',label:'โควตาสลับกะ',status:'UNCONFIRMED',message:'รอยืนยันกติกาการนับโควตา'},
 {rule:'REQUEST_WINDOW',label:'ช่วงเวลายื่นคำขอ',status:'UNCONFIRMED',message:'รอยืนยันช่วงเวลายื่นคำขอ'},
 {rule:'COVERAGE',label:'กำลังคนขั้นต่ำ',status:'UNCONFIRMED',message:'รอยืนยันจำนวนคนขั้นต่ำและข้อยกเว้น'},
 {rule:'SKILLS',label:'ทักษะเฉพาะงาน',status:'UNCONFIRMED',message:'รอยืนยันเกณฑ์ทักษะและคุณสมบัติ'},
 {rule:'REST_AFTER_NIGHT',label:'พักหลังกะดึก',status:'UNCONFIRMED',message:'รอยืนยันระยะพักขั้นต่ำหลังจบกะดึก'},
 {rule:'ROTATION_PATTERN',label:'รอบทำงาน 2 วัน หยุด 2 วัน',status:'UNCONFIRMED',message:'รอยืนยันว่าต้องใช้รอบนี้เป็นข้อบังคับหลังสลับกะหรือไม่'}
];
export function longestWorkingRun(rows:{work_date:string;is_working:boolean}[]):number {
 let longest=0,run=0,last='';
 for(const row of [...rows].sort((a,b)=>a.work_date.localeCompare(b.work_date))) {
  const adjacent=!last||new Date(`${row.work_date}T00:00:00Z`).getTime()-new Date(`${last}T00:00:00Z`).getTime()===86400000;
  run=row.is_working?(adjacent?run+1:1):0; longest=Math.max(longest,run); last=row.work_date;
 }
 return longest;
}
function interval(date:string,start:string,end:string):[number,number] {
 const a=Date.parse(`${date}T${start}+07:00`), b=Date.parse(`${date}T${end}+07:00`);
 return [a,b<=a?b+86400000:b];
}
export function crossDateCoverChecks(first:SwapPair,second:SwapPair):DisplayCheck[] {
 const [requesterWorks,partnerOff]=first;
 const [requesterOff,partnerWorks]=second;
 return [
  {rule:'CROSS_DATE_FIRST_COVER',label:'วันที่คู่สลับมาทำแทน',workDate:requesterWorks.work_date,
   status:requesterWorks.is_working&&partnerOff.shift_code==='O'&&!partnerOff.is_working?'PASS':'FAIL',
   message:'วันที่คู่สลับมาทำแทน ผู้ยื่นต้องมีกะและคู่สลับต้องหยุด'},
  {rule:'CROSS_DATE_SECOND_COVER',label:'วันที่ผู้ยื่นไปทำแทน',workDate:requesterOff.work_date,
   status:partnerWorks.is_working&&requesterOff.shift_code==='O'&&!requesterOff.is_working?'PASS':'FAIL',
   message:'วันที่ผู้ยื่นไปทำแทน คู่สลับต้องมีกะและผู้ยื่นต้องหยุด'},
 ];
}
@Injectable()
export class ValidationService {
 check(c:PoolClient,actor:Actor,a:Assignment,b:Assignment,submission=true) {
  return this.checkPairs(c,actor,[[a,b]],submission);
 }
 async checkPairs(c:PoolClient,actor:Actor,pairs:[SwapPair,...SwapPair[]],submission=true) {
  const checks:DisplayCheck[]=[];
  const add=(rule:string,label:string,ok:boolean,message:string,context?:Pick<DisplayCheck,'workDate'|'employeeName'>)=>
   checks.push({rule,label,status:ok?'PASS':'FAIL',message,...context});
  const [source,target]=pairs[0];
  const dates=pairs.flatMap(pair=>pair.map(item=>item.work_date)).sort();
  if(pairs[1]) {
   add('DISTINCT_DATES','วันที่สลับ',new Set(pairs.map(([a])=>a.work_date)).size===pairs.length,'ต้องเลือกวันที่สลับต่างกัน');
   add('SAME_MONTH','เดือนของวันที่สลับ',dates[0].slice(0,7)===dates.at(-1)!.slice(0,7),'ทุกวันที่สลับต้องอยู่ในเดือนเดียวกัน');
   add('SAME_PARTICIPANTS','ผู้เกี่ยวข้อง',pairs.every(([a,b])=>a.employee_id===source.employee_id&&b.employee_id===target.employee_id),'ต้องใช้คู่สลับคนเดิมทั้งสองวัน');
   checks.push(...crossDateCoverChecks(pairs[0],pairs[1]));
  }
  for(const [a,b] of pairs) {
   const context={workDate:a.work_date};
   add('OWN_ASSIGNMENT','เจ้าของกะ',!submission||a.employee_id===actor.employeeId,'กะต้นทางต้องเป็นของผู้ยื่นคำขอ',context);
   add('DISTINCT_TEAMS','สังกัดทีม',a.employee_id!==b.employee_id&&a.team_id!==b.team_id,'ผู้ยื่นและคู่สลับต้องอยู่คนละทีม',context);
   add('SAME_DATE','วันที่ของกะทั้งคู่',a.work_date===b.work_date,'กะทั้งสองช่องในแต่ละรอบต้องเป็นวันเดียวกัน',context);
   add('EFFECTIVE_ASSIGNMENT','สถานะกะเดิม',a.status==='ACTIVE'&&b.status==='ACTIVE','ทั้งสองช่องต้องเป็นกะที่มีผลอยู่',context);
   add('POSITION','ประเภทพนักงาน',!!a.position&&a.position===b.position,'ผู้ยื่นและคู่สลับต้องเป็นพนักงานประเภทเดียวกัน',context);
   add('DIFFERENT_SHIFT','รหัสกะเดิม',a.shift_type_id!==b.shift_type_id,`เลือกกะต่างกันเพื่อให้ตารางเปลี่ยน (${a.shift_code} / ${b.shift_code})`,context);
  }
  const result=()=>({valid:checks.every(x=>x.status==='PASS'),checks:[...checks,...pendingPolicies],dataSource:'SYNTHETIC',companyPoliciesConfirmed:false});
  if(checks.some(check=>check.status==='FAIL')) return result();
  for(const side of [0,1] as const) {
   const own=pairs[0][side];
   const replacements=new Map(pairs.map(pair=>[pair[side].assignment_id,pair[side===0?1:0]]));
   const rows=(await c.query(`SELECT a.work_date,a.assignment_id,st.is_working,st.start_time,st.end_time FROM shift_assignments a JOIN shift_types st USING(shift_type_id)
    WHERE a.employee_id=$1 AND a.status='ACTIVE' AND a.work_date BETWEEN $2::date-7 AND $3::date+7 ORDER BY a.work_date`,[own.employee_id,dates[0],dates.at(-1)])).rows;
   const projected=rows.map(row=>{
    const incoming=replacements.get(row.assignment_id);
    return incoming?{...row,is_working:incoming.is_working,start_time:incoming.start_time,end_time:incoming.end_time}:row;
   });
   const consecutiveDays=longestWorkingRun(projected);
   const context={employeeName:own.name};
   add(`MAX_SIX_DAYS_${own.employee_id}`,'วันทำงานต่อเนื่อง',consecutiveDays<=6,
    `หลังสลับ ${own.name} ทำงานต่อเนื่องสูงสุด ${consecutiveDays} วันในช่วงที่ตรวจ เกณฑ์ไม่เกิน 6 วัน`,context);
   const spans=projected.filter(r=>r.is_working&&r.start_time&&r.end_time).map(r=>interval(r.work_date,r.start_time,r.end_time)).sort((x,y)=>x[0]-y[0]);
   add(`NO_OVERLAP_${own.employee_id}`,'ช่วงเวลาทำงาน',spans.every((s,i)=>i===0||s[0]>=spans[i-1][1]),
    `ช่วงเวลาทำงานของ ${own.name} ต้องไม่ทับซ้อนกัน รวมกะข้ามคืน`,context);
  }
  return result();
 }
}
