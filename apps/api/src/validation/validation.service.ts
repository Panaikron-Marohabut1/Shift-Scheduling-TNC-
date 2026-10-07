import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Actor, Assignment, Check } from '../shared/types';
export const pendingPolicies:Check[]=[
 {rule:'SWAP_QUOTA',status:'UNCONFIRMED',message:'การนับโควต้าสลับกะ: รอยืนยันบริษัท'},
 {rule:'REQUEST_WINDOW',status:'UNCONFIRMED',message:'ช่วงเวลาและ cutoff: รอยืนยันบริษัท'},
 {rule:'COVERAGE',status:'UNCONFIRMED',message:'กำลังคนขั้นต่ำและข้อยกเว้น: รอยืนยันบริษัท'},
 {rule:'SKILLS',status:'UNCONFIRMED',message:'ทักษะและคุณสมบัติละเอียด: รอยืนยันบริษัท'}
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
@Injectable()
export class ValidationService {
 async check(c:PoolClient,actor:Actor,a:Assignment,b:Assignment,submission=true) {
  const checks:Check[]=[];
  const add=(rule:string,ok:boolean,message:string)=>checks.push({rule,status:ok?'PASS':'FAIL',message});
  add('OWN_ASSIGNMENT',!submission||a.employee_id===actor.employeeId,'รายการต้นทางเป็นของผู้ยื่นคำขอ');
  add('DISTINCT_TEAMS',a.employee_id!==b.employee_id&&a.team_id!==b.team_id,'สลับกับพนักงานต่างทีม');
  add('SAME_DATE',a.work_date===b.work_date,'รายการทั้งสองเป็นวันที่เดียวกัน');
  add('EFFECTIVE_ASSIGNMENT',a.status==='ACTIVE'&&b.status==='ACTIVE','ใช้รายการกะที่มีผลอยู่');
  add('POSITION',!!a.position&&a.position===b.position,'ตำแหน่งตรงกันในชุดข้อมูลทดสอบ');
  add('DIFFERENT_SHIFT',a.shift_type_id!==b.shift_type_id,'เลือกกะต่างกันเพื่อให้เห็นผลการสลับ');
  for(const [own,incoming] of [[a,b],[b,a]]) {
   const rows=(await c.query(`SELECT a.work_date,a.assignment_id,st.is_working,st.start_time,st.end_time FROM shift_assignments a JOIN shift_types st USING(shift_type_id)
    WHERE a.employee_id=$1 AND a.status='ACTIVE' AND a.work_date BETWEEN $2::date-7 AND $2::date+7 ORDER BY a.work_date`,[own.employee_id,own.work_date])).rows;
   const projected=rows.map(row=>row.assignment_id===own.assignment_id?{...row,is_working:incoming.is_working,start_time:incoming.start_time,end_time:incoming.end_time}:row);
   add(`MAX_SIX_DAYS_${own.employee_id}`,longestWorkingRun(projected)<=6,`${own.name}: ทำงานไม่เกิน 6 วันต่อเนื่อง รวมข้ามเดือน`);
   const spans=projected.filter(r=>r.is_working&&r.start_time&&r.end_time).map(r=>interval(r.work_date,r.start_time,r.end_time)).sort((x,y)=>x[0]-y[0]);
   add(`NO_OVERLAP_${own.employee_id}`,spans.every((s,i)=>i===0||s[0]>=spans[i-1][1]),`${own.name}: ช่วงเวลาทำงานไม่ซ้อน รวมกะข้ามคืน`);
  }
  return {valid:checks.every(x=>x.status==='PASS'),checks:[...checks,...pendingPolicies],dataSource:'SYNTHETIC',companyPoliciesConfirmed:false};
 }
}
