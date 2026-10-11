/* ==========================================================================
   ตารางกะรายเดือน: แถวพนักงานแยกทีม ช่องรายวัน สรุปท้ายแถว และจำนวนคนต่อกะท้ายตาราง
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { TH_DW, thaiMonthName } from '../../shared/scheduling/dates.js';
import { getAllEmployees } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../shared/scheduling/roster.js';
import { cellText, changeNote, codeClass, famOf } from './codes.js';
import { dayClass } from './days.js';
import { matchQ, teamSections } from './page.js';

export function gridHtml(S) {
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
