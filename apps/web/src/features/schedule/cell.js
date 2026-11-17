/* ==========================================================================
   กดช่องกะในตาราง (หรือวันในปฏิทินกะของฉัน): รายละเอียด + คำขอที่ยื่นได้
   --------------------------------------------------------------------------
   การเปลี่ยนรหัสกะผ่านคำขอ ส่วน Manager บันทึกขาดงานแยกจากรหัสกะได้
   - ช่องของเพื่อน: ปุ่ม "สลับกะกับคนนี้" เปิดแบบฟอร์มสลับกะที่เลือกคนไว้แล้ว
   - ช่องของตัวเอง: ปุ่มคำขอที่ยื่นได้ในวันนั้น
   ฝ่ายบุคคลดูอย่างเดียว · เดือนที่ผ่านไปแล้วและปีที่ยังไม่ประกาศใช้ยื่นคำขอไม่ได้
   ========================================================================== */

import { api } from '../../api/client.js';
import { reloadMonths } from '../../app/data.js';
import { renderApp } from '../../app/render.js';
import { state, view } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { showToast } from '../../shared/toast.js';
import { isoOf, monthKey, shortDate } from '../../shared/scheduling/dates.js';
import { hasCentralHolidayCalendar } from '../../shared/scheduling/annual.js';
import { currentEmp, findEmployeeById, getEmployeeFacingShiftLabel, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { getCalendarShiftCode, getShiftCodeForDate, getTeamForDate, hasScheduleDataForMonth, isMonthLocked, isPastScheduleDate, isSchedulePublished } from '../../shared/scheduling/roster.js';
import { getEligibleSwapColleagues, validateSwapBothSides } from '../../shared/scheduling/rules.js';
import { telOf } from '../../shared/ui.js';
import { kindsAllowed, requestOptions } from '../requests/new-request.js';
import { getVisibleRequests } from '../requests/permissions.js';
import { localCancellationConflict, requestConflictAt, requestConflictText } from '../requests/request-conflict.js';
import { holidayDateLabel } from '../requests/types/holiday.js';
import { changeInfoRows, changeSource } from './change-info.js';
import { changeNote, famOf, overtimeKindLabel } from './codes.js';
import { draftNote, holidaysOf } from './days.js';

export function openCell(empId, day, context) {
  view.cell = { empId: String(empId), day, context };
  renderCell();
}

const absenceAttempts = new WeakMap();
const absenceActionLabel = active => active ? 'ยกเลิกการบันทึกขาดงาน' : 'บันทึกขาดงาน';

function canRecordAbsence(slot, y, m) {
  return state.actor?.role === 'MANAGER' && state.actor.absenceTracking
    && slot?.status === 'ACTIVE' && slot.is_working === true
    && isSchedulePublished(y, m) && !isMonthLocked(y, m);
}

export async function setCellAbsence() {
  const cell = view.cell;
  const actor = state.actor;
  if (!cell || !actor) return;
  const y = state.currentYear, m = state.currentMonth;
  const date = isoOf(y, m, cell.day);
  const slot = state.apiAssign[cell.empId]?.[date];
  const button = $('#cellAbsenceAction');
  if (!button || !canRecordAbsence(slot, y, m)) return;

  const id = slot.assignment_id;
  const absenceId = slot.absence?.id ?? null;
  const holidayDate = slot.holidayOvertime?.holidayDate ?? null;
  const previous = absenceAttempts.get(actor);
  if (previous?.pending) return;
  const attempt = previous?.id === id && previous.version === slot.version && previous.absenceId === absenceId && previous.holidayDate === holidayDate
    ? previous : { id, version: slot.version, absenceId, holidayDate, key: crypto.randomUUID() };
  attempt.pending = true;
  absenceAttempts.set(actor, attempt);
  button.disabled = true;
  button.textContent = 'กำลังบันทึก…';
  const failure = $('#cellAbsenceError');
  failure.hidden = true;
  try {
    const result = await api(`/schedules/assignments/${id}/absence`, {
      method: 'POST', key: attempt.key, body: { active: absenceId === null, version: slot.version, absenceId,
        ...(absenceId === null ? { holidayDate } : {}) },
    });
    absenceAttempts.delete(actor);
    if (!view.signed || state.actor !== actor) return;
    const current = state.apiAssign[cell.empId]?.[date];
    if (current?.assignment_id === id && current.version === attempt.version && (current.absence?.id ?? null) === absenceId) {
      current.absence = result.absence;
    }
    renderApp();
    if (view.cell === cell && button.isConnected && state.currentYear === y && state.currentMonth === m) {
      renderCell();
      $('#cellAbsenceAction')?.focus();
    }
    showToast(result.absence ? 'บันทึกขาดงานแล้ว' : 'ยกเลิกการบันทึกขาดงานแล้ว');
  } catch (error) {
    if (error.code !== 'NETWORK_ERROR') absenceAttempts.delete(actor);
    if (error.code === 'ABSENCE_CHANGED' && view.signed && state.actor === actor) {
      const refreshed = await reloadMonths([monthKey(y, m)], { strict: true }).then(() => true, () => false);
      if (refreshed && view.signed && state.actor === actor) {
        renderApp();
        if (view.cell === cell && button.isConnected && state.currentYear === y && state.currentMonth === m) renderCell();
      }
    }
    const visibleError = failure.isConnected ? failure : view.cell === cell && $('#cellAbsenceError');
    if (visibleError) {
      visibleError.textContent = error.message;
      visibleError.hidden = false;
      $('#cellAbsenceAction')?.focus();
    } else if (view.signed && state.actor === actor) showToast(error.message, 'alert');
  } finally {
    attempt.pending = false;
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = absenceActionLabel(Boolean(slot.absence));
    }
  }
}

export function renderCell() {
  const c = view.cell;
  if (!c) return;
  const emp = findEmployeeById(c.empId);
  if (!emp) return;
  const y = state.currentYear, m = state.currentMonth, d = c.day;
  const code = getShiftCodeForDate(emp, y, m, d);
  const def = state.shiftDefs[code] || state.shiftDefs.O;
  const holidays = holidaysOf(y);
  const hol = holidays[`${m}-${d}`];
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
  const absence = selectedAssignment?.absence;
  const absenceAction = canRecordAbsence(selectedAssignment, y, m);
  const holidayOvertime = selectedAssignment?.holidayOvertime;
  const holidayLeave = selectedAssignment?.holidayLeave;
  const previewOvertime = c.context === 'holiday-preview' && isMine && past
    ? state.apiMonths[monthKey(y, m)]?.holidayOvertimePreview?.find(item => item.workDate === date)
    : null;
  const displayCode = previewOvertime?.shiftCode || getCalendarShiftCode(emp, y, m, d);
  const overtime = overtimeKindLabel(displayCode, Boolean(holidayOvertime || previewOvertime));
  const sourceHoliday = holidayOvertime && holidayOvertime.holidayDate !== date
    ? holidays[`${m}-${Number(holidayOvertime.holidayDate.slice(-2))}`] : '';
  const shownTime = holidayLeave ? '' : holidayOvertime || previewOvertime ? def.time?.split(' (')[0] : def.time;
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
    <div class="cellinfo ${famOf(displayCode)} ${chg ? 'chg' : ''}">
      <b>${holidayLeave ? 'หยุดโดยใช้สิทธิ์นักขัตฤกษ์' : previewOvertime ? 'OT นักขัตฤกษ์ · ผลคำนวณย้อนหลัง' : holidayOvertime ? 'OT นักขัตฤกษ์' : esc(getEmployeeFacingShiftLabel(code.split('/').length === 2 ? code.split('/')[0] : code))}</b>
      <span>${esc(dateText)}${shownTime ? ` · ${esc(shownTime)}` : ''}</span>
      <i>${esc(displayCode)}</i>
    </div>
    <dl class="facts plain">
      <div><dt>พนักงาน</dt><dd>${esc(emp.name)} (${esc(emp.id)}) · ${esc(emp.position || '')} · ${esc(getTeamForDate(emp, y, m, d))}</dd></div>
      <div><dt>โทรศัพท์</dt><dd>${telOf(emp.phone)}</dd></div>
      ${absence ? '<div><dt>สถานะ</dt><dd><span class="absence-tag">ขาดงาน</span></dd></div>' : ''}
      ${chg ? `<div><dt>การเปลี่ยนแปลง</dt><dd>${esc(chg)}</dd></div>` : ''}
      ${source ? changeInfoRows(source, emp, y, m, d) : ''}
      ${hol ? `<div><dt>วันหยุด${state.actor?.remotePilot && !hasCentralHolidayCalendar(y, m) ? ' (ข้อมูลทดสอบ)' : ''}</dt><dd>${esc(hol)}</dd></div>` : ''}
      ${holidayOvertime ? `<div><dt>OT จากวันหยุดนักขัตฤกษ์</dt><dd>${esc(holidayDateLabel(holidayOvertime.holidayDate))}${sourceHoliday ? ` · ${esc(sourceHoliday)}` : ''}</dd></div>` : ''}
      ${holidayLeave ? `<div><dt>สิทธิ์นักขัตฤกษ์</dt><dd>${esc(holidayDateLabel(holidayLeave.holidayDate))}</dd></div>` : ''}
      ${previewOvertime ? `<div><dt>วันนักขัตฤกษ์ที่ใช้คำนวณ</dt><dd>${esc(holidayDateLabel(previewOvertime.holidayDate))}</dd></div>` : ''}
      ${overtime && !holidayOvertime && !previewOvertime ? `<div><dt>ประเภท OT</dt><dd>${esc(overtime)}</dd></div>` : ''}
      ${!hasScheduleDataForMonth(y, m) ? '<div><dt>ที่มา</dt><dd>คาดการณ์ตามรอบกะปกติ</dd></div>' : ''}
    </dl>`;
  if (!past || !requestRole) {
    if (!conflict && isMine && requestRole && unavailable) body += requestOptions([], d, { emptyMessage: unavailable });
    else if (unavailable) body += `<p class="note">${esc(unavailable)}</p>`;
    else if (role === 'HR') body += '<p class="note">ฝ่ายบุคคลดูข้อมูลได้อย่างเดียว</p>';
  }

  if (absence && isMine) {
    body += requestOptions([], d, { emptyMessage: 'กะนี้บันทึกขาดงานแล้ว' });
  } else if (conflict) {
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
      if (state.actor?.centralHoliday && hol) kinds.push('holiday');
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
  if (absenceAction) body += '<p class="form-err" id="cellAbsenceError" role="alert" hidden></p>';
  const absenceButton = absenceAction ? `<button type="button" class="btn${absence ? '' : ' danger'}" id="cellAbsenceAction" data-click="SF.setCellAbsence()">${absenceActionLabel(Boolean(absence))}</button>` : '';
  const foot = `${linked ? `<button class="btn" data-click="openRequestDetails(${js(linked.id)})">${linkText}</button>` : ''}${absenceButton}<button class="btn" data-click="closeModal()">ปิด</button>`;
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  openModal(`${emp.name} · ${shortDate(y, m, d)}`, body, foot);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
}
