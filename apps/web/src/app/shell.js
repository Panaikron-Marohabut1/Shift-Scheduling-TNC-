/* ==========================================================================
   โครงหน้าจอ: เมนูซ้าย แถบบนและเมนูล่างบนมือถือ และตัวเลขแจ้งเตือนบนเมนู
   ========================================================================== */

import { state, view } from './state.js';
import { esc, js } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { currentEmp, isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { canUserReviewRequestForRole } from '../features/requests/permissions.js';

export const DATA_LABEL = 'เชื่อมฐานข้อมูลแล้ว';
/* ---------- เมนู ---------- */
const NAV_ICON = {
  'manager-monitoring': 'requests', people: 'people', 'annual-schedule': 'annual', 'manager-settings': 'settings',
  schedule: 'schedule', overview: 'overview', requests: 'requests', history: 'history',
  'team-schedule': 'my', 'my-shift': 'my', 'my-requests': 'requests', 'my-history': 'history',
  'hr-export': 'export', 'hr-audit': 'history', driver: 'driver'
};
const shortLabel = label => String(label).replace(/\s*\((Shift Schedule|Schedule|Annual Schedule|Settings)\)\s*$/, '');
export function navBadges() {
  const role = state.roles[state.activeRole];
  if (!role) return;
  const pending = state.requests.filter(r => r.status && r.status.includes('รอ'));
  role.nav.forEach(n => { n.badge = 0; });
  if (state.activeRole === 'Manager') role.nav[0].badge = pending.length;
  else if (isSupervisorRoleName(state.activeRole)) { const n = role.nav.find(x => x.id === 'requests'); if (n) n.badge = state.requests.filter(r => canUserReviewRequestForRole(r, state.activeRole)).length; }
  else if (state.activeRole === 'Shift Employee') {
    const me = currentEmp();
    const n = role.nav.find(x => x.id === 'my-requests');
    if (n) n.badge = state.requests.filter(r => (r.requesterId === (me && me.id) || r.person === (me && me.name) || r.targetPerson === (me && me.name)) && r.status && r.status.includes('รอ')).length;
  }
}
function navList() {
  const role = state.roles[state.activeRole];
  if (state.activeRole === 'Contractor / Van Driver') return [{ id: 'driver', label: 'ตารางรับส่งพนักงาน', icon: 'driver' }];
  const items = (role ? role.nav : []).map(n => ({ id: n.id, label: shortLabel(n.label), icon: NAV_ICON[n.id], badge: n.badge }));
  // หัวหน้ากะก็เป็นพนักงาน: มี "กะของฉัน" และยื่นคำขอของตัวเองได้
  if (isSupervisorRoleName(state.activeRole)) items.splice(1, 0, { id: 'my-shift', label: 'กะของฉัน', icon: 'my' });
  // พนักงาน: ตารางกะรวมเป็นเมนูแยก
  if (state.activeRole === 'Shift Employee') items.splice(1, 0, { id: 'schedule', label: 'ตารางกะ', icon: 'schedule' });
  return items;
}

export function shellHtml(content) {
  const items = navList();
  const active = state.activeRole === 'Contractor / Van Driver' ? 'driver'
    : (isSupervisorRoleName(state.activeRole) && state.activeView === 'my-requests') ? 'requests'
      : (state.activeRole === 'Manager' && state.activeView === 'schedule') ? 'annual-schedule'
        : (state.activeView === 'team-schedule' && state.operatorShowFullGrid) ? 'schedule' : state.activeView;
  const role = state.roles[state.activeRole] || {};
  const btn = it => `<button class="${it.id === active ? 'on' : ''}" data-click="SF.nav(${js(it.id)})" title="${esc(it.label)}" ${it.id === active ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${esc(it.label)}</span>${it.badge ? `<em class="badge">${it.badge}</em>` : ''}</button>`;
  const many = items.length > 4;
  const bottom = many ? items.slice(0, 3) : items;
  const more = many ? items.slice(3) : [];
  const rail = view.mode === 'month' && (state.activeView === 'schedule' || (state.activeView === 'team-schedule' && state.operatorShowFullGrid));
  return `
    <div class="shell ${rail ? 'rail' : ''}">
      <aside class="side">
        <div class="side-brand"><b>ShiftFlow</b><i class="brand-short" aria-hidden="true">SF</i><span>ฝ่ายผลิต</span></div>
        <nav class="side-nav" aria-label="เมนูหลัก">${items.map(btn).join('')}</nav>
        <div class="side-foot">
          <button class="side-user" data-click="SF.account()"><b>${esc(role.name)}</b><span>${esc(role.title)}</span></button>
          <span class="sync"><i class="dot ok"></i>${esc(DATA_LABEL)}</span>
        </div>
      </aside>
      <div class="main">
        <header class="mtop">
          <div class="mtop-brand">ShiftFlow</div>
          <button class="mtop-user" data-click="SF.account()">${esc(role.name)}</button>
        </header>
        <main class="page" id="main">${content}</main>
      </div>
      ${items.length > 1 ? `
        <nav class="bottom" aria-label="เมนูหลัก">
          ${bottom.map(btn).join('')}
          ${many ? `<button class="${more.some(i => i.id === active) ? 'on' : ''}" data-click="SF.more()">${icon('more')}<span>อื่น ๆ</span></button>` : ''}
        </nav>
        ${many && view.moreNav ? `<div class="more-sheet">${more.map(btn).join('')}</div>` : ''}` : ''}
    </div>`;
}

export const titleOf = id => shortLabel((navList().find(n => n.id === id) || {}).label || '');
