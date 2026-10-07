import { h, replace, date, shiftBadge } from '../../shared/dom.js';
import { roster, teamCodes, heading, section, teamSummary, monthControl } from '../../shared/scheduling.js';
export function overviewView(result,requests,onMonth,onRequests) {
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
  const selected=today.startsWith(result.month)?today:`${result.month}-01`;
  const summaries=h('div',{class:'team-overview-list'});
  function update(workDate) {
    const rows=result.assignments.filter(a=>a.work_date===workDate);
    replace(summaries,...teamCodes.map(code=>{
      const team=rows.filter(a=>a.team_code===code),supervisor=team.find(a=>a.position==='SUPERVISOR');
      return h('div',{class:`team-overview-row team-${code.toLowerCase()}`},h('div',{},h('h3',{},`ทีม ${code} · ${date(workDate)}`),h('p',{class:'muted'},`หัวหน้าทีม: ${supervisor?.name??'—'} · สมาชิก ${roster(team).length} คน`)),h('div',{class:'team-shift-counts'},...['M','N','O'].map(shift=>h('span',{},shiftBadge(shift),h('strong',{},`${team.filter(a=>a.shift_code===shift).length} คน`)))));
    }));
  }
  update(selected);
  const last=new Date(Number(result.month.slice(0,4)),Number(result.month.slice(5)),0).getDate();
  return h('div',{class:'view-stack'},heading('ภาพรวมกำลังพล','จำนวนคนตามตารางจริงใน fixture · ยังไม่ตัดสินว่าผ่านกำลังคนขั้นต่ำ',monthControl(result.month,onMonth)),teamSummary(result.assignments),
    h('div',{class:'monitor-toolbar'},h('p',{},`คำขอรอดำเนินการที่คุณรับผิดชอบ ${requests.filter(r=>r.status==='PENDING').length} รายการ`),h('button',{class:'btn secondary',onclick:onRequests},'เปิดคิวคำขอ')),
    section('ภาพรวมรายทีม','เลือกวันที่เพื่อดูจำนวนกะเช้า กะกลางคืน และวันหยุด',h('div',{class:'panel-body'},h('label',{class:'overview-date'},'วันที่',h('input',{type:'date',value:selected,min:`${result.month}-01`,max:`${result.month}-${last}`,onchange:e=>{if(e.target.value)update(e.target.value);}})),summaries)),h('p',{class:'policy-note'},'ทักษะ ตำแหน่งขั้นต่ำ และกฎกำลังคนบริษัท — / รอยืนยัน'));
}
