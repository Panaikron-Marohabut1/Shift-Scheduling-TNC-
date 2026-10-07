import { h,date,time,shiftBadge,statusLabel,icon } from '../../shared/dom.js';
import { cancelAction } from './cancel-action.js';

const hours=a=>a.is_working?`${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}${a.end_time<=a.start_time?' · วันถัดไป':''}`:'วันหยุดตามตาราง';
export function employeeRequestsView(actor,requests,onSchedule,onDone) {
  const panel=h('section',{class:'panel employee-requests'},h('div',{class:'panel-heading'},h('h1',{},'คำขอของฉัน'),h('span',{class:'pill neutral'},`${requests.length} รายการ`)));
  if(!requests.length)panel.append(h('div',{class:'empty'},h('h2',{},'ยังไม่มีคำขอ'),h('p',{class:'muted'},'เลือกวันที่ในตารางกะเพื่อเริ่มยื่นคำขอสลับกะ'),h('button',{class:'btn primary',onclick:onSchedule},icon('schedule'),'ดูตารางกะ')));
  for(const request of requests) {
    const a=request.snapshot.source,b=request.snapshot.target,pending=request.approvals.find(step=>step.status==='PENDING');
    const detailId=`request-details-${request.request_id}`;
    const detailGrid=h('div',{class:'employee-request-detail-grid'});
    for(const [person,incoming] of [[a,b],[b,a]])detailGrid.append(h('div',{},
      h('strong',{},person.name),h('p',{class:'muted'},`${person.employee_code} · ${person.team_name}`),
      h('dl',{},h('dt',{},'กะเดิม'),h('dd',{},shiftBadge(person.shift_code),h('span',{},hours(person))),h('dt',{},'กะหลังสลับ'),h('dd',{},shiftBadge(incoming.shift_code),h('span',{},hours(incoming))))));
    const details=h('div',{id:detailId,class:'employee-request-details',hidden:true},h('h3',{},'รายละเอียดกะทั้งสองคน'),detailGrid);
    const detailButton=h('button',{type:'button',class:'btn secondary employee-request-detail-button','aria-expanded':'false','aria-controls':detailId,onclick:()=>{
      details.hidden=!details.hidden;detailButton.setAttribute('aria-expanded',String(!details.hidden));detailButton.textContent=details.hidden?'ดูรายละเอียด':'ซ่อนรายละเอียด';
    }},'ดูรายละเอียด');
    const body=h('div',{class:'employee-request-body'},
      h('div',{class:'employee-request-head'},h('div',{},h('strong',{},a.name),h('p',{class:'muted'},`Shift employee · ${a.team_name}`)),h('div',{class:'employee-request-state'},h('span',{class:'pill neutral'},'สลับกะข้ามทีม'),h('span',{class:`pill ${request.hasConflict?'rejected':request.status.toLowerCase()}`},request.hasConflict?'ตารางเปลี่ยนแล้ว':statusLabel[request.status]),detailButton)),
      h('div',{class:'employee-request-description'},h('h2',{},`สลับกะ · ${date(a.work_date)}`),h('p',{class:'muted'},`สลับกับ ${b.name} · ${b.team_name}`)),
      h('div',{class:'employee-request-info'},h('div',{},h('small',{},'กะเดิม → กะที่ขอ'),h('div',{class:'shift-change'},shiftBadge(a.shift_code),icon('arrow'),shiftBadge(b.shift_code))),h('div',{},h('small',{},'คู่สลับ'),h('strong',{},b.name),h('p',{class:'muted'},`${b.employee_code} · ${b.team_name}`))),
      h('p',{class:'employee-request-meta'},icon('history'),`ยื่นเมื่อ ${time(request.submitted_at)} · คำขอ #${request.request_id}`),
      h('div',{class:'employee-request-approval'},h('h3',{},'ขั้นตอนอนุมัติ'),h('ol',{class:'employee-approval-list'},...request.approvals.map(step=>h('li',{class:step.status.toLowerCase()},h('span',{class:'employee-approval-marker'},step.status==='APPROVED'?icon('check'):step.approver_level),h('div',{},h('strong',{},step.name),h('p',{},`${step.team_name} · ${['REJECTED','CANCELLED'].includes(request.status)&&step.status==='PENDING'?'ไม่ได้ดำเนินการ':statusLabel[step.status]}`),step.approved_at?h('time',{datetime:step.approved_at},time(step.approved_at)):null,step.comment?h('p',{class:'decision-reason'},`เหตุผล: ${step.comment}`):null))))),details);
    let outcome;
    if(request.status==='CANCELLED')outcome=h('p',{class:'employee-request-outcome cancelled'},'ยกเลิกคำขอแล้ว ตารางกะเดิมยังคงอยู่');
    else if(request.demoSupported===false)outcome=h('p',{class:'notice'},'คำขอเดิมนอกทีม A–D · เก็บไว้เพื่อดูประวัติ ยังดำเนินการต่อในเดโมชุดนี้ไม่ได้');
    else if(request.status==='PENDING'&&request.approvalRouteConfirmed===false)outcome=h('p',{class:'notice error'},'คำขอนี้ยังไม่มีขั้นอนุมัติของหัวหน้าทั้งสองทีมครบ กรุณาเริ่มคำขอใหม่');
    else if(request.hasConflict)outcome=h('p',{class:'notice error'},'ตารางกะเปลี่ยนหลังยื่นคำขอ จึงใช้คำขอนี้อนุมัติไม่ได้ กรุณากลับไปตารางล่าสุดและยื่นคำขอใหม่');
    else if(request.status==='PENDING')outcome=h('p',{class:'employee-request-outcome'},`รอ ${pending?.name??'หัวหน้าทีม'} · ตารางยังไม่เปลี่ยน`);
    else if(request.status==='APPROVED')outcome=h('p',{class:'employee-request-outcome success'},'อนุมัติครบสองฝ่ายแล้ว ตารางกะทั้งสองคนอัปเดตเรียบร้อย');
    else outcome=h('p',{class:'employee-request-outcome'},'คำขอไม่อนุมัติ ตารางกะเดิมยังคงอยู่');
    body.append(outcome);
    if(request.canCancel)body.append(cancelAction(request,onDone));
    panel.append(h('section',{class:`employee-request ${request.status.toLowerCase()}`},h('span',{class:'avatar'},a.employee_code.split('-').at(-1)),body));
  }
  return h('div',{class:'view-stack'},panel);
}
