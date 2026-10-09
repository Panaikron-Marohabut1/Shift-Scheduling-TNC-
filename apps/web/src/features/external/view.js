/* ==========================================================================
   ตารางรับส่งพนักงาน (ผู้ใช้ภายนอก / คนขับรถ)
   --------------------------------------------------------------------------
   LOCAL: รายชื่อจุดรับส่งเป็นข้อมูลตัวอย่าง และการกด "รับทราบ" เก็บในเบราว์เซอร์
   จนกว่าระบบหลังบ้านจะมี API ตารางรับส่ง (ไม่โหลดข้อมูลพนักงานภายในให้บัญชีภายนอก)
   ========================================================================== */

import { addLog } from '../../app/data.js';
import { saveLocal, state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { daysIn } from '../../shared/scheduling/dates.js';
import { showToast } from '../../shared/toast.js';
import { pageHead } from '../../shared/ui.js';

const ROWS = [
  ['Kanya Srisawat', 'กะเช้า', 'หัวหน้ากะ', 'ประตู 1', '06:30 น.'],
  ['Charuwan Kasaempan', 'กะเช้า', 'พนักงานกะ', 'หอพักพนักงาน A', '06:35 น.'],
  ['Thanakorn Chaiyawan', 'กะดึก', 'หัวหน้ากะ', 'ประตู 2', '18:15 น.'],
  ['Juladit Teekawiwat', 'กะดึก', 'พนักงานกะ', 'หอพักพนักงาน B', '18:25 น.']
];

export function driverHtml() {
  const d = new Date(state.currentYear, state.currentMonth, Math.min(state.currentDay, daysIn(state.currentYear, state.currentMonth)));
  return `
    ${pageHead('ตารางรับส่งพนักงาน', state.driverAcknowledged
      ? `<span class="st ok">ยืนยันแล้วเมื่อ ${esc(state.driverAckTime)}</span>`
      : '<button class="btn primary" data-click="acknowledgeDriverSchedule()">รับทราบและยืนยันตารางงาน</button>')}
    <div class="mstatus"><span class="st ok">ข้อมูลตารางรับส่งล่าสุด (อนุมัติแล้ว)</span><span class="muted">อัปเดตล่าสุด 08:42 น. · รอบกะเช้า 05:45 น. / รอบกะดึก 18:30 น.</span><span>สายหลัก (สาย A)</span></div>
    <section class="panel flush">
      <div class="panel-h pad"><h2>${esc(d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h2><span class="muted">รถตู้ทะเบียน ฮฮ-8899 กทม.</span></div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th class="num">ลำดับ</th><th>ชื่อ-นามสกุล</th><th>สังกัดกะ</th><th>บทบาท</th><th>จุดรับ-ส่ง</th><th>เวลานัดหมาย</th></tr></thead>
          <tbody>${ROWS.map((r, i) => `<tr><td class="num muted">${i + 1}</td><th scope="row">${esc(r[0])}</th><td><span class="sw"><i class="cd ${r[1] === 'กะเช้า' ? 'c-M' : 'c-N'}"></i>${esc(r[1])}</span></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td class="nowrap">${esc(r[4])}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </section>
    <p class="muted small driver-note">เมื่อกดยืนยัน ระบบจะบันทึกเวลาเพื่อให้หัวหน้ากะทราบว่าคนขับได้รับข้อมูลแล้ว</p>`;
}

let redraw = () => {};
export function onDriverChange(fn) { redraw = fn; }
export function acknowledgeDriverSchedule() {
  const now = new Date();
  state.driverAcknowledged = true;
  state.driverAckTime = `วันนี้ ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
  addLog('คนขับรถตู้สาย A รับทราบและยืนยันตารางรับส่งประจำวัน');
  saveLocal();
  showToast('รับทราบและยืนยันตารางงานเรียบร้อยแล้ว');
  redraw();
}
