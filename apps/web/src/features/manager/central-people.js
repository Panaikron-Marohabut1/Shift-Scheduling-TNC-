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
    ${filtered.length ? `<div class="panel flush tbl-wrap people-table-wrap" data-scroll="central-people" role="region" aria-label="รายชื่อพนักงาน" tabindex="0">
      <table class="tbl people-table">
        <thead><tr><th scope="col">พนักงาน</th><th scope="col" class="people-team">ทีม</th><th scope="col" class="people-role">บทบาท</th><th scope="col" class="people-position">ตำแหน่ง</th><th scope="col" class="act"><span class="sr">แก้ไข</span></th></tr></thead>
        <tbody>${filtered.map(person => `<tr data-employee-code="${esc(person.employeeCode)}">
          <th scope="row">${esc(person.name)}<span class="people-meta">${esc(person.employeeCode)}</span></th>
          <td>Shift ${esc(person.teamCode)}${person.productionExitOn ? `<span class="people-meta">ย้ายออกจากฝ่ายผลิต <time datetime="${esc(person.productionExitOn)}">${esc(dateText(person.productionExitOn))}</time></span>` : person.scheduledTransfer ? `<span class="people-meta">ย้ายไป Shift ${esc(person.scheduledTransfer.teamCode)}<br><time datetime="${esc(person.scheduledTransfer.effectiveOn)}">${esc(dateText(person.scheduledTransfer.effectiveOn))}</time></span>` : ''}</td>
          <td>${person.hasAccount ? esc(roles[person.role] || '—') : '<span class="st wait">ยังไม่เปิดสิทธิ์</span>'}</td>
          <td ${person.hasAccount && roles[person.role] === (positions[person.position] || person.position) ? 'data-same-as-role' : ''}>${esc(positions[person.position] || person.position || '—')}</td>
          <td class="act">${person.productionExitOn ? '' : `<button type="button" class="btn sm" data-click="editCentralEmployee(${js(person.employeeId)})">แก้ไข</button>`}</td>
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
        <select class="inp" id="centralEmployeeRole" name="role" aria-describedby="centralEmployeeRoleHint" ${person.hasAccount ? '' : 'disabled'}>${Object.entries(roles).map(([value, label]) => option(value, label, role)).join('')}</select>
        <p class="employee-edit-hint small" id="centralEmployeeRoleHint">กำหนดสิทธิ์การเข้าถึงและสิ่งที่ทำได้ในระบบ</p></div>
      <div class="field"><label for="centralEmployeePosition">ตำแหน่ง</label>
        <select class="inp" id="centralEmployeePosition" name="position" aria-describedby="centralEmployeePositionHint">${Object.entries(positions).map(([value, label]) => option(value, label, person.position)).join('')}</select>
        <p class="employee-edit-hint small" id="centralEmployeePositionHint">ระบุตำแหน่งหน้างาน</p></div>
    </div>
    ${person.scheduledTransfer ? `<p class="notice">กำหนดย้ายไป Shift ${esc(person.scheduledTransfer.teamCode)} วันที่ ${esc(dateText(person.scheduledTransfer.effectiveOn))} แล้ว</p>` : ''}
    ${person.hasAccount ? '' : '<p class="employee-edit-hint small">Admin กำหนดบทบาทครั้งแรกเมื่อพนักงานมีบัญชีเข้าใช้ระบบ</p>'}
    <p class="employee-edit-hint employee-edit-timing small" id="centralEmployeeHint">
      <span>วันที่เลือกใช้กับการย้ายทีม บทบาทและตำแหน่งมีผลทันทีเมื่อบันทึก</span>
      <span>ตารางกะที่ประกาศแล้วต้องปรับแยกต่างหาก</span>
    </p>
    <div id="centralEmployeeError" aria-live="polite"></div>
  </form>`;
  const exitAction = result.productionExitAvailable && !person.scheduledTransfer && !person.productionExitOn
    ? `<button class="btn danger" type="button" data-click="openProductionExit(${js(person.employeeId)})">ย้ายออกจากฝ่ายผลิต</button>` : '';
  openModal('แก้ไขข้อมูลพนักงาน', body, `${exitAction}<button class="btn" type="button" data-click="closeModal()">ยกเลิก</button><button class="btn primary" id="centralEmployeeSave" type="submit" form="centralEmployeeForm">บันทึกการเปลี่ยนแปลง</button>`);
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
    current.result = { ...current.result, today, people: current.result.people.map(item => item.employeeId === person.employeeId ? person : item) };
    current.notice = `บันทึกข้อมูลของ ${person.name} แล้ว`;
    if (form.isConnected) closeModal();
    renderDirectory(current);
    try { await reloadLoadedYears(); } catch { /* The next roster refresh will retry. */ }
  } catch (error) {
    if (form.isConnected) feedback.replaceChildren(peopleError(error.message || 'บันทึกไม่สำเร็จ', error.details?.conflicts));
  } finally {
    delete form.dataset.busy;
    if (button?.isConnected) { button.disabled = false; button.textContent = 'บันทึกการเปลี่ยนแปลง'; }
  }
}

function textElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function peopleError(message, conflicts) {
  const alert = document.createElement('div');
  alert.className = 'notice bad';
  alert.setAttribute('role', 'alert');
  alert.append(textElement('p', message));
  if (Array.isArray(conflicts) && conflicts.length) {
    const list = document.createElement('ul');
    for (const row of conflicts) {
      const status = ({ PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว' })[row.status] || row.status;
      list.append(textElement('li', `คำขอ ${row.requestId} · ${status}${row.workDate ? ` · ${dateText(row.workDate)}` : ''}`));
    }
    alert.append(list);
  }
  return alert;
}

function showProductionExitPreview(feedback, preview) {
  const summary = textElement('p', 'กะทำงานที่ได้รับผล ');
  summary.append(textElement('strong', `${preview.shifts.length} กะ`));
  feedback.replaceChildren(summary);
  if (preview.shifts.length) {
    const details = document.createElement('details');
    const list = document.createElement('ul');
    for (const shift of preview.shifts) list.append(textElement('li', `${dateText(shift.workDate)} · ${shift.shiftCode}`));
    details.append(textElement('summary', 'ดูกะที่ได้รับผล'), list);
    feedback.append(details);
  }
  if (preview.conflicts.length) feedback.append(peopleError('จัดการคำขอเหล่านี้ก่อนยืนยันการย้ายออก', preview.conflicts));
}

export function openProductionExit(employeeId) {
  if (!canManagePeople()) return;
  const current = getDirectory(), directory = current.result;
  const person = directory?.people.find(item => item.employeeId === Number(employeeId));
  if (!directory?.productionExitAvailable || !person || person.scheduledTransfer || person.productionExitOn) return;
  const endpoint = `${path}/${person.employeeId}/production-exit`;
  openModal('ย้ายออกจากฝ่ายผลิต', `
    <form id="productionExitForm">
      <p class="employee-edit-person"><b>${esc(person.name)}</b><span class="small">${esc(person.employeeCode)} · Shift ${esc(person.teamCode)}</span></p>
      <div class="field"><label for="productionExitDate">วันที่มีผล</label>
        <input class="inp" id="productionExitDate" type="date" min="${esc(directory.today)}" value="${esc(directory.today)}" required></div>
      <p class="small muted">วันที่มีผลจะสิ้นสุดสิทธิ์ฝ่ายผลิตและออกจากตารางกะ ประวัติก่อนวันย้ายยังอยู่</p>
      <div id="productionExitPreview" aria-live="polite"></div>
    </form>`, `<button class="btn" type="button" data-click="editCentralEmployee(${js(person.employeeId)})">ย้อนกลับ</button>
    <button class="btn" type="submit" form="productionExitForm" id="previewProductionExit">ตรวจผลกระทบ</button>
    <button class="btn danger" type="button" id="confirmProductionExit" disabled>ยืนยันการย้ายออก</button>`);

  const form = $('#productionExitForm'), date = $('#productionExitDate', form);
  const feedback = $('#productionExitPreview', form), check = $('#previewProductionExit'), confirm = $('#confirmProductionExit');
  let preview;
  const setBusy = busy => {
    date.disabled = busy;
    check.disabled = busy;
    confirm.disabled = busy || !preview || preview.conflicts.length > 0;
  };
  date.addEventListener('input', () => {
    preview = null;
    feedback.replaceChildren();
    setBusy(false);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (date.disabled || !form.reportValidity()) return;
    const effectiveOn = date.value;
    preview = null;
    setBusy(true);
    feedback.textContent = 'กำลังตรวจผลกระทบ…';
    try {
      preview = await api(`${endpoint}?effectiveOn=${encodeURIComponent(effectiveOn)}`);
      showProductionExitPreview(feedback, preview);
    } catch (error) {
      feedback.replaceChildren(peopleError(error.message));
    } finally { setBusy(false); }
  });
  confirm.addEventListener('click', async () => {
    if (confirm.disabled || !preview || date.value !== preview.effectiveOn) return;
    setBusy(true);
    try {
      await api(endpoint, { method: 'POST', body: { effectiveOn: preview.effectiveOn, expectedVersion: preview.version } });
      if (state.actor !== current.actor) return;
      if (form.isConnected) closeModal();
      current.notice = `บันทึกการย้ายออกของ ${person.name} วันที่ ${dateText(preview.effectiveOn)} แล้ว`;
      await Promise.all([loadManagerPeople(), reloadLoadedYears()]);
    } catch (error) {
      preview = null;
      feedback.replaceChildren(peopleError(error.message, error.details?.conflicts));
    } finally { if (form.isConnected) setBusy(false); }
  });
}
