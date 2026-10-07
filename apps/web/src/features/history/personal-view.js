import { h,date,time,icon } from '../../shared/dom.js';
export function personalHistoryView(actor,records) {
  const actions={REQUEST_SUBMITTED:'ยื่นคำขอสลับกะ',REQUEST_APPROVED:'อนุมัติคำขอสลับกะ',REQUEST_REJECTED:'ไม่อนุมัติคำขอสลับกะ',REQUEST_CANCELLED:'ยกเลิกคำขอสลับกะ'};
  const own=records.filter(record=>record.user_id===actor.userId&&record.entity_type==='REQUEST'&&actions[record.action]);
  const rows=h('ol',{class:'personal-history-list'});
  for(const record of own) {
    const snapshot=record.new_value?.snapshot;
    const text=snapshot?`ยื่นคำขอสลับกะวันที่ ${date(snapshot.source.work_date)} กับ ${snapshot.target.name} (${snapshot.source.shift_code} → ${snapshot.target.shift_code})`:record.action==='REQUEST_CANCELLED'?`ยกเลิกคำขอสลับกะวันที่ ${date(record.new_value.workDate)} · คำขอ #${record.entity_id}`:`${actions[record.action]} #${record.entity_id}`;
    rows.append(h('li',{class:'personal-history-row'},h('span',{class:'avatar'},actor.employeeCode?.split('-').at(-1)??actor.teamCode??'TNC'),h('div',{},h('p',{},h('strong',{},record.actor_name),' ',text),h('p',{class:'personal-history-time'},icon('history'),h('time',{datetime:record.created_at},`บันทึกเวลา: ${time(record.created_at)}`)))));
  }
  return h('div',{class:'view-stack'},h('section',{class:'panel personal-history'},h('div',{class:'panel-heading'},h('div',{},h('h1',{},'ประวัติการทำรายการของฉัน'),h('p',{class:'muted'},'รายการที่คุณทำจากบัญชีของคุณ เรียงจากล่าสุด'))),own.length?rows:h('div',{class:'empty'},h('h2',{},'ยังไม่มีประวัติการทำรายการ'),h('p',{class:'muted'},'เมื่อคุณยื่นคำขอ รายการและเวลาจะแสดงที่นี่'))));
}
