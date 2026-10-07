import { h, shiftBadge, shiftLabel, statusLabel, date, icon } from '../../shared/dom.js';
import { monthPicker } from '../../shared/month-picker.js';
import { swapInspector } from './swap-inspector.js';

const weekday=value=>new Intl.DateTimeFormat('th-TH',{weekday:'short',timeZone:'Asia/Bangkok'}).format(new Date(`${value}T12:00:00+07:00`));
const monthName=value=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${value}-01T12:00:00+07:00`));
const weekend=value=>[0,6].includes(new Date(`${value}T12:00:00+07:00`).getUTCDay());

export function scheduleView(actor,result,onSwap,onMonth,requests=[],onRequests=()=>{},teamFilter='ALL',onTeam=()=>{}) {
  const {assignments,schedule,month}=result;
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
  const dayClass=(d,index)=>`${weekend(d)?'weekend':''} ${index&&index%7===0?'week-start':''} ${d===today?'day-today':''}`;
  const rows=new Map();for(const row of assignments) {if(!rows.has(row.employee_id)) rows.set(row.employee_id,[]);rows.get(row.employee_id).push(row);}
  const own=assignments.filter(a=>a.employee_id===actor.employeeId);
  const content=h('div',{class:'view-stack schedule-view'},h('h1',{class:'sr-only'},actor.role==='EMPLOYEE'?'กะของฉัน':'ตารางกะ'));
  const inspector=swapInspector();
  const monthControl=monthPicker(month,onMonth);
  if(!schedule||!assignments.length) {
    content.append(monthControl,h('section',{class:'panel empty'},h('h2',{},'ยังไม่มีตารางในเดือนนี้'),h('p',{class:'muted'},'ชุดข้อมูลเดโมมีเดือนกันยายนถึงพฤศจิกายน 2569 เลือกเดือนที่มีข้อมูลเพื่อทดลอง')));return content;
  }
  if(actor.role==='EMPLOYEE'&&own.length) {
    const selected=own.find(a=>a.work_date===today)??own.find(a=>a.work_date===`${month}-08`)??own[0];
    const next=own.filter(a=>a.work_date>=selected.work_date).slice(0,7);
    const swapAssignment=own.find(a=>a.work_date===`${month}-08`)??selected;
    const supervisor=assignments.find(a=>a.position==='SUPERVISOR'&&a.team_id===actor.teamId);
    const hero=h('section',{class:'operator-hero-card','aria-label':'กะตามตารางของคุณ'},
      h('p',{class:'operator-hero-date'},`${date(selected.work_date)} · ${actor.teamName}`),
      h('h2',{class:'operator-hero-shift'},`${shiftLabel[selected.shift_code]} · รหัส ${selected.shift_code}`),
      h('p',{class:'operator-supervisor'},`หัวหน้าทีม: ${supervisor?.name??'—'}`),
      h('div',{class:'operator-hero-meta'},
        h('div',{},h('small',{},'เวลาปฏิบัติงาน'),h('strong',{},selected.is_working?`${selected.start_time.slice(0,5)}–${selected.end_time.slice(0,5)}`:'วันหยุดตามตาราง')),
        h('div',{},h('small',{},'รหัสพนักงาน'),h('strong',{},selected.employee_code))));
    const sevenDays=h('section',{class:'panel seven-days'},
      h('div',{class:'panel-heading'},h('div',{},h('h2',{},`ตารางกะของฉัน · ${monthName(month)}`),h('p',{class:'muted'},'เลือกวันที่เพื่อดูรายละเอียดและขอสลับกะ')),monthControl),
      h('div',{class:'panel-body'},h('div',{class:'seven-day-strip','aria-label':'กะของคุณช่วง 7 วัน',onscroll:()=>inspector.dismiss()},...next.map(a=>{
        const badge=h('span',{class:`grid-shift shift-${a.shift_code.toLowerCase()}`},a.shift_code);
        const day=h('button',{class:`day-card ${a.work_date===today?'today':''}`,onclick:a.swap?undefined:()=>onSwap(a.assignment_id),'aria-label':`${date(a.work_date)} ${a.shift_name} ขอเลือกสลับกะ`},
          h('span',{class:'day-card-date'},`${weekday(a.work_date)} ${Number(a.work_date.slice(-2))}`),badge,h('span',{class:'day-card-status'},shiftLabel[a.shift_code]));
        if(a.swap)return h('div',{class:'day-card-wrap'},day,inspector.attach(day,a,badge,onSwap));
        return day;
      })),
        h('p',{class:'strip-hint'},'เลื่อนซ้าย–ขวาเพื่อดูวันที่ถัดไป'),
        h('button',{class:'btn secondary full-width',onclick:()=>document.getElementById('monthly-schedule')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})},icon('schedule'),'ดูตารางกะของทีมทั้งเดือน')));
    const requestActions=h('section',{class:'panel'},h('div',{class:'panel-heading'},h('div',{},h('h2',{},'ส่งคำขอ'),h('p',{class:'muted'},'เลือกคู่สลับ ก่อนส่งให้หัวหน้าทีมพิจารณา'))),
      h('div',{class:'panel-body request-actions'},h('button',{class:'request-action-btn','aria-label':'ขอสลับกะ',onclick:()=>onSwap(swapAssignment.assignment_id)},h('span',{class:'action-icon'},icon('swap')),h('span',{class:'req-text'},h('strong',{},'ขอสลับกะกับเพื่อนร่วมงาน'),h('small',{},'เลือกพนักงานต่างทีม · หัวหน้าสองฝ่ายอนุมัติ')),icon('arrow')),
        h('p',{class:'muted action-help'},'เลือกวันอื่นได้จากตารางกะของคุณ')));
    const pending=requests.filter(r=>r.status==='PENDING');
    const status=h('section',{class:'panel'},h('div',{class:'panel-heading'},h('div',{},h('h2',{},'สถานะคำขอของฉัน'),h('p',{class:'muted'},'ดูรายการคำขอและความคืบหน้าล่าสุด'))),
      h('div',{class:'panel-body request-status-list'},...(pending.length?pending.slice(0,3).map(r=>h('button',{class:'request-status-row',onclick:onRequests},h('strong',{},`สลับกะ · ${date(r.snapshot.source.work_date)}`),h('span',{class:'pill pending'},statusLabel[r.status]),h('small',{},`รอ ${r.approvals.find(a=>a.status==='PENDING')?.name??'หัวหน้าทีม'}`))):[h('p',{class:'status-empty'},'ไม่มีคำขอที่รอดำเนินการในขณะนี้')]),
        requests.length?h('button',{class:'btn quiet full-width',onclick:onRequests},'ดูคำขอทั้งหมด',icon('arrow')):null));
    content.append(h('div',{class:'operator-layout'},h('div',{class:'operator-column'},hero,sevenDays),h('div',{class:'operator-column'},requestActions,status)));
  }
  const head=h('div',{class:'schedule-toolbar'},h('div',{class:'schedule-heading'},h('h2',{},'ตารางกะฝ่ายผลิต'),h('span',{class:`pill ${schedule.status==='PUBLISHED'?'approved':'neutral'}`},schedule.status==='PUBLISHED'?'เผยแพร่แล้ว':'แบบร่าง')),
    h('div',{class:'schedule-controls'},actor.role==='EMPLOYEE'?null:monthControl,
      h('label',{class:'team-filter'},'ทีม',h('select',{id:'team-filter','aria-label':'กรองทีมในตาราง',onchange:e=>onTeam(e.target.value)},...['ALL','A','B','C','D'].map(code=>h('option',{value:code,selected:teamFilter===code},code==='ALL'?'ทุกทีม A–D':`ทีม ${code}`))))));
  const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const days=Array.from({length:lastDay},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);
  const body=h('tbody');let previousTeam=null;
  for(const employeeRows of [...rows.values()].sort((a,b)=>a[0].team_code.localeCompare(b[0].team_code)||a[0].employee_id-b[0].employee_id)) {
    const first=employeeRows[0],isOwn=first.employee_id===actor.employeeId;
    if(teamFilter!=='ALL'&&first.team_code!==teamFilter)continue;
    if(previousTeam!==first.team_id) {
      body.append(h('tr',{class:'team-row','data-team':first.team_code},h('th',{scope:'rowgroup',colspan:String(days.length+1)},h('span',{},first.team_name))));previousTeam=first.team_id;
    }
    body.append(h('tr',{class:isOwn?'own-row':''},h('th',{scope:'row',class:'name-column'},h('div',{class:'employee-name'},h('strong',{},first.name),isOwn?h('span',{class:'own-label'},'คุณ'):null),h('small',{},`${first.employee_code} · ${first.position==='SUPERVISOR'?'หัวหน้าทีม':'พนักงาน'}`)),...days.map((d,index)=>{
      const a=employeeRows.find(a=>a.work_date===d),cell={class:dayClass(d,index),'data-work-date':d};if(!a)return h('td',cell,'—');
      const canSwap=isOwn&&actor.role==='EMPLOYEE'&&['A','B'].includes(a.team_code);
      const badge=h(canSwap||a.swap?'button':'span',{type:canSwap||a.swap?'button':undefined,class:`grid-shift shift-${a.shift_code.toLowerCase()}`,'data-assignment-id':a.assignment_id,'data-own-assignment':canSwap?'true':undefined,
        onclick:canSwap&&!a.swap?()=>onSwap(a.assignment_id):undefined,'aria-label':canSwap?`${date(d)} ${a.shift_name} เลือกสลับกะ`:undefined},a.shift_code);
      if(a.swap) {
        const detail=inspector.attach(badge,a,badge,canSwap?onSwap:null);
        if(detail)return h('td',cell,h('span',{class:'shift-cell-actions'},badge,detail));
      }
      return h('td',cell,badge);
    })));
  }
  if(!body.children.length)body.append(h('tr',{},h('td',{colspan:String(days.length+1),class:'table-empty'},'ยังไม่มีตารางของทีมที่เลือก')));
  const weeks=Array.from({length:Math.ceil(days.length/7)},(_,i)=>({start:i*7+1,end:Math.min(days.length,(i+1)*7)}));
  const table=h('table',{class:'schedule-table'},h('caption',{class:'sr-only'},`ตารางกะ ${monthName(month)} · ${teamFilter==='ALL'?'ทุกทีม A–D':`ทีม ${teamFilter}`}`),
    h('thead',{},h('tr',{class:'week-heading'},h('th',{scope:'col',rowspan:'2',class:'name-column'},'รหัสและชื่อพนักงาน'),...weeks.map((week,i)=>h('th',{scope:'colgroup',colspan:String(week.end-week.start+1)},`สัปดาห์ ${i+1} (${week.start}–${week.end})`))),
      h('tr',{class:'day-heading'},...days.map((d,index)=>h('th',{scope:'col',class:dayClass(d,index),'data-work-date':d,'aria-current':d===today?'date':undefined,'aria-label':`${date(d)}${d===today?' วันนี้':''}`},h('small',{},weekday(d)),h('strong',{},d.slice(-2)),d===today?h('small',{class:'today-label'},'วันนี้'):null)))),body);
  content.append(h('section',{id:'monthly-schedule',class:'panel monthly-schedule'},head,h('div',{class:'grid-scroll',tabindex:'0','aria-label':'เลื่อนตารางแนวนอนเพื่อดูทุกวัน',onscroll:()=>inspector.dismiss()},table),
    h('p',{class:'table-scroll-hint'},'เลื่อนซ้าย–ขวาเพื่อดูครบเดือน และเลื่อนขึ้น–ลงเพื่อดูทุกทีม'),
    h('div',{class:'legend'},...['M','N','O'].map(shiftBadge),h('span',{class:'swap-legend'},icon('swap'),'สลับกะแล้ว'),actor.role==='EMPLOYEE'?h('span',{class:'muted'},'เลือกช่องกะของคุณเพื่อส่งคำขอ'):null)));
  content.append(inspector.popup);
  content.append(h('p',{class:'policy-note'},'ข้อมูลสมมติ · กฎโควต้า ช่วงเวลาคำขอ ทักษะละเอียด และกำลังคนขั้นต่ำยังรอยืนยันบริษัท'));
  return content;
}
