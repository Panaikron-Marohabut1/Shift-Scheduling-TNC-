import { h, replace, date, shiftLabel } from '../../shared/dom.js';
import { roster, teamCodes, heading, section, teamSummary, monthControl, dataTable } from '../../shared/scheduling.js';
// Count columns carry the shift badge once in the header so every number reads at a glance.
function shiftHeading(code) {return h('span',{class:'th-shift'},h('b',{class:`grid-shift shift-${code.toLowerCase()}`},code),shiftLabel[code]);}
function count(value) {return h('td',{class:`num ${value?'':'zero'}`},h('strong',{},value));}
export function overviewView(result,requests,onMonth,onRequests) {
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
  const selected=today.startsWith(result.month)?today:`${result.month}-01`;
  const body=h('tbody'),day=h('p',{class:'overview-day','aria-live':'polite'});
  function update(workDate) {
    const rows=result.assignments.filter(a=>a.work_date===workDate);
    day.textContent=`ข้อมูลวันที่ ${date(workDate)} · หน่วย: คน`;
    replace(body,...teamCodes.map(code=>{
      const team=rows.filter(a=>a.team_code===code),supervisor=team.find(a=>a.position==='SUPERVISOR');
      return h('tr',{class:`team-overview-row team-${code.toLowerCase()}`},h('th',{scope:'row'},`ทีม ${code}`),h('td',{},supervisor?.name??'—'),...['M','N','O'].map(shift=>count(team.filter(a=>a.shift_code===shift).length)),count(roster(team).length));
    }));
  }
  update(selected);
  const last=new Date(Number(result.month.slice(0,4)),Number(result.month.slice(5)),0).getDate();
  return h('div',{class:'view-stack'},heading('ภาพรวมกำลังพล','จำนวนคนตามตารางจริงใน fixture · ยังไม่ตัดสินว่าผ่านกำลังคนขั้นต่ำ',monthControl(result.month,onMonth)),teamSummary(result.assignments),
    h('div',{class:'monitor-toolbar'},h('p',{},`คำขอรอดำเนินการที่คุณรับผิดชอบ ${requests.filter(r=>r.status==='PENDING').length} รายการ`),h('button',{class:'btn secondary',onclick:onRequests},'เปิดคิวคำขอ')),
    section('ภาพรวมรายทีม','เลือกวันที่เพื่อดูจำนวนกะเช้า กะกลางคืน และวันหยุด',h('div',{class:'panel-body'},h('label',{class:'overview-date'},'วันที่',h('input',{type:'date',value:selected,min:`${result.month}-01`,max:`${result.month}-${last}`,onchange:e=>{if(e.target.value)update(e.target.value);}})),day),dataTable(['ทีม','หัวหน้าทีม',...['M','N','O'].map(shiftHeading),'สมาชิก'],body,'จำนวนคนแยกตามกะของแต่ละทีม')),h('p',{class:'policy-note'},'ทักษะ ตำแหน่งขั้นต่ำ และกฎกำลังคนบริษัท — / รอยืนยัน'));
}
