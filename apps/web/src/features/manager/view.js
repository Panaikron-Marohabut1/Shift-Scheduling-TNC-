import { h, replace, icon, shiftLabel, shiftBadge } from '../../shared/dom.js';
import { ui } from '../../app/state.js';
import { roster, teamCodes, disabledButton, heading, section, dataTable, teamSummary } from '../../shared/scheduling.js';

export function peopleView(result) {
  const people=roster(result.assignments),body=h('tbody'),count=h('p',{class:'list-count','aria-live':'polite'});
  function filter() {
    const search=ui.peopleSearch.trim().toLocaleLowerCase();
    const selected=people.filter(a=>(ui.peopleTeam==='ALL'||a.team_code===ui.peopleTeam)&&(!search||`${a.name} ${a.employee_code}`.toLocaleLowerCase().includes(search)));
    replace(body,...selected.map(a=>h('tr',{},h('td',{class:'employee-code'},a.employee_code),h('td',{},h('strong',{},a.name)),h('td',{},h('span',{class:'pill neutral'},a.team_name)),h('td',{},a.position==='SUPERVISOR'?'หัวหน้าทีม':'พนักงานกะ'),h('td',{class:'row-actions'},disabledButton('แก้ไข','การแก้ข้อมูลยังไม่เชื่อม'),disabledButton('ย้ายทีม','การย้ายทีมยังไม่เชื่อม')))));
    if(!selected.length)body.append(h('tr',{},h('td',{colspan:'5',class:'table-empty'},'ไม่พบสมาชิกกะที่ตรงกับการค้นหา')));
    count.textContent=`แสดง ${selected.length} จาก ${people.length} คน · ข้อมูลจากตารางกะ ${result.month}`;
  }
  const search=h('label',{class:'people-search'},h('span',{class:'sr-only'},'ค้นหาพนักงาน'),h('input',{type:'search',value:ui.peopleSearch,placeholder:'ค้นหาชื่อหรือรหัสพนักงาน',oninput:e=>{ui.peopleSearch=e.target.value;filter();}}));
  const team=h('label',{class:'filter-label'},'ทีม',h('select',{'aria-label':'ทีมพนักงาน',onchange:e=>{ui.peopleTeam=e.target.value;filter();}},...['ALL',...teamCodes].map(code=>h('option',{value:code,selected:ui.peopleTeam===code},code==='ALL'?'ทั้งหมด':`ทีม ${code}`))));
  filter();
  return h('div',{class:'view-stack people-page'},heading('พนักงานและทีม','สมาชิกกะจากตารางที่คุณมีสิทธิ์ดู · ข้อมูลสมมติทั้งหมด'),teamSummary(result.assignments),
    section('รายชื่อพนักงาน','อ่านรายชื่อ ค้นหา และกรองทีมได้ · เพิ่ม แก้ไข และย้ายทีมยังรอเชื่อมข้อมูล',h('div',{class:'people-tools'},disabledButton('เพิ่มพนักงาน','การเพิ่มพนักงานยังไม่เชื่อม','people'),search,team),count,dataTable(['รหัสพนักงาน','ชื่อ-นามสกุล','ทีม','ตำแหน่ง','จัดการ'],body,'สมาชิกกะในข้อมูลทดสอบ')));
}

export function annualView(months,year,onYear,onMonth) {
  const assignments=months.flatMap(m=>m.assignments),people=roster(assignments);
  // Rotation order stays disabled until the company confirms the rotation pattern.
  const teams=dataTable(['ทีม','สมาชิก','ลำดับเริ่มต้น','สถานะ'],h('tbody',{},...teamCodes.map(code=>h('tr',{},h('th',{scope:'row'},`ทีม ${code}`),h('td',{},people.length?`${people.filter(p=>p.team_code===code).length} คน`:'ยังไม่มีข้อมูล'),
    h('td',{},h('div',{class:'segmented',role:'group','aria-label':`ลำดับเริ่มต้นของทีม ${code}`},disabledButton('เช้าก่อน','การเปลี่ยนรอบกะยังไม่เชื่อม','sun'),disabledButton('ดึกก่อน','การเปลี่ยนรอบกะยังไม่เชื่อม','moon'))),
    h('td',{},h('span',{class:'pill neutral'},'รอยืนยัน'))))),'ลำดับกะของแต่ละทีม');
  const cards=h('div',{class:'annual-month-grid'},...months.map((result,index)=>{
    const hasData=result.assignments.length>0,label=new Intl.DateTimeFormat('th-TH',{month:'long'}).format(new Date(year,index,1));
    return h('article',{class:'panel annual-month-card'},h('div',{class:'panel-body'},h('div',{class:'annual-month-heading'},h('h3',{},label),hasData?h('span',{class:'pill approved'},'ข้อมูลเดโม'):null),
      hasData?h('div',{class:'annual-month-rows'},...teamCodes.map(code=>{
        const a=result.assignments.filter(a=>a.team_code===code);
        return h('div',{class:'annual-month-team-row'},h('strong',{},`ทีม ${code}`),...['M','N','O'].map(shift=>h('span',{'aria-label':`${shiftLabel[shift]} ${a.filter(a=>a.shift_code===shift).length} คน-วัน`},h('b',{class:`grid-shift shift-${shift.toLowerCase()}`},shift),a.filter(a=>a.shift_code===shift).length)));
      }),h('button',{class:'btn quiet full-width',onclick:()=>onMonth(result.month)},'ดูตารางเดือนนี้',icon('arrow'))):h('p',{class:'annual-no-data'},'ยังไม่มีข้อมูล')));
  }));
  return h('div',{class:'view-stack annual-schedule-page'},heading('ตารางรายปี','สรุปจากข้อมูลในฐานข้อมูล · เดือนที่ไม่มีรายการจะไม่สร้างตารางจำลอง',h('div',{class:'annual-year-actions'},h('button',{class:'icon-btn','aria-label':'ปีก่อนหน้า',disabled:year<=2025,onclick:()=>onYear(year-1)},icon('left')),h('strong',{},String(year)),h('button',{class:'icon-btn','aria-label':'ปีถัดไป',disabled:year>=2027,onclick:()=>onYear(year+1)},icon('arrow')))),
    section('ลำดับกะของแต่ละทีม','คงพื้นที่ตั้งค่าตามต้นแบบ · รูปแบบการหมุนเวียนยังรอยืนยัน',teams),
    section('วันหยุดนักขัตฤกษ์',`ปี ${year} · ยังไม่เชื่อมปฏิทินวันหยุดบริษัท`,h('div',{class:'panel-body'},h('p',{class:'muted'},'— / รอยืนยัน'),h('div',{class:'holiday-add'},h('input',{'aria-label':'ชื่อหรือวันที่วันหยุดใหม่',placeholder:'ชื่อหรือวันที่วันหยุดใหม่',disabled:true}),disabledButton('เพิ่มวันหยุด','การจัดการวันหยุดยังไม่เชื่อม')))),
    h('section',{},h('div',{class:'section-intro'},h('h2',{},'ภาพรวมทั้งปี'),h('p',{class:'muted'},'ตัวเลขนับรวมสมาชิกทุกคนในทีม หน่วยคน-วัน ไม่ใช่จำนวนวันของพนักงานคนเดียว'),h('div',{class:'legend compact'},...['M','N','O'].map(shiftBadge))),cards));
}

export function settingsView(result,navigate) {
  const shifts=[...new Map(result.assignments.map(a=>[a.shift_code,a])).values()].sort((a,b)=>a.shift_code.localeCompare(b.shift_code));
  return h('div',{class:'view-stack manager-settings-page'},heading('ตั้งค่าระบบ','อ่านข้อมูลช่วงเวลากะได้ · การแก้ค่าระบบยังไม่เชื่อม'),h('div',{class:'manager-settings-primary'},
    section('ช่วงเวลากะ','เวลาจาก API ของชุดข้อมูลเดโม',h('div',{class:'panel-body settings-time-grid'},...(shifts.length?shifts.map(a=>h('label',{class:'field'},`${a.shift_code} · ${a.shift_name}`,h('input',{value:a.is_working?`${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}`:'วันหยุดตามตาราง',disabled:true}))):[h('p',{class:'muted'},'ยังไม่มีข้อมูลกะในเดือนนี้')]))),
    h('div',{class:'settings-side'},section('กฎการทำงานและคำขอ','นโยบายบริษัทที่ยังไม่ยืนยันจะแสดงเป็นรอยืนยัน',h('div',{class:'panel-body settings-rule-list'},...['วันทำงานติดต่อกันสูงสุด','คำขอสลับ/เปลี่ยนกะต่อเดือน','ช่วงเวลายื่นคำขอ','กำลังคนขั้นต่ำและคุณสมบัติ'].map(label=>h('div',{class:'settings-rule-row'},h('strong',{},label),h('span',{class:'pill neutral'},'— / รอยืนยัน'))),h('p',{class:'policy-note'},'เดโมตรวจวันทำงานต่อเนื่องตาม fixture เท่านั้น ไม่ใช่การรับรองนโยบายบริษัท'))),
      section('ข้อมูลและทางลัด','โครงสร้างและข้อมูลส่วนที่เตรียมไว้',h('div',{class:'settings-shortcuts'},h('div',{class:'settings-shortcut'},h('div',{},h('strong',{},'โครงสร้างตำแหน่งในแต่ละกะ'),h('p',{class:'muted'},'สมาชิกจาก fixture · จำนวนและทักษะที่บริษัทกำหนดยังรอยืนยัน'))),h('div',{class:'settings-shortcut'},h('div',{},h('strong',{},`วันหยุดนักขัตฤกษ์ · ปี ${ui.year}`),h('p',{class:'muted'},'ยังไม่เชื่อมข้อมูลวันหยุด')),h('button',{class:'btn secondary',onclick:()=>navigate('annual')},'เปิดตารางรายปี',icon('arrow'))),h('div',{class:'settings-shortcut'},h('div',{},h('strong',{},'พนักงานและทีม'),h('p',{class:'muted'},'อ่านรายชื่อสมาชิกกะและค้นหาทีม')),h('button',{class:'btn secondary',onclick:()=>navigate('people')},'เปิดรายชื่อ',icon('arrow'))))))));
}
