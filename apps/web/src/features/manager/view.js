/* ==========================================================================
   ผู้จัดการฝ่ายผลิต: พนักงานและทีม / ตารางรายปี (ประกาศใช้ทั้งปี) / ตั้งค่าระบบ
   --------------------------------------------------------------------------
   รายชื่อพนักงานมาจากฐานข้อมูล ส่วนการแก้ไขทั้งหมดในหน้านี้เป็น LOCAL (เก็บในเบราว์เซอร์)
   จนกว่าระบบหลังบ้านจะมี API: แก้ข้อมูลพนักงาน, ลำดับกะรายปี, วันหยุด, ประกาศใช้ทั้งปี, ค่าตั้งระบบ
   ========================================================================== */
import { state, DEMO_TODAY, saveLocal } from '../../app/state.js';
import { $, esc, js, icon, openModal, closeModal, showToast } from '../../shared/dom.js';
import {
  getAllEmployees, findEmployeeById, getShiftCodeForDate, getAnnualConfig, getHolidaysForYear, getTeamFamilyForYear, naturalFamily,
  ANNUAL_SCHEDULE_TEAMS, daysIn, thaiMonthName, hasScheduleDataForMonth, isYearPublished, dataMonth, pad2, clearPatternCache
} from '../../shared/scheduling.js';
import { pageHead, telOf } from '../schedule/view.js';
import { addLog, rebuildSchedule } from '../../app/data.js';

let rerender = () => {};
export function onManagerChange(fn) { rerender = fn; }
const changed = () => { saveLocal(); rerender(); };

/* ==========================================================================
   พนักงานและทีม
   ========================================================================== */
export function peopleHtml() {
  const teams = ['ALL', 'Shift A', 'Shift B', 'Shift C', 'Shift D'];
  const all = getAllEmployees();
  const term = state.employeeSearch.trim().toLowerCase();
  const list = all.filter(e => (state.employeeTeamFilter === 'ALL' || e.shiftType === state.employeeTeamFilter) && (!term || e.name.toLowerCase().includes(term) || e.id.toLowerCase().includes(term)));
  return `
    ${pageHead(`พนักงานและทีม <span class="count">${all.length}</span>`, '<button class="btn primary" data-click="openEmployeeForm()">เพิ่มพนักงาน</button>')}
    <div class="bar">
      <div class="seg" role="group" aria-label="ทีม">
        ${teams.map(t => `<button class="${state.employeeTeamFilter === t ? 'on' : ''}" aria-pressed="${state.employeeTeamFilter === t}" data-click="filterEmployeeTeam(${js(t)})">${t === 'ALL' ? 'ทั้งหมด' : `${t.replace('Shift ', '')} <span class="muted">${all.filter(e => e.shiftType === t).length}</span>`}</button>`).join('')}
      </div>
      <label class="sr" for="peopleQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" id="peopleQ" type="search" placeholder="ค้นหาชื่อหรือรหัส" value="${esc(state.employeeSearch)}" data-input="filterEmployeeSearch(this.value)" autocomplete="off">
    </div>
    ${list.length ? `
      <div class="panel flush tbl-wrap">
        <table class="tbl">
          <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ทีม</th><th>ตำแหน่ง</th><th>โทรศัพท์</th><th><span class="sr">แก้ไข</span></th></tr></thead>
          <tbody>
            ${list.map(e => `
              <tr>
                <td class="num muted">${esc(e.id)}</td>
                <th scope="row">${esc(e.name)}</th>
                <td>${esc(e.shiftType)}</td>
                <td>${esc(e.position || (e.roleCategory === 'Shift Supervisor' ? 'Shift Supervisor (S)' : 'Shift Operator'))}</td>
                <td>${telOf(e.phone)}</td>
                <td class="act"><button class="btn ghost sm" data-click="openEmployeeForm(${js(e.id)})">แก้ไข</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">ไม่พบพนักงานตามตัวกรอง</p>'}`;
}
export function filterEmployeeTeam(t) { state.employeeTeamFilter = t; rerender(); }
export function filterEmployeeSearch(v) { state.employeeSearch = v; rerender(); }

export function openEmployeeForm(employeeId = '') {
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  const sel = (cond) => (cond ? 'selected' : '');
  const body = `
    <form id="employeeForm" data-submit="saveEmployeeProfile(${js(employeeId)})">
      <div class="form-group">
        <label for="employeeCode">รหัสพนักงาน</label>
        <input id="employeeCode" class="form-control" value="${esc(employee ? employee.id : '')}" required ${employee ? 'disabled' : ''}>
      </div>
      <div class="form-group">
        <label for="employeeName">ชื่อ-นามสกุล</label>
        <input id="employeeName" class="form-control" value="${esc(employee ? employee.name : '')}" required>
      </div>
      <div class="form-2col">
        <div class="form-group">
          <label for="employeeTeam">ทีม</label>
          <select id="employeeTeam" class="form-control">
            ${['Shift A', 'Shift B', 'Shift C', 'Shift D'].map(t => `<option value="${t}" ${sel(employee && employee.shiftType === t)}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="employeeRole">โครงสร้างตำแหน่ง</label>
          <select id="employeeRole" class="form-control">
            <option value="Shift Supervisor (S)" ${sel(employee && (employee.position === 'Shift Supervisor (S)' || employee.roleCategory === 'Shift Supervisor'))}>หัวหน้ากะ (Shift Supervisor - S)</option>
            <option value="Boardman (DCS)" ${sel(employee && employee.position === 'Boardman (DCS)')}>พนักงานกะ: Boardman (DCS)</option>
            <option value="Field Operator" ${sel(!employee || (employee.position === 'Field Operator' || (!employee.position && employee.roleCategory !== 'Shift Supervisor')))}>พนักงานกะ: Field Operator</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="employeePhone">เบอร์ติดต่อ</label>
        <input id="employeePhone" class="form-control" value="${esc(employee && employee.phone !== '-' ? employee.phone : '')}" required>
      </div>
    </form>`;
  openModal(employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน', body, `
    <button class="btn btn-secondary" data-click="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" type="submit" form="employeeForm">บันทึกข้อมูล</button>`);
}
// LOCAL: แก้/เพิ่มพนักงานในเบราว์เซอร์ (ตอนต่อ API ให้ส่งไประบบหลังบ้านที่นี่)
export function saveEmployeeProfile(employeeId) {
  const code = ($('#employeeCode') || {}).value.trim();
  const name = ($('#employeeName') || {}).value.trim();
  const team = ($('#employeeTeam') || {}).value;
  const position = ($('#employeeRole') || {}).value;
  const phone = ($('#employeePhone') || {}).value.trim();
  if (!code || !name || !team || !position || !phone) { showToast('กรุณากรอกข้อมูลให้ครบ', 'alert'); return; }
  const roleCategory = position.includes('Supervisor') ? 'Shift Supervisor' : 'Shift Employee';
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  if (employee) {
    state.peopleEdits.byId[employee.id] = { ...(state.peopleEdits.byId[employee.id] || {}), name, phone, roleCategory, position, shiftType: team, initials: name.slice(0, 2) };
    const added = state.peopleEdits.added.find(e => e.id === employee.id);
    if (added) Object.assign(added, { name, phone, roleCategory, position, shiftType: team });
  } else {
    if (findEmployeeById(code)) { showToast('รหัสพนักงานนี้มีอยู่แล้ว', 'alert'); return; }
    state.peopleEdits.added.push({ id: code, code, name, phone, initials: name.slice(0, 2), roleCategory, position, shiftType: team });
  }
  closeModal();
  addLog(employee ? `แก้ไขข้อมูลพนักงาน ${name}` : `เพิ่มพนักงาน ${name} (${team})`);
  showToast(employee ? 'บันทึกข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว');
  rebuildSchedule();
  changed();
}

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
