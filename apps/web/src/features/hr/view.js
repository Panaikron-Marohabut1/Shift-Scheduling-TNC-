import { h, icon } from '../../shared/dom.js';
import { roster, heading, section, dataTable, disabledButton, monthControl } from '../../shared/scheduling.js';
import { historyView } from '../history/view.js';

export function hrExportView(result,onMonth) {
  const people=roster(result.assignments),total=result.assignments.length;
  const facts=[['รายการกะที่เผยแพร่แล้ว',`${total} รายการ`,'นับรวมวันหยุดตามตาราง'],['ข้อมูล OT','—','รอเชื่อมข้อมูล'],['ส่งออกล่าสุด','—','ยังไม่เปิดส่งออก'],['สมาชิกกะ',`${people.length} คน`,'ข้อมูลสมมติจากตารางที่เผยแพร่']];
  const rows=h('tbody',{},...people.map(a=>h('tr',{},h('td',{},a.employee_code),h('td',{},h('strong',{},a.name)),h('td',{},a.team_name),h('td',{},a.position==='SUPERVISOR'?'หัวหน้าทีม':'พนักงานกะ'),h('td',{},`${result.assignments.filter(row=>row.employee_id===a.employee_id&&row.is_working).length} วัน`),h('td',{},h('span',{class:'pill approved'},'เผยแพร่แล้ว')))));
  if(!people.length)rows.append(h('tr',{},h('td',{colspan:'6',class:'table-empty'},'ยังไม่มีตารางที่เผยแพร่แล้วในเดือนนี้')));
  return h('div',{class:'view-stack hr-export-page'},heading('ข้อมูลและส่งออก CSV','อ่านข้อมูลที่เผยแพร่แล้ว · รูปแบบไฟล์และการคำนวณยังรอข้อมูลบริษัท',monthControl(result.month,onMonth)),
    h('div',{class:'metrics-grid'},...facts.map(([label,value,note])=>h('section',{class:'panel metric-card'},h('strong',{class:'metric-value'},value),h('h2',{},label),h('p',{class:'muted'},note)))),
    h('div',{class:'hr-columns'},section('ข้อมูลตารางกะที่เผยแพร่แล้ว','สรุปรายคนในชุดข้อมูลทดสอบ ยังไม่ใช้คำนวณ Payroll',dataTable(['รหัส','ชื่อ-นามสกุล','ทีม','บทบาท','วันทำงาน','สถานะ'],rows,'สรุปตารางกะที่เผยแพร่แล้ว')),
      section('ส่งออกไฟล์ข้อมูล (Export Center)','เตรียมกลุ่มข้อมูลตาม Prototype · ยังไม่เปิดดาวน์โหลด',h('div',{class:'panel-body export-list'},...[
        ['ตารางกะทั้ง 4 ทีมรายเดือน','Shift A / B / C / D · รูปแบบไฟล์รอยืนยัน'],['ประวัติการลา (Leave Records)','รอเชื่อมข้อมูลการลา'],['ประวัติการทำ OT (OT Records)','รอเชื่อมข้อมูลและหลักการคำนวณ OT']
      ].map(([label,description])=>h('div',{class:'export-row'},h('div',{},h('strong',{},label),h('p',{class:'muted'},description),h('span',{class:'pill neutral'},'รอเชื่อมข้อมูล')),disabledButton('ส่งออก CSV','ยังไม่เชื่อมการส่งออก','download')))))));
}
export function hrAuditView(records) {
  return h('div',{class:'view-stack'},heading('ตรวจสอบ OT และประวัติ','แยกข้อมูลที่รอเชื่อมออกจากประวัติที่บันทึกจริง'),section('ตรวจสอบชั่วโมง OT','ยังไม่เชื่อมข้อมูล OT และหลักการคำนวณบริษัท',h('div',{class:'panel-body'},h('div',{class:'export-row'},h('div',{},h('strong',{},'ชั่วโมง OT / สถานะตรวจสอบ'),h('p',{class:'muted'},'— / รอเชื่อมข้อมูล')),disabledButton('ตรวจสอบ OT','ยังไม่มีข้อมูล OT','check')))),h('p',{class:'muted'},'ประวัติด้านล่างแสดงเฉพาะรายการที่บัญชี HR นี้มีสิทธิ์ดู'),historyView(records));
}
