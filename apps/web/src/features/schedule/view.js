/* ==========================================================================
   ตารางกะ (หัวหน้ากะ / พนักงาน / ฝ่ายบุคคล / ผู้จัดการ) — รายเดือนแบบ Excel และรายวัน
   ========================================================================== */
import { state, view, DEMO_TODAY } from '../../app/state.js';
import { esc, js, icon, openModal } from '../../shared/dom.js';
import {
  TH_DW, daysIn, monthLabel, thaiMonthName, getAllEmployees, getShiftCodeForDate, hasScheduleDataForMonth, isMonthLocked,
  isYearPublished, holidayDates, currentEmp, isSupervisorRoleName, dataMonth, getEmployeeFacingShiftLabel
} from '../../shared/scheduling.js';

/* ---------- รหัสกะ → สี ---------- */
export function shownCode(code) { const parts = String(code).split('/'); return parts.length === 2 ? parts[0] : String(code); }
export function codeClass(code) {
  const parts = String(code).split('/');
  const def = state.shiftDefs[code] || {};
  const first = state.shiftDefs[parts[0]] || {};
  let fam = 'O';
  if (code === 'H') fam = 'H';
  else if (def.family === 'leave' || first.family === 'leave') fam = 'L';
  else if (first.family === 'OT') fam = 'X';
  else if (['M', 'N', 'D', 'O'].includes(first.family)) fam = first.family;
  let c = `c-${fam}`;
  if (def.ot || first.ot) c += def.half || first.half ? ' is-ot is-half' : ' is-ot';
  if (shownCode(code).length > 3) c += ' is-long';
  return c;
}
export const famOf = code => codeClass(code).split(' ')[0];
export const cellText = code => (code === 'O' ? '<span class="off">·</span>' : esc(shownCode(code)));
export const swatch = code => `<span class="sw"><i class="cd ${famOf(code)}"></i>${esc(code)}</span>`;
// มีการเปลี่ยนจากตารางเดิมหรือไม่: รหัสสลับ หรือช่องที่ถูกแก้/ได้จากคำขอที่อนุมัติ
export function changeNote(emp, y, m, d, code) {
  const parts = String(code).split('/');
  if (parts.length === 2) return `เปลี่ยนจาก${getEmployeeFacingShiftLabel(parts[1])} (${parts[1]}) เป็น${getEmployeeFacingShiftLabel(parts[0])} (${parts[0]})`;
  if (parts.length > 2) return `ปรับกะหลายขั้น (${code})`;
  const ov = state.scheduleOverrides[`${y}-${m}`];
  if (ov && ov[emp.id] && ov[emp.id][d] !== undefined) return 'เปลี่ยนจากตารางเดิมตามคำขอที่อนุมัติแล้ว';
  return '';
}

export function pageHead(title, right) { return `<div class="phead"><h1>${title}</h1>${right ? `<div class="phead-r">${right}</div>` : ''}</div>`; }
export function holidaysOf(y) { return holidayDates(y); }
export function isToday(y, m, d) { return d === DEMO_TODAY.getDate() && m === DEMO_TODAY.getMonth() && y === DEMO_TODAY.getFullYear(); }
export function dayClass(y, m, d, hol) {
  const w = new Date(y, m, d).getDay();
  const c = [];
  if (hol[`${m}-${d}`]) c.push('hol');
  else if (w === 0 || w === 6) c.push('we');
  if (w === 1 && d > 1) c.push('wk');
  if (isToday(y, m, d)) c.push('tdy');
  return c.join(' ');
}
export function draftNote(y) {
  return state.activeRole === 'Manager'
    ? `ตารางกะปี ${y + 543} ยังเป็นฉบับร่าง คนอื่นดูได้อย่างเดียว ตรวจลำดับกะและวันหยุดในหน้า "ตารางรายปี" แล้วกด "อนุมัติและประกาศใช้ทั้งปี" เพื่อให้หัวหน้ากะและพนักงานเริ่มใช้งาน`
    : `ตารางกะปี ${y + 543} ยังไม่ประกาศใช้ (ฉบับร่าง รอผู้จัดการอนุมัติ) ดูได้อย่างเดียว ยังยื่นคำขอไม่ได้`;
}
export const telOf = phone => (String(phone || '').replace(/\D/g, '')
  ? `<a class="tel" href="tel:${esc(String(phone).replace(/\D/g, ''))}">${esc(phone)}</a>`
  : `<span class="tel">${esc(phone || '-')}</span>`);

export function monthNav(withPicker) {
  const y = state.currentYear, m = state.currentMonth;
  const base = dataMonth();
  return `
    <div class="mnav">
      <button class="sq" data-click="changeScheduleMonth(-1)" aria-label="เดือนก่อนหน้า">${icon('left')}</button>
      ${withPicker ? `<button class="mnav-label" data-click="toggleMonthPicker()" aria-expanded="${!!state.monthPickerOpen}">${esc(monthLabel(y, m))}</button>` : `<span class="mnav-label">${esc(monthLabel(y, m))}</span>`}
      <button class="sq" data-click="changeScheduleMonth(1)" aria-label="เดือนถัดไป">${icon('right')}</button>
      ${withPicker && state.monthPickerOpen ? `
        <div class="mpick-bg" data-click="toggleMonthPicker(false)"></div>
        <div class="mpick" role="dialog" aria-label="เลือกเดือน">
          <div class="mpick-year">
            <button class="sq" data-click="jumpToScheduleMonth(${y - 1}, ${m})" aria-label="ปีก่อนหน้า">${icon('left')}</button>
            <b>${y + 543}</b>
            <button class="sq" data-click="jumpToScheduleMonth(${y + 1}, ${m})" aria-label="ปีถัดไป">${icon('right')}</button>
          </div>
          <div class="mpick-grid">
            ${Array.from({ length: 12 }, (_, i) => `<button class="${i === m ? 'on' : ''} ${hasScheduleDataForMonth(y, i) ? 'has' : ''}" data-click="jumpToScheduleMonth(${y}, ${i})" title="${hasScheduleDataForMonth(y, i) ? 'มีข้อมูลตารางกะจริง' : 'ยังไม่มีข้อมูล'}">${esc(thaiMonthName(i, 'short'))}</button>`).join('')}
          </div>
          <button class="link mpick-go" data-click="jumpToScheduleMonth(${base.y}, ${base.m})">ไปเดือนที่มีข้อมูลจริง (${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543})</button>
        </div>` : ''}
    </div>`;
}

export function scheduleState() {
  const y = state.currentYear, m = state.currentMonth;
  const monthLocked = isMonthLocked(y, m);
  const readOnly = state.activeRole === 'HR';
  const published = isYearPublished(y);
  return {
    y, m, n: daysIn(y, m), monthLocked, readOnly, published,
    hasData: hasScheduleDataForMonth(y, m),
    canPublish: state.activeRole === 'Manager' && !published,
    canExport: state.activeRole === 'Manager' || state.activeRole === 'HR',
    canInteract: !monthLocked && !readOnly && published,
    viewer: (isSupervisorRoleName(state.activeRole) || state.activeRole === 'Shift Employee') ? currentEmp() : null,
    hol: holidaysOf(y)
  };
}
// สถานะของเดือน (ใช้ร่วมกันระหว่างตารางกะและกะของฉัน)
export function statusChips(S) {
  const status = [];
  status.push(S.published ? `<span class="st ok">ประกาศใช้แล้ว ปี ${S.y + 543}</span>` : `<span class="st warn">ฉบับร่าง ปี ${S.y + 543} ยังไม่ประกาศใช้</span>`);
  if (!S.hasData) status.push('<span class="st warn">ตารางคาดการณ์ ยังไม่มีข้อมูลจริง</span>');
  if (S.readOnly) status.push('<span class="st">ดูข้อมูลอย่างเดียว</span>');
  else if (S.monthLocked) status.push('<span class="st">ข้อมูลถูกล็อก</span>');
  else if (S.published) status.push('<span class="st ok">ยื่นคำขอได้</span>');
  return status.join('');
}
export function teamSections() {
  const map = { A: 'shiftA', B: 'shiftB', C: 'shiftC', D: 'shiftD' };
  return Object.keys(map).filter(k => state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === k).map(k => state.shiftsData[map[k]]);
}
const matchQ = e => { const q = view.q.trim().toLowerCase(); return !q || e.name.toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q); };

export function scheduleHtml() {
  const S = scheduleState();
  const base = dataMonth();
  const right = [];
  if (state.activeRole === 'Manager') right.push(`<button class="btn ghost" data-click="SF.toAnnual(${S.y})">${icon('left')} ตารางรายปี</button>`);
  if (S.canExport) right.push(`<button class="btn" data-click="SF.exportYear(${S.y})">${icon('export')} ส่งออกทั้งปี ${S.y + 543}</button>`);
  if (S.canPublish) right.push(`<button class="btn primary" data-click="SF.pubAsk(${S.y})">อนุมัติและประกาศใช้ทั้งปี ${S.y + 543}</button>`);
  return `
    ${pageHead('ตารางกะ', right.join(''))}
    <div class="bar">
      ${view.mode === 'month' ? monthNav(true) : dayNav(S)}
      <button class="btn ghost" data-click="SF.today()">วันนี้</button>
      <div class="seg" role="group" aria-label="มุมมอง">
        <button class="${view.mode === 'month' ? 'on' : ''}" aria-pressed="${view.mode === 'month'}" data-click="SF.mode('month')">รายเดือน</button>
        <button class="${view.mode === 'day' ? 'on' : ''}" aria-pressed="${view.mode === 'day'}" data-click="SF.mode('day')">รายวัน</button>
      </div>
      <div class="seg" role="group" aria-label="ทีม">
        ${['ALL', 'A', 'B', 'C', 'D'].map(t => `<button class="${state.selectedShiftFilter === t ? 'on' : ''}" aria-pressed="${state.selectedShiftFilter === t}" data-click="filterScheduleShiftType(${js(t)})">${t === 'ALL' ? 'ทุกทีม' : t}</button>`).join('')}
      </div>
      <label class="sr" for="schedQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" id="schedQ" type="search" placeholder="ค้นหาชื่อ" value="${esc(view.q)}" data-input="SF.search(this.value)" autocomplete="off">
    </div>
    ${view.mode === 'month' ? `
      <div class="mstatus">${statusChips(S)}</div>
      ${!S.published ? `<p class="note warn proj-note">${draftNote(S.y)}</p>` : !S.hasData ? `<p class="note warn proj-note">${esc(monthLabel(S.y, S.m))} ยังไม่มีตารางกะจริง ระบบคาดการณ์จากรอบ 2 วันสลับ 2 วันของเดือน${esc(thaiMonthName(base.m, 'long'))} ${base.y + 543} ${S.monthLocked ? 'เดือนนี้ถูกล็อก ดูได้อย่างเดียว' : 'กดช่องกะเพื่อยื่นคำขอได้ตามปกติ'}</p>` : ''}
      ${gridHtml(S)}
      ${legendHtml()}` : dayViewHtml(S)}`;
}

function gridHtml(S) {
  const { y, m, n, hol } = S;
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const cls = days.map(d => dayClass(y, m, d, hol));
  const head = days.map((d, i) => `<th class="${cls[i]}" ${hol[`${m}-${d}`] ? `title="${esc(hol[`${m}-${d}`])}"` : ''}><span>${TH_DW[new Date(y, m, d).getDay()]}</span><b>${d}</b></th>`).join('');
  let shown = 0;
  const body = teamSections().map(sec => {
    const list = sec.employees.filter(matchQ);
    if (!list.length) return '';
    shown += list.length;
    return `
    <tr class="team"><th class="nm" scope="rowgroup">${esc(sec.name.replace(/"/g, ''))}</th><td colspan="${n + 3}" class="team-note">${esc(sec.thaiName)} · ${sec.employees.length} ตำแหน่ง</td></tr>
    ${list.map(emp => {
      const isSup = emp.id === sec.supervisorId || emp.roleCategory === 'Shift Supervisor';
      const codes = days.map(d => getShiftCodeForDate(emp, y, m, d));
      const sum = { work: 0, ot: 0, leave: 0 };
      codes.forEach(c => { const def = state.shiftDefs[c] || {}; if (c === 'O') return; if (def.leave) sum.leave += def.half ? 0.5 : 1; else { sum.work++; if (def.ot) sum.ot++; } });
      const me = S.viewer && S.viewer.id === emp.id;
      return `
        <tr class="${me ? 'me' : ''}">
          <th class="nm" scope="row"><div class="nm-in"><span class="name">${esc(emp.name)}</span>${me ? '<span class="you">คุณ</span>' : ''}${isSup ? '<span class="tag" title="หัวหน้ากะ">S</span>' : ''}</div></th>
          ${codes.map((code, i) => {
            const d = i + 1, def = state.shiftDefs[code] || state.shiftDefs.O;
            const chg = changeNote(emp, y, m, d, code);
            const tip = `${emp.name} ${d} ${thaiMonthName(m, 'short')} · ${def.label}${chg ? ` · ${chg}` : ''}${hol[`${m}-${d}`] ? ` · ${hol[`${m}-${d}`]}` : ''}${!S.hasData ? ' · คาดการณ์' : ''}`;
            return `<td class="${codeClass(code)} ${chg ? 'chg' : ''} ${cls[i]} ${!S.hasData ? 'proj' : ''}"><button data-click="SF.cell(${js(emp.id)}, ${d})" title="${esc(tip)}">${cellText(code)}</button></td>`;
          }).join('')}
          <td class="sm">${sum.work}</td><td class="sm">${sum.ot || ''}</td><td class="sm">${sum.leave || ''}</td>
        </tr>`;
    }).join('')}`;
  }).join('');
  if (!shown) return '<p class="empty">ไม่พบพนักงาน</p>';
  const all = getAllEmployees();
  const count = fam => days.map(d => all.filter(e => famOf(getShiftCodeForDate(e, y, m, d)) === fam).length);
  const cm = count('c-M'), cn = count('c-N');
  return `
    <div class="grid-wrap" data-scroll="grid">
      <table class="roster">
        <thead><tr><th class="nm" scope="col">พนักงาน</th>${head}<th class="sm" scope="col" title="วันเข้างาน">ทำงาน</th><th class="sm" scope="col">OT</th><th class="sm" scope="col">ลา</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr class="cnt r1"><th class="nm" scope="row">คนเข้ากะเช้า</th>${cm.map((v, i) => `<td class="${cls[i]}">${v}</td>`).join('')}<td colspan="3"></td></tr>
          <tr class="cnt r2"><th class="nm" scope="row">คนเข้ากะดึก</th>${cn.map((v, i) => `<td class="${cls[i]}">${v}</td>`).join('')}<td colspan="3"></td></tr>
        </tfoot>
      </table>
    </div>`;
}

function legendHtml() {
  const item = (cls, label) => `<span><i class="cd ${cls}"></i>${label}</span>`;
  return `
    <div class="legend">
      ${item('c-M', 'กะเช้า')}${item('c-N', 'กะดึก')}${item('c-D', 'เวลาทำการปกติ')}${item('c-L', 'ลา')}${item('c-H', 'ใช้สิทธิ์นักขัตฤกษ์ (H)')}${item('c-X', 'OT เพิ่มเติม')}
      <span><i class="mk-ot"></i>มี OT</span>
      <span><i class="mk-corner"></i>มุมแดง = เปลี่ยนจากตารางเดิม</span>
      <span><i class="lg-day we"></i>เสาร์-อาทิตย์</span>
      <span><i class="lg-day hol"></i>วันหยุดนักขัตฤกษ์</span>
      <button class="link" data-click="SF.codes()">ดูรหัสกะทั้งหมด</button>
    </div>`;
}

export function codesModal() {
  openModal('ความหมายรหัสกะ', `
    <table class="tbl codes">
      <thead><tr><th>รหัส</th><th>ความหมาย</th><th>เวลา</th></tr></thead>
      <tbody>${Object.keys(state.shiftDefs).map(c => `<tr><td>${swatch(c)}</td><td>${esc(state.shiftDefs[c].label)}</td><td>${esc(state.shiftDefs[c].time)}</td></tr>`).join('')}</tbody>
    </table>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
}

/* ---------- รายวัน: ใครเข้ากะไหนในวันนั้น ---------- */
function dayNav(S) {
  const { y, m, n } = S;
  const d0 = Math.min(view.day, n);
  const days = [-3, -2, -1, 0, 1, 2, 3].map(k => d0 + k).filter(d => d >= 1 && d <= n);
  return `
    <div class="dnav">
      <button class="sq" data-click="SF.dayStep(-1)" aria-label="วันก่อนหน้า">${icon('left')}</button>
      <div class="dnav-days">
        ${days.map(d => `<button class="${d === d0 ? 'on' : ''} ${isToday(y, m, d) ? 'tdy' : ''} ${dayClass(y, m, d, S.hol).includes('hol') ? 'hol' : dayClass(y, m, d, S.hol).includes('we') ? 'we' : ''}" data-click="SF.pickDay(${d})"><span>${TH_DW[new Date(y, m, d).getDay()]}</span><b>${d}</b></button>`).join('')}
      </div>
      <button class="sq" data-click="SF.dayStep(1)" aria-label="วันถัดไป">${icon('right')}</button>
    </div>`;
}
function dayViewHtml(S) {
  const { y, m, n, hol } = S;
  const d = Math.min(view.day, n);
  const dt = new Date(y, m, d);
  const groups = { 'c-M': [], 'c-N': [], 'c-D': [], 'c-X': [], 'c-L': [], 'c-O': [] };
  const people = teamSections().reduce((a, s) => a.concat(s.employees), []).filter(matchQ);
  people.forEach(e => {
    const c = getShiftCodeForDate(e, y, m, d);
    let f = famOf(c);
    if (f === 'c-H') f = 'c-L';
    const def = state.shiftDefs[c] || {};
    const note = c === 'O' ? '' : `${c}${def.ot ? ' · OT' : ''}`;
    (groups[f] || groups['c-O']).push({ e, note, c });
  });
  const t = state.managerConfig.shiftTimes;
  const col = (key, title, time) => `
    <section class="daycol">
      <header><i class="cd ${key}"></i><h3>${title}</h3>${time ? `<span class="t">${esc(time)}</span>` : ''}<b>${groups[key].length}</b></header>
      ${groups[key].length ? `<ul class="plist">${groups[key].map(x => `
        <li class="${S.viewer && S.viewer.id === x.e.id ? 'me' : ''}">
          <button class="prow" data-click="SF.cell(${js(x.e.id)}, ${d})">
            <span class="pname">${esc(x.e.name)}${S.viewer && S.viewer.id === x.e.id ? ' <span class="you">คุณ</span>' : ''}${x.e.roleCategory === 'Shift Supervisor' ? ' <span class="tag" title="หัวหน้ากะ">S</span>' : ''}</span>
            <span class="pmeta">${esc(x.e.shiftType)}${x.note && key !== 'c-O' ? `<em>${esc(x.note)}</em>` : ''}</span>
          </button>
          ${telOf(x.e.phone)}
        </li>`).join('')}</ul>` : '<p class="none">ไม่มี</p>'}
    </section>`;
  return `
    <div class="daytitle">
      <h2>${esc(dt.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h2>
      ${isToday(y, m, d) ? '<span class="st ok">วันนี้</span>' : ''}
      ${hol[`${m}-${d}`] ? `<span class="st bad">${esc(hol[`${m}-${d}`])}</span>` : ''}
      ${!S.hasData ? '<span class="st warn">ตารางคาดการณ์</span>' : ''}
    </div>
    <div class="daycols">
      ${col('c-M', 'กะเช้า', (t.M || '').split(' ')[0])}
      ${col('c-N', 'กะดึก', (t.N || '').split(' ')[0])}
      ${groups['c-D'].length ? col('c-D', 'เวลาทำการปกติ', (t.D || '').split(' ')[0]) : ''}
      ${groups['c-X'].length ? col('c-X', 'OT เพิ่มเติม', '') : ''}
      ${col('c-L', 'ลา', '')}
      ${col('c-O', 'หยุด', '')}
    </div>`;
}
