import { h, replace, date, time, shiftBadge, statusLabel, icon, errorBox, toast } from '../../shared/dom.js';
import { api } from '../../api/client.js';
import { ui } from '../../app/state.js';
import { employeeRequestsView } from './employee-view.js';
export function requestsView(actor,requests,onDone,onSchedule) {
  if(actor.role==='EMPLOYEE')return employeeRequestsView(actor,requests,onSchedule,onDone);
  const content=h('div',{class:'view-stack'},h('div',{class:'page-heading'},h('div',{},h('h1',{},actor.role==='MANAGER'?'ติดตามสถานะคำขอ':actor.role==='SUPERVISOR'?'คำขอที่ต้องตรวจสอบ':'คำขอของฉัน'),h('p',{class:'muted'},actor.role==='MANAGER'?'คำขอรวมจากทุกทีม · อ่านความคืบหน้าและคำตัดสิน':'ดูความคืบหน้าและคำตัดสินของแต่ละฝ่าย')),h('span',{class:'pill neutral'},`${requests.length} รายการ`)));
  if(actor.role==='MANAGER')content.append(h('div',{class:'monitor-toolbar'},h('p',{class:'muted'},'หัวหน้าทีมทั้งสองฝ่ายเป็นผู้พิจารณาคำขอสลับกะ'),h('button',{class:'btn secondary',onclick:onSchedule},icon('schedule'),'ดูตารางกะทุกทีม')));
  if(!requests.length) return h('div',{class:'view-stack'},content,h('section',{class:'panel empty'},h('h2',{},actor.role==='SUPERVISOR'?'ยังไม่มีคำขอของทีม':'ยังไม่มีคำขอ'),h('p',{class:'muted'},actor.role==='SUPERVISOR'?'คำขอที่คุณรับผิดชอบจะปรากฏที่นี่เมื่อพนักงานยื่น':'เริ่มจากเลือกวันที่ในตาราง แล้วส่งคำขอสลับกะ'),h('button',{class:'btn primary',onclick:onSchedule},'ดูตารางกะ')));
  for(const request of requests) {
    const a=request.snapshot.source,b=request.snapshot.target;
    const panel=h('section',{class:'panel request-card'});
    const pending=request.approvals.find(a=>a.status==='PENDING');
    panel.append(h('div',{class:'panel-heading'},h('div',{},h('h2',{},`สลับกะ · ${date(a.work_date)}`),h('p',{class:'muted'},`คำขอ #${request.request_id} · ส่ง ${time(request.submitted_at)}`)),h('span',{class:`pill ${request.hasConflict?'rejected':request.status.toLowerCase()}`},request.hasConflict?'ตารางเปลี่ยนแล้ว':statusLabel[request.status])));
    panel.append(h('div',{class:'swap-preview'},h('div',{},h('strong',{},a.name),h('p',{},a.team_name),h('div',{class:'shift-change'},shiftBadge(a.shift_code),icon('arrow'),shiftBadge(b.shift_code))),h('div',{},h('strong',{},b.name),h('p',{},b.team_name),h('div',{class:'shift-change'},shiftBadge(b.shift_code),icon('arrow'),shiftBadge(a.shift_code)))));
    panel.append(h('ol',{class:'approval-steps'},...request.approvals.map(step=>h('li',{class:step.status.toLowerCase()},h('span',{class:'step-number'},step.approver_level),h('div',{},h('strong',{},step.name),h('p',{},`${step.team_name} · ${request.status==='CANCELLED'&&step.status==='PENDING'?'ไม่ได้ดำเนินการ':statusLabel[step.status]}`),step.approved_at?h('small',{},time(step.approved_at)):null,step.comment?h('p',{class:'decision-reason'},`เหตุผล: ${step.comment}`):null)))));
    if(request.status==='CANCELLED')panel.append(h('p',{class:'next-step cancelled'},'ผู้ยื่นยกเลิกคำขอแล้ว ตารางกะเดิมยังคงอยู่'));
    else if(request.demoSupported===false) panel.append(h('div',{class:'notice'},'คำขอเดิมนอกทีม A–D · เก็บไว้เพื่อดูประวัติ ยังดำเนินการต่อในเดโมชุดนี้ไม่ได้'));
    else if(request.status==='PENDING'&&request.approvalRouteConfirmed===false) panel.append(h('div',{class:'notice error'},'คำขอนี้ยังไม่มีขั้นอนุมัติของหัวหน้าทั้งสองทีมครบ กรุณาเริ่มคำขอใหม่'));
    else if(request.hasConflict) panel.append(h('div',{class:'notice error'},'ตารางกะเปลี่ยนหลังยื่นคำขอ จึงใช้คำขอนี้อนุมัติไม่ได้ กรุณากลับไปตารางล่าสุดและยื่นคำขอใหม่'));
    else if(request.status==='PENDING') panel.append(h('p',{class:'next-step'},`รอ ${pending?.name??'หัวหน้าทีม'} · ตารางยังไม่เปลี่ยน`));
    else if(request.status==='APPROVED') panel.append(h('p',{class:'next-step success'},'อนุมัติครบสองฝ่ายแล้ว ตารางกะทั้งสองคนอัปเดตเรียบร้อย'));
    else panel.append(h('p',{class:'next-step'},'คำขอไม่อนุมัติ ตารางกะเดิมยังคงอยู่'));
    if(request.canDecide) {
      const action=h('div',{class:'decision-area'}),message=h('div');let key=crypto.randomUUID();
      const actions=h('div',{class:'form-actions'},h('button',{class:'btn secondary',onclick:()=>confirm('REJECT')},'ไม่อนุมัติ'),h('button',{class:'btn primary',onclick:()=>confirm('APPROVE')},'ตรวจและอนุมัติ'));
      function confirm(decision) {
        key=crypto.randomUUID();
        const reason=h('textarea',{id:`reason-${request.request_id}`,rows:'3',maxlength:'500',required:decision==='REJECT',placeholder:'ระบุเหตุผลที่ผู้ยื่นคำขอสามารถดูได้'});
        const submit=h('button',{class:'btn primary',type:'submit'},decision==='APPROVE'?'ยืนยันอนุมัติ':'ยืนยันไม่อนุมัติ');
        const cancel=h('button',{class:'btn secondary',type:'button',onclick:()=>{
          replace(action,actions,message);replace(message);
          actions.querySelector(decision==='APPROVE'?'.primary':'.secondary').focus();
        }},'กลับ');
        replace(message);
        const form=h('form',{class:'decision-confirm',onsubmit:async event=>{
          event.preventDefault();if(ui.saving)return;ui.saving=true;submit.disabled=true;cancel.disabled=true;replace(message);
          try {await api(`/requests/${request.request_id}/decisions`,{method:'POST',key,body:{decision,expectedVersion:request.version,reason:decision==='REJECT'?reason.value:''}});toast(decision==='APPROVE'?'บันทึกการอนุมัติแล้ว':'บันทึกการไม่อนุมัติแล้ว');ui.saving=false;onDone();}
          catch(error) {replace(message,errorBox(error,error.status===409?onDone:undefined));}
          finally {ui.saving=false;submit.disabled=false;cancel.disabled=false;}
        }});
        const buttons=h('div',{class:'form-actions'},cancel,submit);
        if(decision==='APPROVE')form.append(
          h('div',{class:'decision-summary'},h('strong',{},`ยืนยันคำขอ #${request.request_id} วันที่ ${date(a.work_date)}`),buttons),
          h('p',{class:'muted'},pending.approver_level===1?'การยืนยันครั้งนี้จะส่งให้หัวหน้าอีกทีม ตารางยังไม่เปลี่ยน':'การยืนยันครั้งนี้จะเปลี่ยนตารางกะทั้งสองคนตามรายละเอียดด้านบน'),message);
        else form.append(h('strong',{},'ระบุเหตุผลก่อนยืนยันไม่อนุมัติ'),h('p',{class:'muted'},'เหตุผลจะถูกเก็บในประวัติคำขอ'),h('label',{class:'field',for:`reason-${request.request_id}`},'เหตุผล',reason),message,buttons);
        replace(action,form);if(decision==='REJECT')reason.focus();else submit.focus();
      }
      action.append(actions,message);panel.append(action);
    }
    content.append(panel);
  }
  return content;
}
