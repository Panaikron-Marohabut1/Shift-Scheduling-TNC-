/* ==========================================================================
   กดช่องกะในตาราง (หรือวันในปฏิทินกะของฉัน): รายละเอียด + คำขอที่ยื่นได้
   --------------------------------------------------------------------------
   ทุกการเปลี่ยนตารางกะต้องยื่นคำขอและได้รับอนุมัติ ไม่มีใครแก้ช่องกะได้โดยตรง (รวมหัวหน้ากะ)
   - ช่องของเพื่อน: ปุ่ม "สลับกะกับคนนี้" เปิดแบบฟอร์มสลับกะที่เลือกคนไว้แล้ว
   - ช่องของตัวเอง: ปุ่มคำขอที่ยื่นได้ในวันนั้น
   ฝ่ายบุคคลดูอย่างเดียว · เดือนที่ผ่านไปแล้วและปีที่ยังไม่ประกาศใช้ยื่นคำขอไม่ได้
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { isoOf, shortDate } from '../../shared/scheduling/dates.js';
import { currentEmp, findEmployeeById, getEmployeeFacingShiftLabel, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate, getTeamForDate, hasScheduleDataForMonth, isMonthLocked, isPastScheduleDate, isSchedulePublished } from '../../shared/scheduling/roster.js';
import { getEligibleSwapColleagues, validateSwapBothSides } from '../../shared/scheduling/rules.js';
import { telOf } from '../../shared/ui.js';
import { kindsAllowed, requestOptions } from '../requests/new-request.js';
import { getVisibleRequests } from '../requests/permissions.js';
import { localCancellationConflict, requestConflictAt, requestConflictText } from '../requests/request-conflict.js';
import { changeInfoRows, changeSource } from './change-info.js';
import { changeNote, famOf } from './codes.js';
import { draftNote, holidaysOf } from './days.js';

export function openCell(empId, day) { view.cell = { empId: String(empId), day }; renderCell(); }

export function renderCell() {
  const c = view.cell;
  if (!c) return;
  const emp = findEmployeeById(c.empId);
  if (!emp) return;
  const y = state.currentYear, m = state.currentMonth, d = c.day;
  const code = getShiftCodeForDate(emp, y, m, d);
  const def = state.shiftDefs[code] || state.shiftDefs.O;
  const hol = holidaysOf(y)[`${m}-${d}`];
  const chg = changeNote(emp, y, m, d, code);
  const published = isSchedulePublished(y, m);
  const locked = isMonthLocked(y, m) || !published;
  const role = state.activeRole;
  const me = currentEmp();
  const isMine = me && me.id === emp.id;
  const requestRole = role === 'Shift Employee' || isSupervisorRoleName(role);
  const past = isPastScheduleDate(y, m, d);
  const canRequest = requestRole && !locked && !past && me && (!state.actor?.remotePilot || state.actor.centralSwap);
  const date = isoOf(y, m, d);
  const ownAssignment = state.apiAssign[me?.id]?.[date];
  const selectedAssignment = state.apiAssign[emp.id]?.[date];
  const canSwapHere = me && (state.actor?.centralSwap
    ? ownAssignment?.status === 'ACTIVE' && selectedAssignment?.status === 'ACTIVE'
      && ownAssignment.team_id !== selectedAssignment.team_id && ownAssignment.position === selectedAssignment.position
    : getEligibleSwapColleagues(me).some(e => e.id === emp.id));
  const selectedConflict = requestConflictAt(emp.id, y, m, d);
  const conflict = requestRole && (isMine || (canRequest && canSwapHere))
    ? (isMine ? selectedConflict : requestConflictAt(me.id, y, m, d) || selectedConflict) : null;
  const visible = getVisibleRequests();
  const findVisible = id => id != null && visible.find(r => String(r.id) === String(id));
  const conflictRequest = findVisible(conflict?.requestId);
  const source = selectedConflict?.status === 'APPROVED'
    ? findVisible(selectedConflict.requestId) : chg && findVisible(changeSource(emp, y, m, d)?.id);
  const unavailable = !published ? (state.actor?.swapPolicy || state.actor?.monthClose ? 'ตารางกะเดือนนี้ยังไม่ประกาศใช้' : draftNote(y))
    : locked ? 'เดือนนี้ถูกล็อกข้อมูลแล้ว ดูได้อย่างเดียว' : '';
  const dateText = new Date(y, m, d).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let body = `
    <div class="cellinfo ${famOf(code)} ${chg ? 'chg' : ''}">
      <b>${esc(getEmployeeFacingShiftLabel(code.split('/').length === 2 ? code.split('/')[0] : code))}</b>
      <span>${esc(dateText)}${def.time ? ` · ${esc(def.time)}` : ''}</span>
      <i>${esc(code)}</i>
    </div>
    <dl class="facts plain">
      <div><dt>พนักงาน</dt><dd>${esc(emp.name)} (${esc(emp.id)}) · ${esc(emp.position || '')} · ${esc(getTeamForDate(emp, y, m, d))}</dd></div>
      <div><dt>โทรศัพท์</dt><dd>${telOf(emp.phone)}</dd></div>
      ${chg ? `<div><dt>การเปลี่ยนแปลง</dt><dd>${esc(chg)}</dd></div>` : ''}
      ${source ? changeInfoRows(source, emp, y, m, d) : ''}
      ${hol ? `<div><dt>วันหยุด</dt><dd>${esc(hol)}</dd></div>` : ''}
      ${!hasScheduleDataForMonth(y, m) ? '<div><dt>ที่มา</dt><dd>คาดการณ์ตามรอบกะปกติ</dd></div>' : ''}
    </dl>`;
  if (!past || !requestRole) {
    if (!conflict && isMine && requestRole && unavailable) body += requestOptions([], d, { emptyMessage: unavailable });
    else if (unavailable) body += `<p class="note">${esc(unavailable)}</p>`;
    else if (role === 'HR') body += '<p class="note">ฝ่ายบุคคลดูข้อมูลได้อย่างเดียว</p>';
  }

  if (conflict) {
    body += requestOptions([], d, { emptyMessage: requestConflictText(conflict) });
    const cancelBlockReason = isMine && conflictRequest && (conflictRequest.cancelBlockReason
      || (!conflictRequest.api && conflict.status === 'APPROVED' && localCancellationConflict(conflictRequest)));
    if (cancelBlockReason) body += `<p class="note">${esc(cancelBlockReason)}</p>`;
  } else if (canRequest) {
    if (isMine) {
      let kinds;
      if (code === 'H' || def.family === 'O' || hol) kinds = ['dayoff'];
      else if (def.leave) kinds = [];
      else kinds = ['swap', 'leave'];
      if (selectedAssignment?.status === 'ACTIVE' && selectedAssignment.is_working === false && ['O', '-'].includes(selectedAssignment.shift_code)) kinds.push('ot');
      if (state.actor?.centralSwap && selectedAssignment?.status === 'ACTIVE') kinds.push('swap');
      if (state.actor?.remotePilot && selectedAssignment?.status !== 'ACTIVE') kinds = [];
      const list = kindsAllowed().filter(x => kinds.includes(x.k));
      body += requestOptions(list, d, { fromCell: true, emptyMessage: def.leave ? 'ตารางระบุว่าเป็นวันลาแล้ว' : undefined });
    } else if (canSwapHere) {
      const myCode = getShiftCodeForDate(me, y, m, d);
      const legacyBlocked = !state.actor?.centralSwap && !validateSwapBothSides(me.id, emp.id, d).valid;
      body += `
        <h3>ยื่นคำขอ</h3>
        <ul class="kinds"><li><button data-click="SF.swapWith(${js(emp.id)}, ${d})">
          <b>ขอสลับกะกับ ${esc(emp.name)}</b>
          <span>คุณ ${esc(getEmployeeFacingShiftLabel(myCode))} ↔ ${esc(emp.name.split(' ')[0])} ${esc(getEmployeeFacingShiftLabel(code))}${myCode === code ? ' · วันนี้อยู่กะเดียวกัน' : legacyBlocked ? ' · ติดกฎ เปิดดูเหตุผลในแบบฟอร์ม' : ''}</span>
        </button></li></ul>`;
    } else {
      body += `<p class="note">${me.roleCategory === 'Shift Supervisor' ? 'สลับกะได้กับหัวหน้ากะต่างทีม' : 'สลับกะได้กับพนักงานกะต่างทีม'} ผู้ขอต้องเป็นเจ้าของกะ</p>`;
    }
  }

  const linked = conflictRequest || findVisible(source?.id);
  const linkText = conflictRequest && conflict.status === 'PENDING' ? 'ดูคำขอเดิม' : 'ดูคำขอที่ทำให้เปลี่ยน';
  const foot = `${linked ? `<button class="btn" data-click="openRequestDetails(${js(linked.id)})">${linkText}</button>` : ''}<button class="btn" data-click="closeModal()">ปิด</button>`;
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  openModal(`${emp.name} · ${shortDate(y, m, d)}`, body, foot);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
}
