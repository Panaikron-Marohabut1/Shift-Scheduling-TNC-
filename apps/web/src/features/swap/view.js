import { h,replace,shiftBadge,date,icon,errorBox,toast } from '../../shared/dom.js';
import { api } from '../../api/client.js';
import { ui } from '../../app/state.js';
import { partnerPicker } from './partner-picker.js';
const hours=a=>a.is_working?`${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}${a.end_time<=a.start_time?' · วันถัดไป':''}`:'วันหยุดตามตาราง';
export async function swapView(root,assignmentId,onDone,onBack) {
  const heading=h('div',{class:'page-heading'},h('div',{},h('h1',{},'ขอสลับกะข้ามทีม'),h('p',{class:'muted'},'เลือกวันที่และคู่สลับ แล้วตรวจรายละเอียดก่อนส่งคำขอ')),h('button',{class:'btn secondary',onclick:onBack},icon('left'),'กลับไปตาราง'));
  const body=h('section',{class:'panel swap-panel'});replace(root,h('div',{class:'view-stack swap-workspace'},heading,body));
  async function load(id=assignmentId) {
    assignmentId=id;replace(body,h('p',{class:'loading',role:'status'},'กำลังตรวจคู่สลับที่เป็นไปได้…'));
    try {
      const result=await api(`/swap/candidates?assignmentId=${id}`),a=result.assignment;
      const schedule=await api(`/schedules?month=${a.work_date.slice(0,7)}`);
      const own=schedule.assignments.filter(row=>row.employee_id===a.employee_id);
      const candidates=result.candidates.filter(b=>b.validation.valid);
      const dates=h('select',{id:'swap-date','aria-label':'วันที่ต้องการสลับ',onchange:event=>{if(!ui.saving)void load(Number(event.target.value));}},...own.map(row=>h('option',{value:String(row.assignment_id),selected:row.assignment_id===id},`${date(row.work_date)} · ${row.shift_code}`)));
      const options=h('div',{class:'partner-options'},h('h2',{},'ต้องการสลับกับ'),h('p',{class:'partner-help'},'แสดงเฉพาะเพื่อนร่วมงานต่างทีมที่ผ่านเงื่อนไขในวันที่เลือก'));
      const preview=h('div',{class:'swap-result',hidden:true}),checks=h('div'),message=h('div',{'aria-live':'polite'});
      const route=h('div',{class:'swap-approval-route'},h('strong',{},'การอนุมัติ'),h('p',{},`หัวหน้า${a.team_name}`,icon('arrow'),h('span',{class:'approval-target'},'หัวหน้าทีมคู่สลับ')),h('small',{},'ตารางเปลี่ยนเมื่อหัวหน้าทั้งสองฝ่ายอนุมัติครบ'));
      const submit=h('button',{class:'btn primary',type:'submit',disabled:true},'ส่งคำขอให้หัวหน้าทีม');
      const cancel=h('button',{class:'btn secondary',type:'button',onclick:onBack},'ยกเลิกการกรอก');
      let target=null,busy=false,conflict=false,key=crypto.randomUUID();
      function selectPartner(b) {
        target=b;key=crypto.randomUUID();submit.disabled=false;replace(message);preview.hidden=false;
        route.querySelector('.approval-target').textContent=`หัวหน้า${b.team_name}`;
        replace(preview,h('h3',{},'กะหลังสลับ'),...[[a,b],[b,a]].map(([person,incoming])=>h('div',{class:'swap-result-row'},h('div',{},h('strong',{},person.name),h('small',{},person.team_name)),h('div',{class:'shift-change'},shiftBadge(person.shift_code),icon('arrow'),shiftBadge(incoming.shift_code)))));
        const confirmed=b.validation.checks.filter(c=>c.status!=='UNCONFIRMED'),pending=b.validation.checks.filter(c=>c.status==='UNCONFIRMED');
        replace(checks,h('details',{class:'swap-validation'},h('summary',{},icon('check'),'ตรวจเงื่อนไขแล้ว',h('span',{},`${confirmed.length} ข้อ`)),h('ul',{},...confirmed.map(c=>h('li',{},icon('check'),c.message)))),h('details',{class:'swap-policies'},h('summary',{},'เงื่อนไขบริษัท',h('span',{class:'pill neutral'},'รอยืนยัน')),h('ul',{},...pending.map(c=>h('li',{},c.message)))));
      }
      const picker=partnerPicker(candidates,selectPartner,hours);
      if(candidates.length)options.append(picker.element);
      if(!candidates.length)options.append(h('div',{class:'partner-empty'},h('strong',{},'ยังไม่มีคู่สลับที่ผ่านเงื่อนไข'),h('p',{},'เลือกวันอื่นจากช่องวันที่ต้องการสลับ')));
      const source=h('aside',{class:'swap-source'},h('label',{class:'field',for:'swap-date'},'วันที่ต้องการสลับ',dates),h('div',{class:'swap-source-person'},h('h2',{},'กะของคุณ'),h('strong',{},a.name),h('p',{},`${a.employee_code} · ${a.team_name}`),shiftBadge(a.shift_code),h('p',{class:'source-hours'},hours(a))),h('p',{class:'swap-source-note'},'เลือกวันอื่นได้โดยไม่ต้องกลับไปหน้าตาราง'));
      const form=h('form',{class:'swap-form',onsubmit:async event=>{
        event.preventDefault();if(!target||busy)return;
        busy=true;ui.saving=true;dates.disabled=true;picker.setDisabled(true);submit.disabled=true;cancel.disabled=true;submit.textContent='กำลังบันทึกคำขอ…';replace(message);
        try {
          await api('/requests',{method:'POST',key,body:{assignmentId:a.assignment_id,targetAssignmentId:target.assignment_id,assignmentVersion:a.version,targetVersion:target.version}});
          toast('บันทึกคำขอแล้ว รอหัวหน้าทีมของคุณอนุมัติ');ui.saving=false;onDone();
        }catch(error){
          replace(message,errorBox(error,error.status===409?()=>load():undefined));
          if(error.status===409){
            target=null;conflict=true;key=crypto.randomUUID();preview.hidden=true;replace(checks);
            picker.reset();
            route.querySelector('.approval-target').textContent='หัวหน้าทีมคู่สลับ';
          }
        }
        finally{busy=false;ui.saving=false;dates.disabled=false;picker.setDisabled(conflict);submit.disabled=!target;cancel.disabled=false;submit.textContent='ส่งคำขอให้หัวหน้าทีม';}
      }},h('div',{class:'swap-layout'},source,h('div',{class:'swap-selection'},options,preview,checks,route,message)),h('div',{class:'swap-footer'},h('p',{class:'muted'},'ตรวจวันที่และกะหลังสลับให้ถูกต้อง'),h('div',{class:'form-actions'},cancel,submit)));
      replace(body,form);
      if(!candidates.length) {
        const failures=[...new Set(result.candidates.flatMap(b=>b.validation.checks.filter(c=>c.status==='FAIL').map(c=>c.message)))];
        if(failures.length)replace(checks,h('details',{class:'swap-policies'},h('summary',{},'เหตุผลที่ยังเลือกคู่สลับไม่ได้'),h('ul',{},...failures.map(message=>h('li',{},message)))));
      }
    }catch(error){replace(body,errorBox(error,()=>load()));}
  }
  await load();
}
