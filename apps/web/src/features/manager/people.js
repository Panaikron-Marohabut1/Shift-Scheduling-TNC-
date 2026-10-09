/* ==========================================================================
   ผู้จัดการ: พนักงานและทีม (ค้นหา กรองทีม เพิ่ม/แก้ไขพนักงาน)
   LOCAL: เก็บการแก้ไขในเบราว์เซอร์จนกว่าระบบหลังบ้านจะมี API แก้ข้อมูลพนักงาน
   ========================================================================== */

import { addLog, rebuildSchedule } from '../../app/data.js';
import { state } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { closeModal, openModal } from '../../shared/modal.js';
import { findEmployeeById, getAllEmployees } from '../../shared/scheduling/employees.js';
import { showToast } from '../../shared/toast.js';
import { pageHead, telOf } from '../../shared/ui.js';
import { changed, rerender } from './refresh.js';
import { notify } from '../notifications/store.js';

/* ==========================================================================
   พนักงานและทีม
   ========================================================================== */
export function peopleHtml() {
  const teams = ['ALL', 'Shift A', 'Shift B', 'Shift C', 'Shift D'];
  const all = getAllEmployees();
  const term = state.employeeSearch.trim().toLowerCase();
  const list = all.filter(e => (state.employeeTeamFilter === 'ALL' || e.shiftType === state.employeeTeamFilter) && (!term || e.name.toLowerCase().includes(term) || e.id.toLowerCase().includes(term)));
  return `
    ${pageHead(`พนักงานและทีม <span class="count">${all.length}</span>`, '<button class="btn primary" data-click="openEmployeeForm()">เพิ่มพนักงาน</button>')}
    <div class="bar">
      <div class="seg" role="group" aria-label="ทีม">
        ${teams.map(t => `<button class="${state.employeeTeamFilter === t ? 'on' : ''}" aria-pressed="${state.employeeTeamFilter === t}" data-click="filterEmployeeTeam(${js(t)})">${t === 'ALL' ? 'ทั้งหมด' : `${t.replace('Shift ', '')} <span class="muted">${all.filter(e => e.shiftType === t).length}</span>`}</button>`).join('')}
      </div>
      <label class="sr" for="peopleQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" id="peopleQ" type="search" placeholder="ค้นหาชื่อหรือรหัส" value="${esc(state.employeeSearch)}" data-input="filterEmployeeSearch(this.value)" autocomplete="off">
    </div>
    ${list.length ? `
      <div class="panel flush tbl-wrap">
        <table class="tbl">
          <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ทีม</th><th>ตำแหน่ง</th><th>โทรศัพท์</th><th><span class="sr">แก้ไข</span></th></tr></thead>
          <tbody>
            ${list.map(e => `
              <tr>
                <td class="num muted">${esc(e.id)}</td>
                <th scope="row">${esc(e.name)}</th>
                <td>${esc(e.shiftType)}</td>
                <td>${esc(e.position || (e.roleCategory === 'Shift Supervisor' ? 'Shift Supervisor (S)' : 'Shift Operator'))}</td>
                <td>${telOf(e.phone)}</td>
                <td class="act"><button class="btn ghost sm" data-click="openEmployeeForm(${js(e.id)})">แก้ไข</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">ไม่พบพนักงานตามตัวกรอง</p>'}`;
}
export function filterEmployeeTeam(t) { state.employeeTeamFilter = t; rerender(); }
export function filterEmployeeSearch(v) { state.employeeSearch = v; rerender(); }

export function openEmployeeForm(employeeId = '') {
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  const sel = (cond) => (cond ? 'selected' : '');
  const body = `
    <form id="employeeForm" data-submit="saveEmployeeProfile(${js(employeeId)})">
      <div class="form-group">
        <label for="employeeCode">รหัสพนักงาน</label>
        <input id="employeeCode" class="form-control" value="${esc(employee ? employee.id : '')}" required ${employee ? 'disabled' : ''}>
      </div>
      <div class="form-group">
        <label for="employeeName">ชื่อ-นามสกุล</label>
        <input id="employeeName" class="form-control" value="${esc(employee ? employee.name : '')}" required>
      </div>
      <div class="form-2col">
        <div class="form-group">
          <label for="employeeTeam">ทีม</label>
          <select id="employeeTeam" class="form-control">
            ${['Shift A', 'Shift B', 'Shift C', 'Shift D'].map(t => `<option value="${t}" ${sel(employee && employee.shiftType === t)}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="employeeRole">โครงสร้างตำแหน่ง</label>
          <select id="employeeRole" class="form-control">
            <option value="Shift Supervisor (S)" ${sel(employee && (employee.position === 'Shift Supervisor (S)' || employee.roleCategory === 'Shift Supervisor'))}>หัวหน้ากะ (Shift Supervisor - S)</option>
            <option value="Boardman (DCS)" ${sel(employee && employee.position === 'Boardman (DCS)')}>พนักงานกะ: Boardman (DCS)</option>
            <option value="Field Operator" ${sel(!employee || (employee.position === 'Field Operator' || (!employee.position && employee.roleCategory !== 'Shift Supervisor')))}>พนักงานกะ: Field Operator</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="employeePhone">เบอร์ติดต่อ</label>
        <input id="employeePhone" class="form-control" value="${esc(employee && employee.phone !== '-' ? employee.phone : '')}" required>
      </div>
    </form>`;
  openModal(employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน', body, `
    <button class="btn btn-secondary" data-click="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" type="submit" form="employeeForm">บันทึกข้อมูล</button>`);
}
// LOCAL: แก้/เพิ่มพนักงานในเบราว์เซอร์ (ตอนต่อ API ให้ส่งไประบบหลังบ้านที่นี่)
export function saveEmployeeProfile(employeeId) {
  const code = ($('#employeeCode') || {}).value.trim();
  const name = ($('#employeeName') || {}).value.trim();
  const team = ($('#employeeTeam') || {}).value;
  const position = ($('#employeeRole') || {}).value;
  const phone = ($('#employeePhone') || {}).value.trim();
  if (!code || !name || !team || !position || !phone) { showToast('กรุณากรอกข้อมูลให้ครบ', 'alert'); return; }
  const roleCategory = position.includes('Supervisor') ? 'Shift Supervisor' : 'Shift Employee';
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  if (employee) {
    state.peopleEdits.byId[employee.id] = { ...(state.peopleEdits.byId[employee.id] || {}), name, phone, roleCategory, position, shiftType: team, initials: name.slice(0, 2) };
    const added = state.peopleEdits.added.find(e => e.id === employee.id);
    if (added) Object.assign(added, { name, phone, roleCategory, position, shiftType: team });
  } else {
    if (findEmployeeById(code)) { showToast('รหัสพนักงานนี้มีอยู่แล้ว', 'alert'); return; }
    state.peopleEdits.added.push({ id: code, code, name, phone, initials: name.slice(0, 2), roleCategory, position, shiftType: team });
  }
  closeModal();
  addLog(employee ? `แก้ไขข้อมูลพนักงาน ${name}` : `เพิ่มพนักงาน ${name} (${team})`);
  // แจ้งเจ้าตัว และหัวหน้ากะของทีม (ทั้งทีมเดิมและทีมใหม่ถ้าย้ายทีม)
  const teams = [team, employee && employee.shiftType].filter(Boolean).map(t => `sup:${t.slice(-1)}`);
  if (employee) notify([`emp:${employee.id}`, ...teams], 'ข้อมูลพนักงานถูกแก้ไข', `${name} (${employee.id}) · ${team}`);
  else notify(teams, 'มีพนักงานใหม่ในทีม', `${name} (${code}) · ${team}`);
  showToast(employee ? 'บันทึกข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว');
  rebuildSchedule();
  changed();
}
