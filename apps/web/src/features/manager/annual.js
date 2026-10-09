/* ==========================================================================
   ผู้จัดการ: ตารางรายปี (ทิศทางกะของทีม วันหยุดนักขัตฤกษ์ ประกาศใช้ / ยกเลิกการประกาศ)
   LOCAL: เก็บในเบราว์เซอร์จนกว่าระบบหลังบ้านจะมี API
   ========================================================================== */

import { addLog } from '../../app/data.js';
import { DEMO_TODAY, state } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { closeModal, openModal } from '../../shared/modal.js';
import { ANNUAL_SCHEDULE_TEAMS, getAnnualConfig, getTeamFamilyForYear, isYearPublished } from '../../shared/scheduling/annual.js';
import { daysIn, pad2, thaiMonthName } from '../../shared/scheduling/dates.js';
import { getAllEmployees } from '../../shared/scheduling/employees.js';
import { clearPatternCache, dataMonth, getShiftCodeForDate, hasScheduleDataForMonth, naturalFamily } from '../../shared/scheduling/roster.js';
import { showToast } from '../../shared/toast.js';
import { pageHead } from '../../shared/ui.js';
import { changed, rerender } from './refresh.js';

/* ==========================================================================
   ตารางรายปี และการประกาศใช้ทั้งปี
   ========================================================================== */
export function annualHtml() {
  const year = state.annualScheduleYear;
  const cfg = getAnnualConfig(year);
  const rep = {};
  ANNUAL_SCHEDULE_TEAMS.forEach(t => { rep[t] = getAllEmployees().find(e => e.shiftType === t && e.roleCategory !== 'Shift Supervisor') || getAllEmployees().find(e => e.shiftType === t); });
  const pub = isYearPublished(year);
  const base = dataMonth();
  return `
    ${pageHead('ตารางรายปี', `
      <button class="btn" data-click="SF.exportYear(${year})">${icon('export')} ส่งออกทั้งปี</button>
      ${pub ? `<button class="btn" data-click="SF.unpubAsk(${year})">ยกเลิกการประกาศ</button>` : `<button class="btn primary" data-click="SF.pubAsk(${year})">อนุมัติและประกาศใช้ทั้งปี ${year + 543}</button>`}`)}
    <div class="bar">
      <div class="mnav">
        <button class="sq" data-click="jumpAnnualYear(-1)" aria-label="ปีก่อนหน้า">${icon('left')}</button>
        <span class="mnav-label">ปี ${year} (พ.ศ. ${year + 543})</span>
        <button class="sq" data-click="jumpAnnualYear(1)" aria-label="ปีถัดไป">${icon('right')}</button>
      </div>
      ${year !== DEMO_TODAY.getFullYear() ? `<button class="btn ghost" data-click="jumpAnnualYearTo(${DEMO_TODAY.getFullYear()})">กลับไปปีปัจจุบัน</button>` : ''}
      <span class="st ${pub ? 'ok' : 'warn'}">${pub ? 'ประกาศใช้แล้ว' : 'ฉบับร่าง ยังไม่ประกาศใช้'}</span>
    </div>
    <p class="note ${pub ? '' : 'warn'}">${pub
      ? `ตารางกะปี ${year + 543} ประกาศใช้แล้ว หัวหน้ากะและพนักงานยื่นคำขอได้ตามปกติ ลำดับกะของทีมล็อกไว้ ถ้าจะเปลี่ยนต้องกด "ยกเลิกการประกาศ" ก่อน`
      : 'ตรวจลำดับกะของแต่ละทีมและวันหยุดนักขัตฤกษ์ให้เรียบร้อย แล้วกด "อนุมัติและประกาศใช้ทั้งปี" ระหว่างนี้คนอื่นเห็นเป็นฉบับร่าง ดูได้อย่างเดียว'}</p>
    <div class="cols2">
      <section class="panel">
        <div class="panel-h"><h2>ลำดับกะของแต่ละทีม</h2></div>
        <ul class="rows">
          ${ANNUAL_SCHEDULE_TEAMS.map(team => {
            const fam = getTeamFamilyForYear(team, year);
            const natural = fam === naturalFamily(team);
            return `<li>
              <span class="rows-l"><b>${esc(team)}</b><span class="muted">${getAllEmployees().filter(e => e.shiftType === team).length} คน${natural ? '' : ' · ปรับจากค่าเริ่มต้น'}</span></span>
              <div class="seg" role="group" aria-label="ลำดับกะ ${esc(team)}">
                <button class="${fam === 'M' ? 'on' : ''}" aria-pressed="${fam === 'M'}" ${pub ? 'disabled' : ''} data-click="updateAnnualTeamFamily(${year}, ${js(team)}, 'M')">เช้าก่อน</button>
                <button class="${fam === 'N' ? 'on' : ''}" aria-pressed="${fam === 'N'}" ${pub ? 'disabled' : ''} data-click="updateAnnualTeamFamily(${year}, ${js(team)}, 'N')">ดึกก่อน</button>
              </div>
            </li>`;
          }).join('')}
        </ul>
        <p class="muted small">การหมุนเวียน: กะที่เลือก 2 วัน → หยุด 2 วัน → อีกกะ 2 วัน → หยุด 2 วัน · ไม่เปลี่ยนตารางจริงในฐานข้อมูล (${esc(thaiMonthName(base.m, 'short'))} ${base.y + 543} เป็นต้นไป)</p>
      </section>
      <section class="panel">
        <div class="panel-h"><h2>วันหยุดนักขัตฤกษ์</h2><span class="muted">ปี ${year}</span></div>
        ${cfg.holidays.length ? `<ul class="rows">${cfg.holidays.map((h, i) => `<li><span class="rows-l"><b>${esc(h)}</b></span><button class="btn ghost sm" data-click="removeAnnualHoliday(${year}, ${i})">ลบ</button></li>`).join('')}</ul>` : '<p class="none">ยังไม่มีวันหยุดที่ตั้งค่าไว้</p>'}
        <div class="formrow">
          <div class="field grow"><label for="newHolidayInput">เพิ่มวันหยุด</label><input class="inp" id="newHolidayInput" placeholder="เช่น 01 ม.ค. ${year + 543}" data-keyup="holidayKey(event, ${year})"></div>
          <button class="btn primary" data-click="addAnnualHoliday(${year})">เพิ่ม</button>
        </div>
      </section>
    </div>
    <section class="panel flush">
      <div class="panel-h pad"><h2>ภาพรวมทั้งปี</h2><span class="muted small">จำนวนวันตามรูปแบบกะที่ตั้งไว้ · กด "ดูตาราง" เพื่อตรวจรายคนก่อนอนุมัติ</span></div>
      <div class="tbl-wrap">
        <table class="tbl year">
          <thead><tr><th>เดือน</th>${ANNUAL_SCHEDULE_TEAMS.map(t => `<th>${esc(t)}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${Array.from({ length: 12 }, (_, mi) => mi).map(mi => {
              const n = daysIn(year, mi);
              return `<tr><th scope="row">${esc(thaiMonthName(mi, 'long'))}</th>${ANNUAL_SCHEDULE_TEAMS.map(team => {
                const e = rep[team];
                if (!e) return '<td></td>';
                let mo = 0, ni = 0, off = 0;
                for (let d = 1; d <= n; d++) {
                  const c = getShiftCodeForDate(e, year, mi, d), def = state.shiftDefs[c];
                  if (c === 'O') off++; else if (def && def.family === 'M') mo++; else if (def && def.family === 'N') ni++;
                  else if (def && def.family === 'swap') { const f = (state.shiftDefs[String(c).split('/')[0]] || {}).family; if (f === 'M') mo++; else if (f === 'N') ni++; else off++; }
                }
                return `<td><span class="yr"><i class="cd c-M"></i>${mo}</span><span class="yr"><i class="cd c-N"></i>${ni}</span><span class="yr muted">หยุด ${off}</span></td>`;
              }).join('')}<td><span class="yr-act">${hasScheduleDataForMonth(year, mi) ? '<span class="st ok">ข้อมูลจริง</span>' : ''}<button class="btn sm" data-click="SF.monthOf(${year}, ${mi})">ดูตาราง</button></span></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}
export function jumpAnnualYear(delta) { state.annualScheduleYear += delta; rerender(); }
export function jumpAnnualYearTo(y) { state.annualScheduleYear = Number(y); rerender(); }
export function updateAnnualTeamFamily(year, team, value) {
  if (isYearPublished(year)) { showToast(`ตารางปี ${year + 543} ประกาศใช้แล้ว ต้องยกเลิกการประกาศก่อนจึงเปลี่ยนลำดับกะได้`, 'alert'); return; }
  getAnnualConfig(year).teamFamily[team] = value;
  clearPatternCache();
  addLog(`ตั้งลำดับกะ ${team} ปี ${year + 543} เป็น${value === 'M' ? 'เช้าก่อน' : 'ดึกก่อน'}`);
  showToast(`อัปเดตทิศทางกะของ ${team} ปี ${year} เรียบร้อยแล้ว`);
  changed();
}
export function addAnnualHoliday(year) {
  const input = $('#newHolidayInput');
  const value = input && input.value.trim();
  if (!value) { showToast('กรุณาระบุชื่อ/วันที่วันหยุด', 'alert'); return; }
  getAnnualConfig(year).holidays.push(value);
  addLog(`เพิ่มวันหยุดนักขัตฤกษ์ ${value}`);
  showToast('เพิ่มวันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
  changed();
}
export function holidayKey(ev, year) { if (ev && ev.key === 'Enter') addAnnualHoliday(year); }
export function removeAnnualHoliday(year, index) {
  const [gone] = getAnnualConfig(year).holidays.splice(index, 1);
  addLog(`ลบวันหยุดนักขัตฤกษ์ ${gone || ''}`);
  showToast('ลบวันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
  changed();
}

export function pubAsk(y) {
  openModal(`อนุมัติตารางกะปี ${y + 543}`, `<p>ประกาศใช้ตารางกะทั้งปี ${y + 543} (ม.ค.–ธ.ค.) หลังประกาศ หัวหน้ากะและพนักงานยื่นคำขอสลับกะ เปลี่ยนกะ ลา OT ได้ตามปกติ</p><p>ลำดับกะของแต่ละทีมจะล็อกไว้ ถ้าต้องเปลี่ยนภายหลังต้องยกเลิกการประกาศก่อน</p>${getAnnualConfig(y).holidays.length ? '' : `<p class="note warn">ปี ${y + 543} ยังไม่ได้ใส่วันหยุดนักขัตฤกษ์ เพิ่มได้ในหน้า "ตารางรายปี" ทั้งก่อนและหลังประกาศ</p>`}`,
    `<button class="btn" data-click="closeModal()">ยกเลิก</button><button class="btn primary" data-click="SF.pub(${y})">อนุมัติและประกาศใช้</button>`);
}
export function publishYear(y) {
  closeModal();
  if (state.activeRole !== 'Manager') { showToast('ผู้จัดการเท่านั้นที่ประกาศใช้ตารางกะได้', 'alert'); return; }
  if (isYearPublished(y)) { showToast(`ตารางกะปี ${y + 543} ประกาศใช้แล้ว`); return; }
  for (let m = 0; m < 12; m++) { const k = `${y}-${pad2(m + 1)}`; if (state.publishedMonths.indexOf(k) < 0) state.publishedMonths.push(k); }
  addLog(`อนุมัติและประกาศใช้ตารางกะทั้งปี ${y + 543}`);
  showToast(`ประกาศใช้ตารางกะปี ${y + 543} แล้ว ทุกคนเริ่มใช้งานได้`);
  changed();
}
export function unpubAsk(y) {
  openModal(`ยกเลิกการประกาศปี ${y + 543}`, `<p>ตารางกะปี ${y + 543} จะกลับเป็นฉบับร่าง ระหว่างนี้หัวหน้ากะและพนักงานจะยื่นคำขอในปีนี้ไม่ได้ จนกว่าจะประกาศใช้อีกครั้ง</p><p>คำขอที่อนุมัติไปแล้วยังอยู่ครบ</p>`,
    `<button class="btn" data-click="closeModal()">ไม่ยกเลิก</button><button class="btn danger" data-click="SF.unpub(${y})">ยกเลิกการประกาศ</button>`);
}
export function unpublishYear(y) {
  closeModal();
  if (state.activeRole !== 'Manager') { showToast('ผู้จัดการเท่านั้นที่ยกเลิกการประกาศได้', 'alert'); return; }
  state.publishedMonths = state.publishedMonths.filter(k => k.indexOf(`${y}-`) !== 0);
  addLog(`ยกเลิกการประกาศตารางกะปี ${y + 543} (กลับเป็นฉบับร่าง)`);
  showToast(`ตารางกะปี ${y + 543} กลับเป็นฉบับร่างแล้ว`);
  changed();
}
