import { api } from '../../api/client.js';
import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { pageHead } from '../../shared/ui.js';

const path = '/admin/access';
export const labels = { MANAGER: 'ผู้จัดการ (Manager)', SUPERVISOR: 'หัวหน้ากะ (Supervisor)', EMPLOYEE: 'พนักงานกะ (Employee)' };
export const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
let queue;

function getQueue() {
  if (queue?.actor !== state.actor) queue = { actor: state.actor, users: null, pending: false, drafts: new Map(), error: '', notice: '' };
  return queue;
}

export async function loadAdminAccess(render) {
  if (state.actor?.role !== 'ADMIN') return;
  const current = getQueue();
  if (current.pending) return;
  current.pending = true;
  current.error = '';
  render();
  try {
    const result = await api(`${path}/pending`);
    current.users = result.users;
  } catch (error) {
    current.error = error.message || 'โหลดรายชื่อผู้รอกำหนดบทบาทไม่สำเร็จ';
  } finally {
    current.pending = false;
    if (state.actor === current.actor) render();
  }
}

export function updateAdminRole(userId, role) {
  if (state.actor?.role !== 'ADMIN' || !Object.hasOwn(labels, role)) return;
  getQueue().drafts.set(Number(userId), role);
}

export async function assignAdminRole(userId, form, render) {
  if (state.actor?.role !== 'ADMIN') return;
  const current = getQueue();
  const user = current.users?.find(item => item.userId === Number(userId));
  const role = form.elements.namedItem('role').value;
  if (!user || current.pending || !Object.hasOwn(labels, role)) return;
  current.drafts.set(user.userId, role);
  current.pending = true;
  current.error = '';
  current.notice = '';
  render();
  try {
    await api(`${path}/${user.userId}/assign`, { method: 'POST', body: { role } });
    current.users = current.users.filter(item => item.userId !== user.userId);
    current.drafts.delete(user.userId);
    current.notice = `กำหนดบทบาท ${labels[role]} ให้ ${user.name} แล้ว`;
  } catch (error) {
    current.error = error.message || 'กำหนดบทบาทไม่สำเร็จ กรุณาโหลดรายการล่าสุด';
  } finally {
    current.pending = false;
    if (state.actor === current.actor) render();
  }
}

export function adminAccessHtml() {
  const { users, pending, drafts, error, notice } = getQueue();
  const disabled = pending ? 'disabled' : '';
  const entries = (users || []).map(user => {
    const id = `admin-role-${user.userId}`;
    const selected = drafts.get(user.userId);
    return `<li class="people-access-row">
      <div class="rows-l"><b>${esc(user.name)}</b><span class="muted small">${esc(user.employeeCode)} · Shift ${esc(user.teamCode)}</span>
        <span class="muted small">เข้าสู่ระบบครั้งแรก ${esc(dateTime.format(new Date(user.requestedAt)))}</span></div>
      <form class="people-access-form" data-testid="admin-access-form" data-submit="assignAdminRole(${js(user.userId)}, this)">
        <div class="field"><label for="${esc(id)}">บทบาทเริ่มต้น</label>
          <select class="inp" id="${esc(id)}" name="role" required ${disabled} data-change="updateAdminRole(${js(user.userId)}, this.value)">
            <option value="" ${selected ? '' : 'selected'}>เลือกบทบาท</option>
            ${Object.entries(labels).map(([role, label]) => `<option value="${role}" ${role === selected ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn primary" ${disabled}>กำหนดบทบาท</button>
      </form>
    </li>`;
  }).join('');
  return `<div id="admin-access" aria-busy="${pending}">
    ${pageHead('กำหนดบทบาท', `<button type="button" class="btn" ${disabled} data-click="loadAdminAccess()">โหลดรายการล่าสุด</button>`)}
    <section class="panel" aria-labelledby="adminAccessTitle">
      <div class="panel-h"><h2 id="adminAccessTitle">ผู้รอสิทธิ์เข้าใช้ระบบ</h2></div>
      <p class="muted small">เลือกบทบาทเริ่มต้นให้บัญชีเดโม่ที่ยืนยันตัวตนและเข้าสู่ระบบครั้งแรกแล้ว</p>
      ${error ? `<p class="form-err" role="alert">${esc(error)}</p>` : ''}
      ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
      ${entries ? `<ul class="people-access-list">${entries}</ul>` : ''}
      ${!users && pending ? '<p class="muted small" role="status">กำลังโหลดรายชื่อ…</p>' : ''}
      ${users?.length === 0 && !pending ? '<p class="muted">ไม่มีบัญชีรอกำหนดบทบาท</p>' : ''}
    </section>
  </div>`;
}
