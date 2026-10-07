import { h,replace,date,errorBox,toast } from '../../shared/dom.js';
import { api } from '../../api/client.js';
import { ui } from '../../app/state.js';

export function cancelAction(request,onDone) {
  const area=h('div',{class:'employee-request-cancel'});
  const open=h('button',{type:'button',class:'btn secondary employee-request-detail-button',onclick:confirm},'ยกเลิกคำขอ');
  function confirm() {
    const key=crypto.randomUUID(),message=h('div');
    const submit=h('button',{type:'submit',class:'btn primary'},'ยืนยันยกเลิกคำขอ');
    const back=h('button',{type:'button',class:'btn secondary',onclick:()=>{replace(area,open);open.focus();}},'กลับ');
    const form=h('form',{class:'decision-confirm request-cancel-confirm',onsubmit:async event=>{
      event.preventDefault();if(ui.saving)return;
      ui.saving=true;submit.disabled=true;back.disabled=true;submit.textContent='กำลังยกเลิก…';replace(message);
      try {
        await api(`/requests/${request.request_id}/cancel`,{method:'POST',key,body:{expectedVersion:request.version}});
        toast('ยกเลิกคำขอแล้ว');ui.saving=false;onDone();
      }catch(error){replace(message,errorBox(error,error.status===409?onDone:undefined));}
      finally{ui.saving=false;submit.disabled=false;back.disabled=false;submit.textContent='ยืนยันยกเลิกคำขอ';}
    }},h('div',{class:'decision-summary'},h('strong',{},`ยกเลิกคำขอวันที่ ${date(request.snapshot.source.work_date)}?`),h('div',{class:'form-actions'},back,submit)),
      h('p',{class:'muted'},'คำขอนี้จะสิ้นสุด ตารางกะยังคงเดิม คุณสามารถยื่นคำขอใหม่ได้'),message);
    replace(area,form);back.focus();
  }
  area.append(open);return area;
}
