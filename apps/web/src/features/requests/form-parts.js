/* ==========================================================================
   ส่วนประกอบที่ทุกแบบฟอร์มคำขอใช้ร่วมกัน และการจัดลำดับผู้อนุมัติ
   (หัวหน้ากะไม่อนุมัติคำขอของตัวเอง → ให้ผู้จัดการฝ่ายผลิตอนุมัติแทน)
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { isoOf } from '../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingShiftLabel } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../shared/scheduling/roster.js';
import { swatch } from '../schedule/codes.js';

/* ---------- ส่วนประกอบของแบบฟอร์ม ---------- */
const codeLabel = c => `${swatch(c)}<span>${esc(getEmployeeFacingShiftLabel(c))}</span>`;
export const opt = (v, text, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(text)}</option>`;
export function checksList(title, results) {
  if (!results || !results.length) return '';
  const mark = { pass: icon('check'), warn: icon('alert'), fail: icon('x'), pending: icon('more') };
  return `<div class="checks">${title ? `<p class="checks-t">${esc(title)}</p>` : ''}<ul>${results.map(c => `
    <li class="${esc(c.status)}"><i class="mk" aria-hidden="true">${mark[c.status] || icon('dot')}</i>
      <span>${c.statusText ? `<small class="check-status">${esc(c.statusText)}</small> ` : ''}${c.rule ? `<b>${esc(c.rule)}</b> ` : ''}${esc(c.msg)}</span>
    </li>`).join('')}</ul></div>`;
}
export function changesTable(rows, heading = 'ผลที่จะเกิดในตารางกะเมื่ออนุมัติครบ') {
  if (!rows.length) return '';
  return `
    <h3>${esc(heading)}</h3>
    <table class="tbl chg${rows.some(row => row.targetCodeOnly) ? ' leave-preview' : ''}">
      <thead><tr><th>พนักงาน</th><th>วันที่</th><th>เดิม</th><th>เปลี่ยนเป็น</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.e.name)}</td><td class="nowrap">${esc(r.date)}</td><td>${codeLabel(r.from)}</td><td>${r.targetLabel ? esc(r.targetLabel) : r.targetCodeOnly ? `<b>${esc(r.to)}</b>` : codeLabel(r.to)}</td></tr>`).join('')}</tbody>
    </table>`;
}
export const approversList = (roles, heading = 'ลำดับผู้อนุมัติ') => `<h3>${esc(heading)}</h3><ol class="steps">${roles.map(r => `<li><b>${esc(r)}</b></li>`).join('')}</ol>`;
export function dateField(labelText, idHidden) {
  const f = view.rq, y = state.currentYear, m = state.currentMonth;
  const c = getShiftCodeForDate(currentEmp(), y, m, f.day);
  return `
    <div class="field"><label for="rqDate">${labelText}</label>
      <input class="inp" id="rqDate" type="date" value="${isoOf(y, m, f.day)}" data-change="SF.rqDate(this.value)">
      ${idHidden ? `<input type="hidden" id="${idHidden}" value="${f.day}">` : ''}
      <small>${esc(new Date(y, m, f.day).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · กะของคุณ ${codeLabel(c)}</small>
    </div>`;
}
export const reasonField = (id, { required = false, hint = '' } = {}) => `<div class="field"><label for="${id}">${required ? 'เหตุผลการลา (จำเป็น)' : 'เหตุผล / รายละเอียดเพิ่มเติม (ไม่บังคับ)'}</label><textarea class="inp" id="${id}" rows="2" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}Hint"` : ''} data-input="SF.rqKeep('reason', this.value)">${esc(view.rq.reason)}</textarea>${hint ? `<small id="${id}Hint">${esc(hint)}</small>` : ''}</div>`;
export const retroField = id => `<label class="chk"><input type="checkbox" id="${id}" ${view.rq.retro ? 'checked' : ''} data-change="SF.rqKeep('retro', this.checked)"><span>ยื่นคำขอย้อนหลัง (สำหรับวันที่ผ่านมาแล้ว)</span></label>`;
export const ownSup = emp => `Shift Supervisor (${emp.shiftType})`;
// หัวหน้ากะไม่อนุมัติคำขอของตัวเอง: ขั้นที่เป็นหัวหน้ากะทีมเดียวกับผู้ขอ ให้ผู้จัดการฝ่ายผลิตอนุมัติแทน
const MANAGER_STEP = 'ผู้จัดการฝ่ายผลิต (อนุมัติแทนหัวหน้ากะ)';
export function routeApprovers(emp, roles) {
  if (!emp || emp.roleCategory !== 'Shift Supervisor') return roles;
  const letter = emp.shiftType.replace('Shift ', '');
  const out = [];
  roles.forEach(r => {
    const own = r.includes(`Shift ${letter}`) || r.includes(`Supervisor ${letter}`);
    const role = own ? MANAGER_STEP : r;
    const last = out[out.length - 1];
    if (!(last && last.includes('ผู้จัดการ') && role.includes('ผู้จัดการ'))) out.push(role);
  });
  return out;
}
