/* ==========================================================================
   แบบฟอร์มยื่นคำขอ: วาดฟอร์มตามประเภท ผลที่จะเกิดในตาราง ผลตรวจกฎ และลำดับผู้อนุมัติ
   ส่วนเฉพาะของแต่ละประเภทอยู่ในโฟลเดอร์ types/
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { $, esc } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { daysIn } from '../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingRoleLabel } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate, isPastScheduleDate } from '../../shared/scheduling/roster.js';
import { approversList, changesTable, routeApprovers } from './form-parts.js';
import { draftBlocked, kindLabel, PAST_DATE_NOTE } from './new-request.js';
import { dayoffForm } from './types/dayoff.js';
import { leaveForm } from './types/leave.js';
import { otForm } from './types/ot.js';
import { swapForm } from './types/swap.js';
import { centralSwapForm, validateCentralSwapPreview } from './types/central-swap.js';

export function openForm(k, day, origin = 'menu') {
  const emp = currentEmp();
  if (!emp) return;
  if (draftBlocked(k)) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = Math.min(Math.max(1, day || state.currentDay), n);
  if (origin === 'cell' && isPastScheduleDate(state.currentYear, state.currentMonth, d)) {
    openModal('ดูรายละเอียดอย่างเดียว', `<p>${esc(PAST_DATE_NOTE)}</p>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
    return;
  }
  const code = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, d);
  const offDays = Array.from({ length: n }, (_, i) => i + 1).filter(x => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, x) === 'O');
  view.rq = {
    k, day: d, partner: '', mode: k === 'swap' && state.actor?.centralSwap ? 'one' : 'mutual',
    originCell: origin === 'cell' && view.cell ? { ...view.cell, y: state.currentYear, m: state.currentMonth } : null,
    leave: 'V', ot: 'MT', cover: '', coverOt: 'MT',
    code: (state.shiftDefs[code] || {}).family === 'M' ? 'N' : 'M',
    ...(((state.shiftDefs[code] || {}).family === 'N' || String(code).startsWith('N')) ? { ot: 'NT', coverOt: 'NT' } : {}),
    oldDay: code === 'O' || code === 'H' ? d : (offDays[0] || ''), newDay: '', workCode: '', payDay: '', helpers: [], reason: '', retro: false
  };
  renderForm();
  return true;
}

// แต่ละประเภทคำขอมีไฟล์ของตัวเองใน types/ (ช่องกรอก + ผลตรวจกฎ + การส่งคำขอ)
const FORMS = { swap: swapForm, leave: leaveForm, dayoff: dayoffForm, ot: otForm };

export function renderForm() {
  const f = view.rq;
  if (!f || !FORMS[f.k]) return;
  const emp = currentEmp();
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const myCode = getShiftCodeForDate(emp, y, m, f.day);
  const central = f.k === 'swap' && state.actor?.centralSwap;
  const { fields, rows, checks, approvers, ready, submit, note } = (central ? centralSwapForm : FORMS[f.k])({ f, emp, y, m, n, myCode });
  const body = `
    <dl class="facts plain"><div><dt>ผู้ขอ</dt><dd>${esc(emp.name)} (${esc(emp.id)}) ${esc(getEmployeeFacingRoleLabel(emp.roleCategory))} ${esc(emp.shiftType)}</dd></div></dl>
    <div class="form">${fields.join('')}</div>
    ${note}
    ${changesTable(rows)}
    ${checks}
    ${central ? (approvers.length ? approversList(approvers, 'ผู้อนุมัติ') : '') : approversList(routeApprovers(emp, approvers))}`;
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  const focusedId = central && box?.contains(document.activeElement) ? document.activeElement.id : '';
  openModal(kindLabel(f.k), body,
    `<button class="btn" data-click="SF.backRequestForm()" ${f.submitting ? 'disabled' : ''}>ย้อนกลับ</button><button class="btn primary" ${ready && submit ? `data-click="${submit}"` : 'disabled'}>ส่งคำขอ</button>`);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
  const nextFocus = focusedId && document.getElementById(focusedId);
  if (nextFocus && nb?.contains(nextFocus)) nextFocus.focus({ preventScroll: true });
  if (central) {
    $('#centralSwapCheckRetry')?.addEventListener('click', () => {
      f.preview = null;
      f.error = '';
      renderForm();
    });
    void validateCentralSwapPreview(f, renderForm);
  }
}
