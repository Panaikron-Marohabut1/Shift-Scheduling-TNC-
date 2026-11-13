import { api } from '../../api/client.js';
import { reloadLoadedYears } from '../../app/data.js';
import { state } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { closeModal, openModal } from '../../shared/modal.js';
import { pageHead } from '../../shared/ui.js';
import { rerender } from './refresh.js';

const path = '/manager/people';
const teams = ['A', 'B', 'C', 'D'];
const roles = { EMPLOYEE: 'พนักงานกะ', SUPERVISOR: 'หัวหน้ากะ' };
const positions = { FIELD_OPERATOR: 'Field Operator', BOARDMAN: 'Boardman (DCS)', SUPERVISOR: 'หัวหน้ากะ' };
const dateLabel = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });
const dateText = value => dateLabel.format(new Date(`${value}T12:00:00+07:00`));
let directory;

function canManagePeople() {
  return state.actor?.role === 'MANAGER' && state.actor.peopleManagement;
}

function getDirectory() {
  if (directory?.actor !== state.actor) directory = { actor: state.actor, result: null, loading: false, notice: '', error: '' };
  return directory;
}

function renderDirectory(current) {
  if (state.actor === current.actor && state.activeView === 'people') rerender();
}

export async function loadManagerPeople() {
  if (!canManagePeople()) return;
  const current = getDirectory();
  if (current.loading) return;
  current.loading = true;
  current.error = '';
  renderDirectory(current);
  try {
    current.result = await api(path);
  } catch (error) {
    current.error = error.message || 'โหลดรายชื่อพนักงานไม่สำเร็จ';
  } finally {
    current.loading = false;
    renderDirectory(current);
  }
}

export function centralPeopleHtml() {
  const { result, loading, notice, error } = getDirectory();
  const term = state.employeeSearch.trim().toLowerCase();
  const all = result?.people || [];
  const filtered = all.filter(person => (state.employeeTeamFilter === 'ALL' || state.employeeTeamFilter === `Shift ${person.teamCode}`)
    && (!term || person.name.toLowerCase().includes(term) || person.employeeCode.toLowerCase().includes(term)));
  return `<div id="central-people" aria-busy="${loading}">
    ${pageHead('พนักงานและทีม', `<button type="button" class="btn" data-click="loadManagerPeople()" ${loading ? 'disabled' : ''}>โหลดรายชื่อล่าสุด</button>`)}
    ${error ? `<p class="notice bad" role="alert">${esc(error)}</p>` : ''}
    ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
    ${!result && loading ? '<p class="muted" role="status">กำลังโหลดรายชื่อพนักงาน…</p>' : ''}
    ${result ? `<div class="bar">
      <div class="seg" role="group" aria-label="ทีม">
        ${['ALL', ...teams.map(team => `Shift ${team}`)].map(team => `<button type="button" class="${state.employeeTeamFilter === team ? 'on' : ''}" aria-pressed="${state.employeeTeamFilter === team}" data-click="filterEmployeeTeam(${js(team)})">${team === 'ALL' ? 'ทั้งหมด' : team.slice(-1)}</button>`).join('')}
      </div>
      <label class="sr" for="peopleQ">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" id="peopleQ" type="search" placeholder="ค้นหาชื่อหรือรหัส" value="${esc(state.employeeSearch)}" data-input="filterEmployeeSearch(this.value)" autocomplete="off">
    </div>
    ${filtered.length ? `<div class="panel flush tbl-wrap" data-scroll="central-people">
      <table class="tbl">
        <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ทีม</th><th>ตำแหน่ง</th><th>บทบาท</th><th><span class="sr">แก้ไข</span></th></tr></thead>
        <tbody>${filtered.map(person => `<tr data-employee-code="${esc(person.employeeCode)}">
          <td class="num muted">${esc(person.employeeCode)}</td><th scope="row">${esc(person.name)}</th>
          <td>Shift ${esc(person.teamCode)}${person.scheduledTransfer ? `<br><span class="small muted">ย้ายไป Shift ${esc(person.scheduledTransfer.teamCode)} ${esc(dateText(person.scheduledTransfer.effectiveOn))}</span>` : ''}</td>
          <td>${esc(positions[person.position] || person.position || '—')}</td><td>${esc(person.hasAccount ? roles[person.role] || '—' : 'ยังไม่เปิดสิทธิ์')}</td>
          <td class="act"><button type="button" class="btn ghost sm" data-click="editCentralEmployee(${js(person.employeeId)})">แก้ไข</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : '<p class="empty">ไม่พบพนักงานตามตัวกรอง</p>'}` : ''}
  </div>`;
}

const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;

export function syncCentralEmployeeFields(form) {
  const { role, position, teamCode, effectiveOn } = form.elements;
  const choices = role.value === 'SUPERVISOR' ? ['SUPERVISOR'] : ['FIELD_OPERATOR', 'BOARDMAN'];
  const selected = choices.includes(position.value) ? position.value : choices[0];
  position.replaceChildren(...choices.map(value => new Option(positions[value], value, false, value === selected)));
  effectiveOn.disabled = teamCode.value === form.dataset.currentTeam;
  effectiveOn.required = !effectiveOn.disabled;
}

export function editCentralEmployee(employeeId) {
  if (!canManagePeople()) return;
  const result = getDirectory().result;
  const person = result?.people.find(item => item.employeeId === Number(employeeId));
  if (!person) return;
  const role = person.role || (person.position === 'SUPERVISOR' ? 'SUPERVISOR' : 'EMPLOYEE');
  const body = `<form id="centralEmployeeForm" data-current-team="${esc(person.teamCode)}"
    data-version="${esc(person.version)}" data-change="syncCentralEmployeeFields(this)" data-submit="saveCentralEmployee(${js(person.employeeId)}, this)">
    <p class="employee-edit-person"><b>${esc(person.name)}</b><span class="small">${esc(person.employeeCode)}</span></p>
    <div class="employee-edit-grid">
      <div class="field"><label for="centralEmployeeTeam">ทีม</label>
        <select class="inp" id="centralEmployeeTeam" name="teamCode" ${person.scheduledTransfer ? 'disabled' : ''}>${teams.map(team => option(team, `Shift ${team}`, person.teamCode)).join('')}</select></div>
      <div class="field"><label for="centralEmployeeEffectiveOn">วันที่มีผลย้ายทีม</label>
        <input class="inp" id="centralEmployeeEffectiveOn" name="effectiveOn" type="date" min="${esc(result.today)}" value="${esc(result.today)}" aria-describedby="centralEmployeeHint" disabled></div>
      <div class="field"><label for="centralEmployeeRole">บทบาท</label>
        <select class="inp" id="centralEmployeeRole" name="role" ${person.hasAccount ? '' : 'disabled'}>${Object.entries(roles).map(([value, label]) => option(value, label, role)).join('')}</select></div>
      <div class="field"><label for="centralEmployeePosition">ตำแหน่ง</label>
        <select class="inp" id="centralEmployeePosition" name="position">${Object.entries(positions).map(([value, label]) => option(value, label, person.position)).join('')}</select></div>
    </div>
    ${person.scheduledTransfer ? `<p class="notice">กำหนดย้ายไป Shift ${esc(person.scheduledTransfer.teamCode)} วันที่ ${esc(dateText(person.scheduledTransfer.effectiveOn))} แล้ว</p>` : ''}
    ${person.hasAccount ? '' : '<p class="employee-edit-hint small">Admin กำหนดบทบาทครั้งแรกเมื่อพนักงานมีบัญชีเข้าใช้ระบบ</p>'}
    <p class="employee-edit-hint small" id="centralEmployeeHint">
      <span>วันที่มีผลใช้เฉพาะการย้ายทีม ตำแหน่งและบทบาทมีผลทันที</span>
      <span>จัดการตารางกะที่ประกาศแล้วแยกต่างหาก</span>
    </p>
    <div id="centralEmployeeError" aria-live="polite"></div>
  </form>`;
  openModal('แก้ไขข้อมูลพนักงาน', body, '<button class="btn" type="button" data-click="closeModal()">ยกเลิก</button><button class="btn primary" id="centralEmployeeSave" type="submit" form="centralEmployeeForm">บันทึกการเปลี่ยนแปลง</button>');
  syncCentralEmployeeFields($('#centralEmployeeForm'));
}

export async function saveCentralEmployee(employeeId, form) {
  if (!canManagePeople() || form.dataset.busy || !form.reportValidity()) return;
  const current = getDirectory();
  const fields = form.elements;
  const body = { teamCode: fields.teamCode.value, role: fields.role.value, position: fields.position.value,
    effectiveOn: fields.effectiveOn.value, expectedVersion: Number(form.dataset.version) };
  const button = $('#centralEmployeeSave');
  const feedback = $('#centralEmployeeError', form);
  form.dataset.busy = 'true';
  if (button) { button.disabled = true; button.textContent = 'กำลังบันทึก…'; }
  feedback.replaceChildren();
  try {
    const { person, today } = await api(`${path}/${Number(employeeId)}`, { method: 'PATCH', body });
    if (state.actor !== current.actor) return;
    current.result = { today, people: current.result.people.map(item => item.employeeId === person.employeeId ? person : item) };
    current.notice = `บันทึกข้อมูลของ ${person.name} แล้ว`;
    if (form.isConnected) closeModal();
    renderDirectory(current);
    try { await reloadLoadedYears(); } catch { /* The next roster refresh will retry. */ }
  } catch (error) {
    const rows = Array.isArray(error.details?.conflicts) ? error.details.conflicts : [];
    if (form.isConnected) {
      const alert = document.createElement('div');
      alert.className = 'notice bad';
      alert.setAttribute('role', 'alert');
      const message = document.createElement('p');
      message.textContent = error.message || 'บันทึกไม่สำเร็จ';
      alert.append(message);
      if (rows.length) {
        const list = document.createElement('ul');
        for (const row of rows) {
          const item = document.createElement('li');
          const status = ({ PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว' })[row.status] || row.status;
          item.textContent = `คำขอ ${row.requestId} · ${status}${row.workDate ? ` · ${dateText(row.workDate)}` : ''}`;
          list.append(item);
        }
        alert.append(list);
      }
      feedback.append(alert);
    }
  } finally {
    delete form.dataset.busy;
    if (button?.isConnected) { button.disabled = false; button.textContent = 'บันทึกการเปลี่ยนแปลง'; }
  }
}
