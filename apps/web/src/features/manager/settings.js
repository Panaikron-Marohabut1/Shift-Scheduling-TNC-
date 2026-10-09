/* ==========================================================================
   ผู้จัดการ: ตั้งค่าระบบ (เวลากะ จำนวนคนมาตรฐาน สิทธิ์สลับกะต่อเดือน วันทำงานต่อเนื่องสูงสุด)
   LOCAL: เก็บในเบราว์เซอร์จนกว่าระบบหลังบ้านจะมี API
   ========================================================================== */

import { addLog } from '../../app/data.js';
import { saveLocal, state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { getHolidaysForYear } from '../../shared/scheduling/annual.js';
import { showToast } from '../../shared/toast.js';
import { pageHead } from '../../shared/ui.js';
import { changed, rerender } from './refresh.js';

/* ==========================================================================
   ตั้งค่าระบบ — บันทึกทันทีเมื่อเปลี่ยนค่า
   ========================================================================== */
export function settingsHtml() {
  const cfg = state.managerConfig;
  const hol = getHolidaysForYear(state.currentYear);
  return `
    ${pageHead('ตั้งค่าระบบ')}
    <div class="cols2">
      <section class="panel">
        <div class="panel-h"><h2>ช่วงเวลากะ</h2><span class="muted small">บันทึกทันทีเมื่อแก้ไข</span></div>
        <div class="fields">
          ${Object.keys(cfg.shiftTimes).map(code => `
            <div class="field"><label for="set-${code}">${esc(code)} · ${esc((state.shiftDefs[code] || {}).label || '')}</label>
              <input class="inp" id="set-${code}" value="${esc(cfg.shiftTimes[code])}" data-change="updateManagerShiftTime(${js(code)}, this.value)"></div>`).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-h"><h2>กฎการทำงานและคำขอ</h2></div>
        <ul class="rows">
          <li><span class="rows-l"><b>วันทำงานติดต่อกันสูงสุด</b><span class="muted small">นับรวมกะปกติ, OT และการสลับกะ</span></span>
            <span class="numfield"><input class="inp" id="set-max" type="number" value="${cfg.maxConsecutiveWorkDays}" data-change="updateManagerRule('maxConsecutiveWorkDays', this.value)"> วัน</span></li>
          <li><span class="rows-l"><b>คำขอสลับ/เปลี่ยนกะต่อเดือน</b><span class="muted small">จำนวนครั้งสูงสุดต่อพนักงาน</span></span>
            <span class="numfield"><input class="inp" id="set-swap" type="number" value="${cfg.swapRequestMonthlyLimit}" data-change="updateManagerRule('swapRequestMonthlyLimit', this.value)"> ครั้ง</span></li>
        </ul>
      </section>
    </div>
    <section class="panel">
      <div class="panel-h"><h2>ข้อมูลและทางลัด</h2></div>
      <ul class="rows">
        <li><span class="rows-l"><b>โครงสร้างตำแหน่งในแต่ละกะ (${cfg.standardHeadcount.supervisor + cfg.standardHeadcount.operator} ตำแหน่งต่อกะ)</b><span class="muted small">หัวหน้ากะ (Shift Supervisor - S) ${cfg.standardHeadcount.supervisor} ตำแหน่ง · พนักงานกะ (Shift Operator) ${cfg.standardHeadcount.operator} ตำแหน่ง (Boardman ดูแลระบบ DCS / Field Operator ดูแลเครื่องจักร)</span></span></li>
        <li><span class="rows-l"><b>วันหยุดนักขัตฤกษ์ · ปี ${state.currentYear}</b><span class="muted small">${hol.length ? `ตั้งค่าไว้ ${hol.length} วัน` : 'ยังไม่มีวันที่ตั้งค่าไว้'}</span></span><button class="btn sm" data-click="switchView('annual-schedule')">จัดการตารางรายปี</button></li>
        <li><span class="rows-l"><b>พนักงานและทีม</b><span class="muted small">จัดการรายชื่อและทีมกะ</span></span><button class="btn sm" data-click="switchView('people')">เปิดหน้าจัดการ</button></li>
      </ul>
    </section>`;
}
export function updateManagerShiftTime(code, value) {
  state.managerConfig.shiftTimes[code] = value;
  addLog(`แก้ไขช่วงเวลากะ ${code} เป็น ${value}`);
  showToast(`อัปเดตช่วงเวลากะ ${code} เรียบร้อยแล้ว`);
  saveLocal();
}
export function updateManagerRule(key, rawValue) {
  const value = parseInt(rawValue, 10);
  if (Number.isNaN(value) || value <= 0) { showToast('กรุณาระบุตัวเลขที่มากกว่า 0', 'alert'); rerender(); return; }
  state.managerConfig[key] = value;
  addLog(`แก้ไขค่า${key === 'maxConsecutiveWorkDays' ? 'วันทำงานติดต่อกันสูงสุด' : 'คำขอสลับ/เปลี่ยนกะต่อเดือน'} เป็น ${value}`);
  showToast('บันทึกค่าคอนฟิกเรียบร้อยแล้ว');
  changed();
}
