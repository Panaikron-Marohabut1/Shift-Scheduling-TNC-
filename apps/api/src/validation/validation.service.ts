import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Actor, Assignment, Check, SwapPair } from '../shared/types';
type DisplayCheck = Check & {
 label:string;
 workDate?:string;
 employeeName?:string;
 participant?:'requester'|'partner';
};

const MAX_CONSECUTIVE_DAYS = 6;
const DAY_MS = 86_400_000;
const MIN_SHIFT_REST_MS = 12 * 60 * 60 * 1000;
const bangkokShiftTime = new Intl.DateTimeFormat('th-TH', {
 timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'
});
const calendarDate = new Intl.DateTimeFormat('th-TH', {
 timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'
});
const shiftRestRule = 'ต้องพักอย่างน้อย 12 ชั่วโมงระหว่างกะ (เว้นหนึ่งกะเต็ม)';
const midnight = (date:string) => Date.parse(`${date}T00:00:00Z`);

export const pendingPolicies:DisplayCheck[]=[
 {rule:'SWAP_QUOTA',label:'โควตาสลับกะ',status:'UNCONFIRMED',message:'รอยืนยันกติกาการนับโควตา'},
 {rule:'REQUEST_WINDOW',label:'ช่วงเวลายื่นคำขอ',status:'UNCONFIRMED',message:'รอยืนยันช่วงเวลายื่นคำขอ'},
 {rule:'COVERAGE',label:'กำลังคนขั้นต่ำ',status:'UNCONFIRMED',message:'แต่ละกะต้องเหลือคนอย่างน้อยกี่คนหลังสลับ'},
 {rule:'SKILLS',label:'ทักษะเฉพาะงาน',status:'UNCONFIRMED',message:'คนที่มารับกะต้องมีทักษะหรือคุณสมบัติอะไรบ้าง'},
 {rule:'ROTATION_PATTERN',label:'รอบทำงาน 2 วัน หยุด 2 วัน',status:'UNCONFIRMED',message:'หลังสลับต้องรักษารอบนี้ทุกครั้งหรือไม่'}
];
type WorkDay={work_date:string;is_working:boolean};
type WorkingRun={days:number;start:number;end:number};
type RosterShift=Pick<Assignment,'is_working'|'start_time'|'end_time'>;

function longestRun(rows:WorkDay[]):WorkingRun {
 let longest:WorkingRun={days:0,start:0,end:0};
 let days=0,start=0,last=NaN;
 for(const row of [...rows].sort((a,b)=>a.work_date.localeCompare(b.work_date))) {
  const current=midnight(row.work_date);
  if(!row.is_working) {
   days=0;
  } else {
   if(!days||current-last!==DAY_MS) { days=0; start=current; }
   days++;
   if(days>longest.days) longest={days,start,end:current};
  }
  last=current;
 }
 return longest;
}

export function longestWorkingRun(rows:WorkDay[]):number {
 return longestRun(rows).days;
}

function runText(run:WorkingRun) {
 const count=`${run.days}/${MAX_CONSECUTIVE_DAYS} วัน`;
 return run.days ? `${count} (${calendarDate.formatRange(run.start,run.end)})` : count;
}

function interval(date:string,start:string,end:string):[number,number] {
 const a=Date.parse(`${date}T${start}+07:00`), b=Date.parse(`${date}T${end}+07:00`);
 return [a,b<=a?b+DAY_MS:b];
}
export function crossDateCoverChecks(first:SwapPair,second:SwapPair):DisplayCheck[] {
 const [requesterWorks,partnerOff]=first;
 const [requesterOff,partnerWorks]=second;
 return [
  {rule:'CROSS_DATE_FIRST_COVER',label:'วันที่คู่สลับมาทำแทน',workDate:requesterWorks.work_date,
   status:requesterWorks.is_working&&partnerOff.shift_code==='O'&&!partnerOff.is_working?'PASS':'FAIL',
   message:'ผู้ขอมีกะที่ต้องส่งต่อ และคู่สลับต้องเป็นวันหยุด'},
  {rule:'CROSS_DATE_SECOND_COVER',label:'วันที่ผู้ยื่นไปทำแทน',workDate:requesterOff.work_date,
   status:partnerWorks.is_working&&requesterOff.shift_code==='O'&&!requesterOff.is_working?'PASS':'FAIL',
   message:'คู่สลับมีกะที่ต้องส่งต่อ และผู้ขอต้องเป็นวันหยุด'},
 ];
}
@Injectable()
export class ValidationService {
 check(c:PoolClient,actor:Actor,a:Assignment,b:Assignment,submission=true) {
  return this.checkPairs(c,actor,[[a,b]],submission);
 }
 async checkPairs(c:PoolClient,actor:Actor,pairs:[SwapPair,...SwapPair[]],submission=true) {
  const checks:DisplayCheck[]=[];
  const add=(rule:string,label:string,ok:boolean,message:string,context?:Pick<DisplayCheck,'workDate'|'employeeName'|'participant'>)=>
   checks.push({rule,label,status:ok?'PASS':'FAIL',message,...context});
  const [source,target]=pairs[0];
  const dates=pairs.flatMap(pair=>pair.map(item=>item.work_date)).sort();
  if(pairs[1]) {
   add('DISTINCT_DATES','วันทำแทน',new Set(pairs.map(([a])=>a.work_date)).size===pairs.length,'การสลับแบบคนละวันต้องเลือกวันทำแทนสองวันที่ต่างกัน');
   add('SAME_MONTH','เดือนของวันที่สลับ',dates[0].slice(0,7)===dates.at(-1)!.slice(0,7),'วันทำแทนทั้งสองวันต้องอยู่เดือนและปีเดียวกัน');
   add('SAME_PARTICIPANTS','คู่สลับทั้งสองวัน',pairs.every(([a,b])=>a.employee_id===source.employee_id&&b.employee_id===target.employee_id),'ทั้งสองวันต้องเป็นการทำแทนกันระหว่างคนคู่เดิม');
   checks.push(...crossDateCoverChecks(pairs[0],pairs[1]));
  }
  for(const [a,b] of pairs) {
   const context={workDate:a.work_date};
   const differentTeams=a.employee_id!==b.employee_id&&a.team_id!==b.team_id;
   const matchingDate=a.work_date===b.work_date;
   const active=a.status==='ACTIVE'&&b.status==='ACTIVE';
   const noLeave=a.shift_code!=='L'&&b.shift_code!=='L';
   const samePosition=!!a.position&&a.position===b.position;
   const differentShifts=a.shift_type_id!==b.shift_type_id;
   add('OWN_ASSIGNMENT','เจ้าของกะ',!submission||a.employee_id===actor.employeeId,
    'ระบบตรวจว่ารายการกะฝั่งผู้ขอเป็นของคนที่ส่งคำขอ',{...context,participant:'requester'});
   add('DISTINCT_TEAMS','สังกัดทีม',differentTeams,differentTeams
    ? `ผู้ขออยู่ Shift ${a.team_code} คู่สลับอยู่ Shift ${b.team_code}` : 'เลือกคู่สลับจากทีมอื่น',context);
   add('SAME_DATE','วันที่ในตาราง',matchingDate,matchingDate
    ? 'รายการกะของทั้งคู่ตรงกับวันที่ที่ใช้จับคู่ในตาราง' : 'รายการกะของทั้งคู่อ้างถึงคนละวันที่ในตาราง',context);
   add('EFFECTIVE_ASSIGNMENT','สถานะกะเดิม',active&&noLeave,!noLeave
    ? 'กะที่บันทึกเป็นวันลาไม่สามารถนำมาสลับได้'
    : active ? 'รายการกะของทั้งสองคนยังมีผลในตาราง' : 'มีรายการกะที่ไม่มีผลในตารางแล้ว กรุณาเลือกใหม่',context);
   add('POSITION','ประเภทพนักงาน',samePosition,samePosition
    ? 'ผู้ขอและคู่สลับเป็นพนักงานประเภทเดียวกัน' : 'พนักงานกะสลับกับพนักงานกะ หัวหน้ากะสลับกับหัวหน้ากะ',context);
   add('DIFFERENT_SHIFT','กะเดิมต่างกัน',differentShifts,differentShifts
    ? `ก่อนสลับ ผู้ขอเป็น${a.shift_name} คู่สลับเป็น${b.shift_name}` : 'ทั้งสองคนมีกะเดิมเหมือนกัน สลับแล้วตารางจะไม่เปลี่ยน',context);
  }
  const result=()=>({valid:checks.every(x=>x.status==='PASS'),checks:[...checks,...pendingPolicies],dataSource:'SYNTHETIC',companyPoliciesConfirmed:false});
  if(checks.some(check=>check.status==='FAIL')) return result();
  for(const side of [0,1] as const) {
   const own=pairs[0][side];
   const replacements=new Map(pairs.map(pair=>[pair[side].assignment_id,pair[side===0?1:0]]));
   const context={employeeName:own.name,participant:side===0?'requester' as const:'partner' as const};
   checks.push(...(await this.rosterChecks(c,own.employee_id,dates[0],dates.at(-1)!,replacements,'สลับ')).map(check=>({...check,...context})));
  }
  return result();
 }
 async checkOT(c:PoolClient,slot:Assignment) {
  const checks=await this.rosterChecks(c,slot.employee_id,slot.work_date,slot.work_date,new Map([[slot.assignment_id,slot]]),'ทำ OT');
  return {valid:checks.every(check=>check.status==='PASS'),checks};
 }

 private async rosterChecks(c:PoolClient,employeeId:number,firstDate:string,lastDate:string,
  replacements:ReadonlyMap<number,RosterShift>,action:'สลับ'|'ทำ OT'):Promise<DisplayCheck[]> {
  const {before,after,restIssue}=await this.projectedRoster(c,employeeId,firstDate,lastDate,replacements);
  const allowed=after.days<=MAX_CONSECUTIVE_DAYS;
  const note=after.days===MAX_CONSECUTIVE_DAYS
   ? ` · ${calendarDate.format(after.end+DAY_MS)} ต้องหยุด`
   : allowed?'':' · เกิน 6 วันติด';
  return [
   {rule:`MAX_SIX_DAYS_${employeeId}`,label:'วันทำงานต่อเนื่อง',status:allowed?'PASS':'FAIL',
    message:`ก่อน${action} ${runText(before)} → หลัง${action} ${runText(after)}${note}`},
   {rule:`MIN_SHIFT_REST_${employeeId}`,label:'เวลาพักระหว่างกะ',status:restIssue?'FAIL':'PASS',message:restIssue??shiftRestRule}
  ];
 }

 async rosterConflict(c:PoolClient,slots:Pick<Assignment,'employee_id'|'assignment_id'|'work_date'|'is_working'|'start_time'|'end_time'>[]) {
  const dates=slots.map(slot=>slot.work_date).sort();
  const replacements=new Map(slots.map(slot=>[slot.assignment_id,slot]));
  for(const employeeId of new Set(slots.map(slot=>slot.employee_id))) {
   const {after,restIssue}=await this.projectedRoster(c,employeeId,dates[0],dates.at(-1)!,replacements);
   if(restIssue)return restIssue;
   if(after.days>MAX_CONSECUTIVE_DAYS)return 'ตารางที่ได้ทำให้ทำงานติดกันเกิน 6 วัน';
  }
  return null;
 }
 private async projectedRoster(c:PoolClient,employeeId:number,firstDate:string,lastDate:string,
  replacements:ReadonlyMap<number,RosterShift>) {
  const rows=(await c.query(`SELECT a.work_date,a.assignment_id,st.is_working,st.start_time,st.end_time FROM shift_assignments a JOIN shift_types st USING(shift_type_id)
   WHERE a.employee_id=$1 AND a.status='ACTIVE' AND a.work_date BETWEEN $2::date-7 AND $3::date+7 ORDER BY a.work_date`,[employeeId,firstDate,lastDate])).rows;
  const projected=rows.map(row=>{
   const incoming=replacements.get(row.assignment_id);
   return incoming?{...row,is_working:incoming.is_working,start_time:incoming.start_time,end_time:incoming.end_time}:row;
  });
  const spans=projected.filter(row=>row.is_working&&row.start_time&&row.end_time)
   .map(row=>{
    const [start,end]=interval(row.work_date,row.start_time,row.end_time);
    return {start,end,changed:replacements.has(row.assignment_id)};
   }).sort((a,b)=>a.start-b.start);
  let restIssue:string|null=null;
  for(let index=1;index<spans.length;index++) {
   const previous=spans[index-1],next=spans[index];
   const gap=next.start-previous.end;
   if(!Number.isFinite(gap)) {
    restIssue='ตรวจเวลาพักไม่ได้ เพราะเวลาเริ่มหรือเลิกกะไม่ถูกต้อง';
    break;
   }
   const times=()=>`กะก่อนเลิก ${bangkokShiftTime.format(previous.end)} และกะถัดไปเริ่ม ${bangkokShiftTime.format(next.start)}`;
   if(gap<0) {
    restIssue=`ช่วงเวลาทำงานซ้อนกัน ${Math.ceil(-gap/60000)} นาที · ${times()}`;
    break;
   }
   // Check pairs affected by this operation. Existing short rest elsewhere stays outside the request.
   if(!restIssue&&gap<MIN_SHIFT_REST_MS&&(previous.changed||next.changed)) {
    const minutes=Math.floor(gap/60000);
    const rest=`${Math.floor(minutes/60)} ชั่วโมง ${minutes%60} นาที`;
    restIssue=`${times()} พักได้ ${rest} ${shiftRestRule}`;
   }
  }
  return {before:longestRun(rows),after:longestRun(projected),restIssue};
 }
}
