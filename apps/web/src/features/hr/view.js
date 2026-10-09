/* ==========================================================================
   ข้อมูลและส่งออก CSV (ฝ่ายบุคคล) — สรุปรายคนรายเดือน และไฟล์ส่งออก 4 แบบ
   ไฟล์ส่งออกสร้างในเบราว์เซอร์จากข้อมูลที่แสดงอยู่ (ตารางจริง + รายการที่อนุมัติ)
   ========================================================================== */
import { state } from '../../app/state.js';
import { esc, icon, showToast } from '../../shared/dom.js';
import { daysIn, getAllEmployees, getShiftCodeForDate, TEAM_KEYS, isYearPublished, thaiMonthName, holidayDates } from '../../shared/scheduling.js';
import { pageHead, monthNav, famOf } from '../schedule/view.js';
import { addLog, nowText } from '../../app/data.js';

export function hrHtml() {
  const all = getAllEmployees();
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const otPeople = all.filter(e => Array.from({ length: n }, (_, i) => getShiftCodeForDate(e, y, m, i + 1)).some(c => state.shiftDefs[c] && state.shiftDefs[c].ot)).length;
  const sups = all.filter(e => e.roleCategory === 'Shift Supervisor').length;
  const cols = [['M', 'กะเช้า'], ['N', 'กะดึก'], ['D', 'เวลาปกติ'], ['ot', 'OT'], ['V', 'พักร้อน'], ['B', 'ลากิจ'], ['S', 'ลาป่วย'], ['VG', 'ลาอื่น'], ['H', 'นักขัตฤกษ์'], ['O', 'หยุด'], ['work', 'รวมวันทำงาน']];
  const num = v => (v ? v : '<span class="zero">–</span>');
  const body = TEAM_KEYS.map(k => {
    const sec = state.shiftsData[k];
    return `<tr class="grp"><th colspan="${cols.length + 2}" scope="rowgroup">${esc(sec.name.replace(/"/g, ''))}</th></tr>
      ${sec.employees.map(e => {
        const s = { M: 0, N: 0, D: 0, ot: 0, V: 0, B: 0, S: 0, VG: 0, H: 0, O: 0, work: 0 };
        for (let d = 1; d <= n; d++) {
          const c = getShiftCodeForDate(e, y, m, d), def = state.shiftDefs[c] || {};
          if (c === 'O') s.O++;
          else if (def.leave) { const k2 = c === 'VGh' ? 'VG' : c; s[k2] = (s[k2] || 0) + (def.half ? 0.5 : 1); } else {
            s.work++;
            if (def.ot) s.ot++;
            const f = famOf(c).slice(2);
            if (s[f] !== undefined && !def.ot) s[f]++;
          }
        }
        return `<tr><td class="num muted">${esc(e.id)}</td><th scope="row">${esc(e.name)}<small>${esc(e.roleCategory)}</small></th>${cols.map(c => `<td class="num ${c[0] === 'work' ? 'strong' : ''}">${num(s[c[0]])}</td>`).join('')}</tr>`;
      }).join('')}`;
  }).join('');
  return `
    ${pageHead('ข้อมูลและส่งออก CSV', `
      <button class="btn primary" data-click="SF.exportYear(${y})">${icon('export')} ตารางกะทั้งปี ${y + 543}</button>
      <button class="btn" data-click="exportMonthlyCSV()">${icon('export')} ตารางกะรายเดือน</button>
      <button class="btn" data-click="exportLeaveRecordsCSV()">${icon('export')} ประวัติการลา</button>
      <button class="btn" data-click="exportOTRecordsCSV()">${icon('export')} ประวัติการทำ OT</button>`)}
    <div class="kpis">
      <div class="kpi"><span>กะที่อนุมัติแล้วประจำเดือน</span><b>${all.length * n} กะ</b><small>4 ทีม x ${n} วัน</small></div>
      <div class="kpi"><span>พนักงานที่มีชั่วโมง OT</span><b>${otPeople} คน</b><small>MT / NT / MTh / NTh / OT</small></div>
      <div class="kpi"><span>ส่งออกข้อมูลล่าสุด</span><b>${esc(state.lastExport || '—')}</b><small>ส่งออกจากหน้านี้หรือตารางรายปี</small></div>
      <div class="kpi"><span>พนักงานรวมทั้ง 4 กะ</span><b>${all.length} คน</b><small>หัวหน้ากะ (${sups}) + พนักงานกะ (${all.length - sups})</small></div>
    </div>
    <div class="bar">${monthNav(false)}<span class="muted">ตารางกะรายเดือนส่งออกตามเดือนที่เลือก · ประวัติการลาและ OT ส่งออกทั้งปี</span></div>
    <div class="panel flush tbl-wrap">
      <table class="tbl sum">
        <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th>${cols.map(c => `<th class="num">${c[1]}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/* ---------- ไฟล์ส่งออก (เปิดด้วย Excel ได้) ---------- */
function download(rows, filename) {
  const cell = c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  state.lastExport = nowText();
}
const yearCodes = (y, codes) => {
  const rows = [];
  getAllEmployees().forEach(e => {
    for (let m = 0; m < 12; m++) for (let d = 1; d <= daysIn(y, m); d++) {
      const c = getShiftCodeForDate(e, y, m, d);
      if (codes.includes(c)) rows.push([e.id, e.name, e.shiftType, e.roleCategory, `${d} ${thaiMonthName(m, 'short')} ${y + 543}`, c, (state.shiftDefs[c] || {}).label || c]);
    }
  });
  return rows;
};
export function exportMonthlyCSV() {
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const short = thaiMonthName(m, 'short');
  const head = ['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', ...Array.from({ length: n }, (_, i) => `วันที่ ${i + 1} ${short}`)];
  const rows = getAllEmployees().map(e => [e.id, e.name, e.shiftType, e.roleCategory, ...Array.from({ length: n }, (_, i) => getShiftCodeForDate(e, y, m, i + 1))]);
  download([head, ...rows], `ShiftFlow-${new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long' })}-${y}-Shifts.csv`);
  addLog(`ส่งออกตารางกะรายเดือน${thaiMonthName(m, 'long')} ${y + 543}`);
  showToast('ส่งออกไฟล์ตารางกะรายเดือน (CSV) เรียบร้อย');
}
export function exportLeaveRecordsCSV() {
  const y = state.currentYear;
  download([['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', 'วันที่', 'รหัสการลา', 'รายละเอียด'], ...yearCodes(y, ['V', 'B', 'S', 'H', 'VG', 'VGh'])], `ShiftFlow-Leave-Records-${y}.csv`);
  addLog(`ส่งออกประวัติการลา ปี ${y + 543}`);
  showToast('ส่งออกประวัติการลา (CSV) เรียบร้อย');
}
export function exportOTRecordsCSV() {
  const y = state.currentYear;
  download([['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', 'วันที่', 'รหัส OT', 'รายละเอียด'], ...yearCodes(y, ['MT', 'NT', 'MTh', 'NTh', 'OT'])], `ShiftFlow-OT-Records-${y}.csv`);
  addLog(`ส่งออกประวัติการทำ OT ปี ${y + 543}`);
  showToast('ส่งออกประวัติการทำ OT (CSV) เรียบร้อย');
}
// ตารางกะทั้งปีไฟล์เดียว แบ่งเป็นช่วงละเดือน
export function exportYear(y) {
  const DW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const hol = holidayDates(y);
  const rows = [];
  rows.push([`ตารางกะ TNC ปี ${y + 543}`, isYearPublished(y) ? 'ประกาศใช้แล้ว' : 'ฉบับร่าง (ยังไม่ประกาศใช้)', `ส่งออกเมื่อ ${new Date().toLocaleString('th-TH')}`]);
  rows.push(['รหัสกะ: M เช้า · N ดึก · O หยุด · H หยุดนักขัตฤกษ์ · V/S/B ลา · รหัสมี / คือมีการเปลี่ยน เช่น N/M']);
  for (let m = 0; m < 12; m++) {
    const days = Array.from({ length: daysIn(y, m) }, (_, i) => i + 1);
    rows.push([]);
    rows.push([`${thaiMonthName(m, 'long')} ${y + 543}`]);
    rows.push(['รหัส', 'ชื่อ-นามสกุล', 'ทีม', 'ตำแหน่ง', ...days.map(String), 'ทำงาน', 'OT', 'ลา', 'หยุด']);
    rows.push(['', '', '', 'วัน', ...days.map(d => DW[new Date(y, m, d).getDay()])]);
    const hrow = ['', '', '', 'วันหยุด', ...days.map(d => hol[`${m}-${d}`] || '')];
    if (hrow.slice(4).some(Boolean)) rows.push(hrow);
    getAllEmployees().forEach(e => {
      const s = { work: 0, ot: 0, leave: 0, off: 0 };
      const codes = days.map(d => {
        const c = getShiftCodeForDate(e, y, m, d), def = state.shiftDefs[c] || {};
        if (c === 'O' || c === 'H') s.off++; else if (def.leave) s.leave += def.half ? 0.5 : 1; else { s.work++; if (def.ot) s.ot++; }
        return c;
      });
      rows.push([e.code || e.id, e.name, e.shiftType, e.position || e.roleCategory || '', ...codes, s.work, s.ot, s.leave, s.off]);
    });
  }
  download(rows, `ShiftFlow-TNC-Year-${y + 543}.csv`);
  addLog(`ส่งออกตารางกะทั้งปี ${y + 543}`);
  showToast(`ส่งออกตารางกะทั้งปี ${y + 543} แล้ว เปิดด้วย Excel ได้`);
}
