/* ==========================================================================
   โครงหน้าจอ: เมนูซ้าย แถบบนและเมนูล่างบนมือถือ และตัวเลขแจ้งเตือนบนเมนู
   ========================================================================== */

import { state, view } from './state.js';
import { esc, js } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { unreadCount } from '../features/notifications/store.js';
import { canUserReviewRequestForRole, getVisibleRequests } from '../features/requests/permissions.js';

export const DATA_LABEL = 'เชื่อมฐานข้อมูลแล้ว';
/* ---------- เมนูซ้าย ----------
   จอที่ใช้เมาส์ (กว้างกว่า 760px): แถบไอคอน ชี้เมาส์แล้วขยาย เอาเมาส์ออกแล้วหุบช้า ๆ (CSS ล้วน)
   จอสัมผัสและมือถือ: กดปุ่มเพื่อเปิดเมนูซ้อนทับ (view.sideOpen) */
export const HOVER_SIDE = '(min-width: 761px) and (hover: hover) and (pointer: fine)';
// จำว่าเมาส์อยู่บนเมนูไหม: หน้าจอถูกวาดใหม่ทั้งหน้า (เช่นกดเมนู) เมนูจะได้ไม่หุบแล้วกางใหม่
let sideHover = false;
function setSideHover(on) {
  if (sideHover === on) return;
  sideHover = on;
  document.querySelector('.shell')?.classList.toggle('side-hover', on);
}
export function bindSideHover() {
  const hoverable = () => typeof matchMedia === 'function' && matchMedia(HOVER_SIDE).matches;
  document.addEventListener('pointerover', ev => {
    if (ev.pointerType === 'mouse' && hoverable() && ev.target.closest?.('.side')) setSideHover(true);
  });
  document.addEventListener('pointerout', ev => {
    if (ev.pointerType !== 'mouse' || !ev.target.closest?.('.side')) return;
    if (!ev.relatedTarget?.closest?.('.side')) setSideHover(false);
  });
  document.documentElement.addEventListener('pointerleave', () => setSideHover(false));
}
// ป้ายเมนูล่างบนมือถือ: สั้นพอให้อยู่บรรทัดเดียว (ชื่อเต็มอยู่ใน aria-label/title)
const MOBILE_LABEL = {
  'manager-monitoring': 'คำขอ', requests: 'คิวตรวจ', 'my-requests': 'คำขอ', history: 'ประวัติ', 'my-history': 'ประวัติ',
  overview: 'ภาพรวม', people: 'ทีม', 'manager-settings': 'โควตา', 'annual-schedule': 'ทั้งปี', 'hr-audit': 'ประวัติ',
  'hr-export': 'ส่งออก', 'admin-access': 'บทบาท', 'admin-accounts': 'บัญชี', driver: 'รับส่ง'
};
/* ---------- เมนู ---------- */
const NAV_ICON = {
  'admin-access': 'people', 'admin-accounts': 'people',
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
    const n = role.nav.find(x => x.id === 'my-requests');
    if (n) n.badge = getVisibleRequests().filter(r => r.status && r.status.includes('รอ')).length;
  }
}
function navList() {
  const role = state.roles[state.activeRole];
  const items = (role ? role.nav : []).map(n => ({ id: n.id, label: shortLabel(n.label), icon: NAV_ICON[n.id], badge: n.badge }));
  if (state.activeRole === 'Admin') return items;
  const bell = { id: 'notifications', label: 'แจ้งเตือน', icon: 'bell', badge: unreadCount() };
  if (state.activeRole === 'Contractor / Van Driver') return [{ id: 'driver', label: 'ตารางรับส่งพนักงาน', icon: 'driver' }, bell];
  // หัวหน้ากะก็เป็นพนักงาน: มี "กะของฉัน" และยื่นคำขอของตัวเองได้
  if (isSupervisorRoleName(state.activeRole)) items.splice(1, 0, { id: 'my-shift', label: 'กะของฉัน', icon: 'my' });
  // พนักงาน: ตารางกะรวมเป็นเมนูแยก
  if (state.activeRole === 'Shift Employee') items.splice(1, 0, { id: 'schedule', label: 'ตารางกะ', icon: 'schedule' });
  items.push(bell); // แจ้งเตือนอยู่ท้ายเมนูซ้ายเสมอ (บนมือถืออยู่มุมขวาบน)
  return items;
}

export function shellHtml(content) {
  const items = navList();
  const active = state.activeView === 'notifications' ? 'notifications'
    : state.activeRole === 'Contractor / Van Driver' ? 'driver'
    : (isSupervisorRoleName(state.activeRole) && state.activeView === 'my-requests') ? 'requests'
      : (state.activeRole === 'Manager' && state.activeView === 'schedule' && !state.actor?.remotePilot) ? 'annual-schedule'
        : (state.activeView === 'team-schedule' && state.operatorShowFullGrid) ? 'schedule' : state.activeView;
  const role = state.roles[state.activeRole] || {};
  // ตัวเลขแจ้งเตือน 2 ตำแหน่ง: มุมไอคอน (ตอนเมนูหุบ) และชิดขวาของแถว (ตอนขยาย) — CSS สลับให้เห็นทีละอัน
  const btn = it => `<button class="${it.id === active ? 'on' : ''}" data-click="SF.nav(${js(it.id)})" ${it.id === active ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${esc(it.label)}</span>${it.badge ? `<em class="badge nb-dot" aria-hidden="true">${it.badge}</em><em class="badge nb-end">${it.badge}</em>` : ''}</button>`;
  const tab = it => `<button class="${it.id === active ? 'on' : ''}" data-click="SF.nav(${js(it.id)})" aria-label="${esc(it.label)}" ${it.id === active ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${esc(MOBILE_LABEL[it.id] || it.label)}</span>${it.badge ? `<em class="badge">${it.badge}</em>` : ''}</button>`;
  // วงกลมบัญชี: รหัสท้ายชื่อ (A0, B1) ถ้ามี ไม่งั้นใช้อักษรแรกของชื่อ
  const roleName = String(role.name || '').replace(/^(คุณ|นาย|นางสาว|นาง)\s*/, '').trim();
  const initial = (/\b([A-Z]\d{1,2})$/.exec(roleName) || [])[1] || roleName.charAt(0) || '?';
  const bellItem = items.find(i => i.id === 'notifications');
  const mobile = items.filter(i => i.id !== 'notifications'); // บนมือถือ แจ้งเตือนอยู่ที่แถบบน
  const many = mobile.length > 4;
  const bottom = many ? mobile.slice(0, 3) : mobile;
  const more = many ? mobile.slice(3) : [];
  const rail = view.mode === 'month' && (state.activeView === 'schedule' || (state.activeView === 'team-schedule' && state.operatorShowFullGrid));
  const toggleLabel = view.sideOpen ? 'ปิดเมนู' : 'เปิดเมนู';
  return `
    <div class="shell ${rail ? 'rail' : ''} ${view.sideOpen ? 'side-open' : ''} ${sideHover ? 'side-hover' : ''}">
      <aside class="side" id="sideMenu">
        <div class="side-brand">
          <img class="brand-mark" src="/assets/tnc-logo.png" alt="TNC" width="32" height="32">
          <div class="side-brand-text side-fade"><b>ShiftFlow</b><span>${state.actor?.remotePilot ? 'รอบทดสอบสลับกะ' : 'ฝ่ายผลิต'}</span></div>
        </div>
        <button class="side-toggle" data-click="SF.side()" aria-controls="sideMenu" aria-expanded="${view.sideOpen}">${icon(view.sideOpen ? 'x' : 'sidebar')}<span>${toggleLabel}</span></button>
        <nav class="side-nav" aria-label="เมนูหลัก">${items.map(btn).join('')}</nav>
        <div class="side-foot">
          <button class="side-user" data-click="SF.account()" title="บัญชีของฉัน"><i class="avatar" aria-hidden="true">${esc(initial)}</i><span class="side-fade"><b>${esc(role.name)}</b><small>${esc(role.title)}</small></span></button>
        </div>
      </aside>
      <div class="main">
        <header class="mtop">
          <button class="mtop-menu" data-click="SF.side()" aria-controls="sideMenu" aria-expanded="${view.sideOpen}" aria-label="${toggleLabel}">${icon(view.sideOpen ? 'x' : 'menu')}</button>
          <div class="mtop-brand">${state.actor?.remotePilot ? 'ShiftFlow Pilot' : 'ShiftFlow'}</div>
          <div class="mtop-r">
            ${bellItem ? `<button class="mtop-bell ${active === 'notifications' ? 'on' : ''}" data-click="SF.nav('notifications')" aria-label="แจ้งเตือน${bellItem.badge ? ` ยังไม่อ่าน ${bellItem.badge} รายการ` : ''}">${icon('bell')}${bellItem.badge ? `<em class="badge">${bellItem.badge}</em>` : ''}</button>` : ''}
            <button class="mtop-user" data-click="SF.account()">${esc(role.name)}</button>
          </div>
        </header>
        <main class="page" id="main">${content}</main>
      </div>
      ${view.sideOpen ? '<div class="side-scrim" data-click="SF.side(false)" aria-hidden="true"></div>' : ''}
      ${mobile.length > 1 ? `
        <nav class="bottom" aria-label="เมนูหลัก">
          ${bottom.map(tab).join('')}
          ${many ? `<button class="${more.some(i => i.id === active) ? 'on' : ''}" data-click="SF.more()" aria-expanded="${!!view.moreNav}">${icon('more')}<span>อื่น ๆ</span></button>` : ''}
        </nav>
        ${many && view.moreNav ? `<div class="more-sheet">${more.map(btn).join('')}</div>` : ''}` : ''}
    </div>`;
}

export const titleOf = id => shortLabel((navList().find(n => n.id === id) || {}).label || '');
