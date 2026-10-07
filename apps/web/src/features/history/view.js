import { h,date,time,icon,shiftBadge,statusLabel } from '../../shared/dom.js';
const actionLabel={REQUEST_SUBMITTED:'ยื่นคำขอสลับกะ',REQUEST_APPROVED:'บันทึกการอนุมัติ',REQUEST_REJECTED:'บันทึกการไม่อนุมัติ',REQUEST_CANCELLED:'ยกเลิกคำขอสลับกะ',SCHEDULE_SWAP_APPLIED:'เปลี่ยนตารางกะทั้งสองคน'};
export function historyView(records) {
  const groups=new Map();
  for(const record of records.filter(r=>r.entity_type==='REQUEST'&&actionLabel[r.action])) {
    if(!groups.has(record.entity_id))groups.set(record.entity_id,[]);groups.get(record.entity_id).push(record);
  }
  const page=h('div',{class:'view-stack'},h('div',{class:'page-heading'},h('div',{},h('h1',{},'ประวัติการเปลี่ยนแปลง'),h('p',{class:'muted'},'คำขอของคุณและผลการดำเนินการที่เกี่ยวข้อง'))));
  if(!groups.size){page.append(h('section',{class:'panel empty'},h('h2',{},'ยังไม่มีประวัติคำขอ'),h('p',{class:'muted'},'เมื่อยื่นคำขอหรือมีผลการพิจารณา จะแสดงความคืบหน้าที่นี่')));return page;}
  for(const [id,events] of groups) {
    const submitted=events.find(e=>e.action==='REQUEST_SUBMITTED'),applied=events.find(e=>e.action==='SCHEDULE_SWAP_APPLIED');
    const snapshot=submitted?.new_value?.snapshot??applied?.old_value,status=events[0].new_value?.status??(applied?'APPROVED':'PENDING');
    const panel=h('section',{class:'panel activity-card'},h('div',{class:'panel-heading'},h('div',{},h('h2',{},snapshot?`สลับกะ · ${date(snapshot.source.work_date)}`:`คำขอสลับกะ #${id}`),h('p',{class:'muted'},snapshot?`${snapshot.source.name} · ${snapshot.target.name}`:`คำขอ #${id}`)),h('span',{class:`pill ${status.toLowerCase()}`},statusLabel[status]??'รอดำเนินการ')));
    if(applied)panel.append(h('div',{class:'activity-shifts'},...['source','target'].map(side=>h('div',{},h('strong',{},applied.old_value[side].name),h('div',{class:'shift-change'},shiftBadge(applied.old_value[side].shift_code),icon('arrow'),shiftBadge(applied.new_value[side].shift_code))))));
    const timeline=h('ol',{class:'activity-timeline'});
    for(const record of events.slice().reverse())timeline.append(h('li',{},
      h('span',{class:`activity-dot ${record.action==='REQUEST_REJECTED'?'rejected':''}`}),
      h('div',{},h('strong',{},actionLabel[record.action]),h('p',{class:'muted'},record.actor_name),record.new_value?.reason?h('p',{class:'activity-reason'},`เหตุผล: ${record.new_value.reason}`):null),
      h('time',{datetime:record.created_at},time(record.created_at))));
    panel.append(timeline);
    page.append(panel);
  }
  return page;
}
