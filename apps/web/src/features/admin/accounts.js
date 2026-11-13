import { api } from '../../api/client.js';
import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { pageHead } from '../../shared/ui.js';
import { dateTime, labels } from './access.js';

const roleLabels = { ...labels, ADMIN: 'ผู้ดูแลสิทธิ์ (Admin)', HR: 'ฝ่ายบุคคล (HR)', EXTERNAL: 'ผู้ใช้ภายนอก' };
const statusLabels = {
  ACTIVE: 'เปิดใช้งาน', PENDING: 'รอกำหนดบทบาท', WAITING_LOGIN: 'รอเข้าสู่ระบบครั้งแรก',
  UNLINKED: 'ยังไม่ได้ผูกบัญชี', INACTIVE: 'ปิดใช้งาน'
};
let directory;

function getDirectory() {
  if (directory?.actor !== state.actor) {
    directory = { actor: state.actor, result: null, loading: false, error: '', mode: 'accounts', search: '' };
  }
  return directory;
}

export async function loadAdminAccounts(render) {
  if (state.actor?.role !== 'ADMIN') return;
  const current = getDirectory();
  if (current.loading) { render(); return; }
  current.loading = true;
  current.error = '';
  render();
  try {
    current.result = await api('/admin/access/accounts');
  } catch (error) {
    current.error = error.message || 'โหลดบัญชีผู้ใช้ไม่สำเร็จ';
  } finally {
    current.loading = false;
    if (current.actor === state.actor && state.activeView === 'admin-accounts') render();
  }
}

export function showAdminAccounts(mode, render) {
  if (state.actor?.role !== 'ADMIN' || !['accounts', 'grants'].includes(mode)) return;
  getDirectory().mode = mode;
  render();
}

export function searchAdminAccounts(value, render) {
  if (state.actor?.role !== 'ADMIN') return;
  getDirectory().search = value;
  render();
}

export function adminAccountsHtml() {
  const { result, loading, error, mode, search } = getDirectory();
  const history = mode === 'grants';
  const term = search.trim().toLowerCase();
  const rows = result?.[mode].filter(row => `${row.name || ''} ${row.employeeCode || ''}`.toLowerCase().includes(term));
  return `<div id="admin-accounts" aria-busy="${loading}">
    ${pageHead('บัญชีผู้ใช้', `<button type="button" class="btn" ${loading ? 'disabled' : ''} data-click="loadAdminAccounts()">โหลดรายการล่าสุด</button>`)}
    <div class="bar">
      <div class="seg" role="group" aria-label="มุมมองบัญชีผู้ใช้">
        <button id="adminAccountsList" type="button" class="${history ? '' : 'on'}" aria-pressed="${!history}" data-click="showAdminAccounts('accounts')">บัญชีทั้งหมด</button>
        <button id="adminAccountsGrants" type="button" class="${history ? 'on' : ''}" aria-pressed="${history}" data-click="showAdminAccounts('grants')">ให้สิทธิ์ล่าสุด</button>
      </div>
      <label class="sr" for="adminAccountSearch">ค้นหาชื่อหรือรหัสพนักงาน</label>
      <input class="inp q" type="search" id="adminAccountSearch" value="${esc(search)}" placeholder="ค้นหาชื่อหรือรหัส" data-input="searchAdminAccounts(this.value)">
    </div>
    ${error ? `<p class="notice bad" role="alert">${esc(error)}</p>` : ''}
    ${!result && loading ? '<p class="muted" role="status">กำลังโหลดข้อมูล…</p>' : ''}
    ${rows?.length ? `<div class="panel flush tbl-wrap" data-scroll="admin-accounts">
      <table class="tbl admin-accounts-table">
        <thead><tr><th scope="col">บัญชี</th><th scope="col">${history ? 'บทบาทที่ได้รับ' : 'บทบาทปัจจุบัน'}</th><th scope="col">${history ? 'ให้สิทธิ์โดย' : 'สถานะ'}</th>${history ? '<th scope="col">วันที่ให้สิทธิ์</th>' : ''}</tr></thead>
        <tbody>${rows.map(row => `<tr>
          <th scope="row">${esc(row.name || 'บัญชีเดโม่')}<span class="admin-account-meta small">${esc([row.employeeCode, row.teamCode && `Shift ${row.teamCode}`].filter(Boolean).join(' · '))}</span></th>
          <td>${esc(roleLabels[row.role] || '—')}</td>
          ${history ? `<td>${esc(row.grantedBy || '—')}</td><td>${esc(dateTime.format(new Date(row.grantedAt)))}</td>` : `<td>${esc(statusLabels[row.status] || '—')}</td>`}
        </tr>`).join('')}</tbody>
      </table>
    </div>` : rows ? `<p class="empty">${term ? 'ไม่พบรายการตามคำค้น' : history ? 'ยังไม่มีประวัติการให้สิทธิ์ครั้งแรก' : 'ยังไม่มีบัญชีเดโม่ในระบบ'}</p>` : ''}
  </div>`;
}
