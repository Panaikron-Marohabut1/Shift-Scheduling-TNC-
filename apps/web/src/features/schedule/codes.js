/* ==========================================================================
   รหัสกะ → สีและข้อความในช่อง และหมายเหตุเมื่อช่องถูกเปลี่ยนจากตารางเดิม
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { getEmployeeFacingShiftLabel } from '../../shared/scheduling/employees.js';

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
