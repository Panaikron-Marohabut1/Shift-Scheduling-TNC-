import { h, date, icon } from '../../shared/dom.js';
import { disabledButton, section, dataTable } from '../../shared/scheduling.js';
export function driverView() {
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
  return h('div',{class:'view-stack driver-page'},h('h1',{class:'sr-only'},'ตารางรับส่งพนักงานวันนี้'),
    h('div',{class:'transport-notice'},h('span',{class:'action-icon'},icon('truck')),h('div',{},h('strong',{},'ตารางรับส่งประจำวัน'),h('p',{},'ยังไม่เชื่อมข้อมูลรถ เส้นทาง และรายชื่อรับส่ง')),h('span',{class:'pill neutral'},'รอเชื่อมข้อมูล')),
    section('รายชื่อพนักงานและจุดรับส่งวันนี้ (แยกตามกะ)',`${date(today)} · รถทะเบียน — · เส้นทาง —`,
      dataTable(['ลำดับ','ชื่อ-นามสกุล','สังกัดกะ','บทบาท','จุดรับ-ส่ง','เวลานัดหมาย'],h('tbody'),'รายการรับส่งประจำวัน'),
      h('div',{class:'transport-empty'},h('span',{class:'transport-empty-icon'},icon('truck')),h('strong',{},'ยังไม่มีข้อมูลรับส่ง'),h('p',{class:'muted'},'รายชื่อ จุดรับส่ง และเวลานัดหมายจะปรากฏเมื่อเชื่อมข้อมูลที่ได้รับอนุญาต')),
      h('div',{class:'driver-ack'},h('div',{},h('strong',{},'ยืนยันการรับทราบตารางรับส่งประจำวัน'),h('p',{class:'muted'},'การยืนยันยังไม่เปิดใช้งานจนกว่าจะเชื่อมข้อมูลรับส่ง')),disabledButton('รับทราบและยืนยันตารางงาน','ยังไม่เปิดการยืนยันรับทราบ','check'))),h('p',{class:'policy-note'},'บัญชี External ใช้เฉพาะหน้ารับส่งที่เตรียมไว้ ข้อมูลพนักงานภายในไม่ได้ถูกโหลดในหน้านี้'));
}
