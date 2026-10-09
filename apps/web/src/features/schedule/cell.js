/* ==========================================================================
   กดช่องกะในตาราง (หรือวันในปฏิทินกะของฉัน): รายละเอียด + คำขอที่ยื่นได้
   --------------------------------------------------------------------------
   ทุกการเปลี่ยนตารางกะต้องยื่นคำขอและได้รับอนุมัติ ไม่มีใครแก้ช่องกะได้โดยตรง (รวมหัวหน้ากะ)
   - ช่องของเพื่อน: ปุ่ม "สลับกะกับคนนี้" เปิดแบบฟอร์มสลับกะที่เลือกคนไว้แล้ว
   - ช่องของตัวเอง: ปุ่มคำขอที่ยื่นได้ในวันนั้น
   ฝ่ายบุคคลดูอย่างเดียว · เดือนที่ผ่านไปแล้วและปีที่ยังไม่ประกาศใช้ยื่นคำขอไม่ได้
   ========================================================================== */
import { state, view } from '../../app/state.js';
import { $, esc, js, openModal } from '../../shared/dom.js';
import {
  findEmployeeById, getShiftCodeForDate, getEmployeeFacingShiftLabel, isMonthLocked, isYearPublished, isSupervisorRoleName, currentEmp,
  getEligibleSwapColleagues, validateSwapBothSides, hasScheduleDataForMonth, shortDate
} from '../../shared/scheduling.js';
import { famOf, changeNote, holidaysOf, draftNote, telOf } from './view.js';
import { kindsAllowed, kindButtons } from '../requests/forms.js';

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
  const locked = isMonthLocked(y, m) || !isYearPublished(y);
  const role = state.activeRole;
  const me = currentEmp();
  const isMine = me && me.id === emp.id;
  const canRequest = (role === 'Shift Employee' || isSupervisorRoleName(role)) && !locked && me;
  const dateText = new Date(y, m, d).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let body = `
    <div class="cellinfo ${famOf(code)} ${chg ? 'chg' : ''}">
      <b>${esc(getEmployeeFacingShiftLabel(code.split('/').length === 2 ? code.split('/')[0] : code))}</b>
      <span>${esc(dateText)}${def.time ? ` · ${esc(def.time)}` : ''}</span>
      <i>${esc(code)}</i>
    </div>
    <dl class="facts plain">
      <div><dt>พนักงาน</dt><dd>${esc(emp.name)} (${esc(emp.id)}) · ${esc(emp.position || '')} · ${esc(emp.shiftType)}</dd></div>
      <div><dt>โทรศัพท์</dt><dd>${telOf(emp.phone)}</dd></div>
      ${chg ? `<div><dt>การเปลี่ยนแปลง</dt><dd>${esc(chg)}</dd></div>` : ''}
      ${hol ? `<div><dt>วันหยุด</dt><dd>${esc(hol)}</dd></div>` : ''}
      ${!hasScheduleDataForMonth(y, m) ? '<div><dt>ที่มา</dt><dd>คาดการณ์ตามรอบกะปกติ</dd></div>' : ''}
    </dl>`;
  if (!isYearPublished(y)) body += `<p class="note">${draftNote(y)}</p>`;
  else if (locked) body += '<p class="note">เดือนนี้ถูกล็อกข้อมูลแล้ว ดูได้อย่างเดียว</p>';
  else if (role === 'HR') body += '<p class="note">ฝ่ายบุคคลดูข้อมูลได้อย่างเดียว</p>';

  if (canRequest) {
    if (isMine) {
      let kinds;
      if (code === 'H') kinds = ['holiday'];
      else if (def.leave) kinds = [];
      else if (def.family === 'O') kinds = ['dayoff', 'ot'];
      else kinds = ['swap', 'change', 'leave', 'ot'];
      if (hol && code !== 'H' && !def.leave) kinds.push('holiday');
      const list = kindsAllowed().filter(x => kinds.includes(x.k));
      if (list.length) body += `<h3>ยื่นคำขอของฉันในวันนี้</h3>${kindButtons(list, d)}`;
    } else if (getEligibleSwapColleagues(me).some(e => e.id === emp.id)) {
      const myCode = getShiftCodeForDate(me, y, m, d);
      const sw = validateSwapBothSides(me.id, emp.id, d);
      body += `
        <h3>ยื่นคำขอ</h3>
        <ul class="kinds"><li><button data-click="SF.swapWith(${js(emp.id)}, ${d})">
          <b>สลับกะกับ ${esc(emp.name)}</b>
          <span>คุณ ${esc(getEmployeeFacingShiftLabel(myCode))} ↔ ${esc(emp.name.split(' ')[0])} ${esc(getEmployeeFacingShiftLabel(code))}${myCode === code ? ' · วันนี้อยู่กะเดียวกัน' : sw.valid ? '' : ' · ติดกฎ เปิดดูเหตุผลในแบบฟอร์ม'}</span>
        </button></li></ul>`;
    } else {
      body += `<p class="note">${me.roleCategory === 'Shift Supervisor' ? 'หัวหน้ากะสลับกะได้เฉพาะกับหัวหน้ากะทีมอื่น' : 'สลับกะได้เฉพาะกับพนักงานกะทีมอื่น'} · การเปลี่ยนกะของคนอื่นต้องให้เจ้าของกะยื่นคำขอ</p>`;
    }
  }

  const foot = '<button class="btn" data-click="closeModal()">ปิด</button>';
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  openModal(`${esc(emp.name)} · ${esc(shortDate(y, m, d))}`, body, foot);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
}
