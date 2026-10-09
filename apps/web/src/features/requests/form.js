/* ==========================================================================
   แบบฟอร์มยื่นคำขอ: วาดฟอร์มตามประเภท ผลที่จะเกิดในตาราง ผลตรวจกฎ และลำดับผู้อนุมัติ
   ส่วนเฉพาะของแต่ละประเภทอยู่ในโฟลเดอร์ types/
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { $, esc } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { daysIn } from '../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingRoleLabel } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../shared/scheduling/roster.js';
import { approversList, changesTable, routeApprovers } from './form-parts.js';
import { draftBlocked, kindLabel } from './new-request.js';
import { changeForm } from './types/change.js';
import { dayoffForm } from './types/dayoff.js';
import { holidayForm } from './types/holiday.js';
import { leaveForm } from './types/leave.js';
import { otForm } from './types/ot.js';
import { swapForm } from './types/swap.js';

export function openForm(k, day) {
  const emp = currentEmp();
  if (!emp) return;
  if (draftBlocked()) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = Math.min(Math.max(1, day || state.currentDay), n);
  const code = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, d);
  const offDays = Array.from({ length: n }, (_, i) => i + 1).filter(x => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, x) === 'O');
  view.rq = {
    k, day: d, partner: '', mode: 'mutual', leave: 'V', ot: 'MT', cover: '', coverOt: 'MT',
    code: (state.shiftDefs[code] || {}).family === 'M' ? 'N' : 'M',
    ...(((state.shiftDefs[code] || {}).family === 'N' || String(code).startsWith('N')) ? { ot: 'NT', coverOt: 'NT' } : {}),
    oldDay: code === 'O' ? d : (offDays[0] || ''), newDay: '', hol: '', reason: '', retro: false
  };
  renderForm();
}

// แต่ละประเภทคำขอมีไฟล์ของตัวเองใน types/ (ช่องกรอก + ผลตรวจกฎ + การส่งคำขอ)
const FORMS = { swap: swapForm, change: changeForm, leave: leaveForm, dayoff: dayoffForm, ot: otForm, holiday: holidayForm };

export function renderForm() {
  const f = view.rq;
  if (!f) return;
  const emp = currentEmp();
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const myCode = getShiftCodeForDate(emp, y, m, f.day);
  const { fields, rows, checks, approvers, ready, submit, note } = FORMS[f.k]({ f, emp, y, m, n, myCode });
  const body = `
    <dl class="facts plain"><div><dt>ผู้ขอ</dt><dd>${esc(emp.name)} (${esc(emp.id)}) ${esc(getEmployeeFacingRoleLabel(emp.roleCategory))} ${esc(emp.shiftType)}</dd></div></dl>
    <div class="form">${fields.join('')}</div>
    ${note}
    ${changesTable(rows)}
    ${checks}
    ${approversList(routeApprovers(emp, approvers))}`;
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  openModal(`ยื่นคำขอ ${kindLabel(f.k)}`, body,
    `<button class="btn" data-click="SF.newRequest()">ย้อนกลับ</button><button class="btn primary" ${ready && submit ? `data-click="${submit}"` : 'disabled'}>ส่งคำขอ</button>`);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
}
