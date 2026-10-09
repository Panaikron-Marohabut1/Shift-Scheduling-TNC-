/* ==========================================================================
   ShiftFlow — จุดเริ่มของหน้าเว็บ
   --------------------------------------------------------------------------
   โครงหน้าจอ (เมนูซ้าย / แถบบนและล่างบนมือถือ), เส้นทางระหว่างหน้า, การเข้า-ออกระบบ
   และคำสั่งของปุ่มทั้งหมด (ลงทะเบียนกับ dispatcher ใน shared/dom.js)
   ========================================================================== */
import { api } from '../api/client.js';
import { state, view, DEMO_TODAY, loadLocal, saveLocal, clearLocal } from './state.js';
import { buildRole, roleKeyOf } from './profiles.js';
import { loadYear, refreshAll, reloadLoadedYears, resetData, merge } from './data.js';
import { $, esc, js, icon, register, openModal, closeModal, modalOpen, translateTree, watchTranslate, showToast } from '../shared/dom.js';
import { daysIn, isSupervisorRoleName, seedYearData, currentEmp, clearPatternCache, isMonthLocked, isYearPublished } from '../shared/scheduling.js';
import { scheduleHtml, codesModal } from '../features/schedule/view.js';
import { openCell } from '../features/schedule/cell.js';
import { myHtml } from '../features/schedule/my-shift.js';
import { overviewHtml } from '../features/schedule/overview.js';
import {
  newRequestModal, openForm, renderForm, onSubmitted, LOCKED_NOTE, submitColleagueSwapRequest, submitOperatorShiftRequest, submitLeaveRequest,
  submitDayOffChangeRequest, submitOTRequest, submitPublicHolidayChoice
} from '../features/requests/forms.js';
import {
  requestsHtml, openRequestDetails, approveRequest, promptRejectRequest, confirmRejectRequest, withdrawRequest, resetTestcases,
  onRequestChanged, canUserReviewRequestForRole
} from '../features/requests/view.js';
import { historyHtml } from '../features/history/view.js';
import {
  peopleHtml, annualHtml, settingsHtml, onManagerChange, filterEmployeeTeam, filterEmployeeSearch, openEmployeeForm, saveEmployeeProfile,
  jumpAnnualYear, jumpAnnualYearTo, updateAnnualTeamFamily, addAnnualHoliday, holidayKey, removeAnnualHoliday, pubAsk, publishYear, unpubAsk,
  unpublishYear, updateManagerShiftTime, updateManagerRule
} from '../features/manager/view.js';
import { hrHtml, exportMonthlyCSV, exportLeaveRecordsCSV, exportOTRecordsCSV, exportYear } from '../features/hr/view.js';
import { driverHtml, acknowledgeDriverSchedule, onDriverChange } from '../features/external/view.js';
import { loginHtml, signIn } from '../features/session/view.js';

const DATA_LABEL = 'เชื่อมฐานข้อมูลแล้ว';
let ready = false;

/* ---------- เมนู ---------- */
const NAV_ICON = {
  'manager-monitoring': 'requests', people: 'people', 'annual-schedule': 'annual', 'manager-settings': 'settings',
  schedule: 'schedule', overview: 'overview', requests: 'requests', history: 'history',
  'team-schedule': 'my', 'my-shift': 'my', 'my-requests': 'requests', 'my-history': 'history',
  'hr-export': 'export', 'hr-audit': 'history', driver: 'driver'
};
const shortLabel = label => String(label).replace(/\s*\((Shift Schedule|Schedule|Annual Schedule|Settings)\)\s*$/, '');
function navBadges() {
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

function shellHtml(content) {
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

const titleOf = id => shortLabel((navList().find(n => n.id === id) || {}).label || '');
function viewHtml() {
  const r = state.activeRole, v = state.activeView;
  if (r === 'Contractor / Van Driver') return driverHtml();
  if (isSupervisorRoleName(r)) {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'my-shift') return myHtml();
    if (v === 'overview') return overviewHtml();
    if (v === 'requests' || v === 'my-requests') return requestsHtml(titleOf('requests') || 'คำขอ');
    if (v === 'history') return historyHtml(titleOf('history'));
  } else if (r === 'Shift Employee') {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'team-schedule') return state.operatorShowFullGrid ? scheduleHtml() : myHtml();
    if (v === 'my-requests') return requestsHtml(titleOf('my-requests'));
    if (v === 'my-history') return historyHtml(titleOf('my-history'));
  } else if (r === 'HR') {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'hr-export') return hrHtml();
    if (v === 'hr-audit') return historyHtml(titleOf('hr-audit'));
  } else if (r === 'Manager') {
    if (v === 'manager-monitoring') return requestsHtml(titleOf('manager-monitoring'));
    if (v === 'people') return peopleHtml();
    if (v === 'annual-schedule') return annualHtml();
    if (v === 'schedule') return scheduleHtml();
    if (v === 'manager-settings') return settingsHtml();
  }
  return '';
}

// คงเคอร์เซอร์และตำแหน่งเลื่อนไว้เมื่อวาดหน้าจอใหม่ (เช่น พิมพ์ในช่องค้นหา)
function capture() {
  const a = document.activeElement;
  const scroll = {};
  document.querySelectorAll('[data-scroll]').forEach(el => { scroll[el.dataset.scroll] = [el.scrollLeft, el.scrollTop]; });
  return { focus: a && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null, scroll };
}
function restore(k) {
  Object.keys(k.scroll).forEach(name => { const el = document.querySelector(`[data-scroll="${name}"]`); if (el) { el.scrollLeft = k.scroll[name][0]; el.scrollTop = k.scroll[name][1]; } });
  if (k.focus) {
    const el = document.getElementById(k.focus.id);
    if (el && el.closest('#app')) { el.focus({ preventScroll: true }); try { if (k.focus.s != null) el.setSelectionRange(k.focus.s, k.focus.e); } catch { /* ช่องที่ไม่รองรับ */ } }
  }
}

// โหลดตารางของปีที่กำลังดูถ้ายังไม่มี แล้ววาดใหม่
const pendingYears = {};
function ensureYears() {
  if (state.actor && state.actor.role === 'EXTERNAL') return; // ผู้ใช้ภายนอกไม่โหลดตารางพนักงาน
  [state.currentYear, state.annualScheduleYear].forEach(y => {
    if (pendingYears[y] !== undefined) return;
    pendingYears[y] = loadYear(y).then(() => { if (view.signed) renderApp(); }).catch(() => { delete pendingYears[y]; });
  });
}

export function renderApp() {
  const app = $('#app');
  if (!app || !ready) return;
  if (!view.signed) { app.innerHTML = loginHtml(); return; }
  if (view.loading) { app.innerHTML = '<p class="boot">กำลังโหลดข้อมูล…</p>'; return; }
  ensureYears();
  navBadges();
  const k = capture();
  app.innerHTML = shellHtml(viewHtml());
  translateTree(app);
  restore(k);
  saveLocal();
}

/* ---------- เปลี่ยนหน้า เดือน และมุมมอง ---------- */
function switchView(id) { state.activeView = id; view.moreNav = false; state.monthPickerOpen = false; renderApp(); }
function changeScheduleMonth(delta) {
  const next = new Date(state.currentYear, state.currentMonth + delta, 1);
  state.currentYear = next.getFullYear();
  state.currentMonth = next.getMonth();
  renderApp();
}
function jumpToScheduleMonth(y, m) { state.currentYear = Number(y); state.currentMonth = Number(m); state.monthPickerOpen = false; renderApp(); }
function toggleMonthPicker(force) { state.monthPickerOpen = typeof force === 'boolean' ? force : !state.monthPickerOpen; renderApp(); }
function filterScheduleShiftType(t) { state.selectedShiftFilter = t; renderApp(); }

/* ---------- เข้า-ออกระบบ ---------- */
async function enter(roleKey, actor) {
  const key = roleKey === 'Shift Employee B' ? 'Shift Employee' : roleKeyOf(actor);
  state.actor = actor;
  state.roles = { [key]: buildRole(key, actor) };
  state.activeRole = key;
  state.activeView = (state.roles[key].nav[0] || { id: 'driver' }).id;
  state.selectedShiftFilter = 'ALL';
  state.operatorShowFullGrid = false;
  state.currentYear = DEMO_TODAY.getFullYear();
  state.currentMonth = DEMO_TODAY.getMonth();
  state.annualScheduleYear = DEMO_TODAY.getFullYear();
  Object.assign(view, { signed: true, loginErr: '', loginUser: '', moreNav: false, mode: 'month', day: DEMO_TODAY.getDate(), q: '', rq: null, cell: null, loading: true });
  renderApp();
  try {
    if (actor.role !== 'EXTERNAL') await Promise.all([loadYear(state.currentYear), refreshAll()]);
  } catch (error) { showToast(error.message || 'โหลดข้อมูลไม่สำเร็จ', 'alert'); }
  view.loading = false;
  window.scrollTo(0, 0);
  renderApp();
}
async function logout() {
  closeModal();
  saveLocal();
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* session หมดอายุแล้ว */ }
  leave();
}
function leave() {
  Object.assign(view, { signed: false, loading: false, loginErr: '', loginUser: '' });
  state.actor = null;
  state.roles = {};
  state.apiRequests = [];
  state.apiLogs = [];
  resetData();
  Object.keys(pendingYears).forEach(y => { delete pendingYears[y]; });
  merge();
  renderApp();
  const el = $('#lgUser');
  if (el) el.focus();
}

/* ---------- หลังมีการเปลี่ยนแปลงข้อมูล ---------- */
async function afterApi() {
  try { await Promise.all([refreshAll(), reloadLoadedYears()]); } catch { /* แสดงข้อมูลเดิม */ }
  renderApp();
}
onSubmitted(async () => {
  state.activeView = state.activeRole === 'Shift Employee' ? 'my-requests' : isSupervisorRoleName(state.activeRole) ? 'my-requests' : state.activeView;
  await afterApi();
});
onRequestChanged(async fromApi => { if (fromApi) await afterApi(); else { clearPatternCache(); renderApp(); } });
onManagerChange(() => renderApp());
onDriverChange(() => renderApp());

/* ---------- คำสั่งของปุ่ม ---------- */
const SF = {
  nav(id) {
    view.moreNav = false;
    if (id === 'driver') { renderApp(); return; }
    if (id === 'team-schedule') state.operatorShowFullGrid = false;
    state.monthPickerOpen = false;
    switchView(id);
    window.scrollTo(0, 0);
  },
  more() { view.moreNav = !view.moreNav; renderApp(); },
  pickRole(r) { view.loginUser = r; view.loginErr = ''; renderApp(); const el = $('#lgPass'); if (el) el.focus(); },
  codes: codesModal,
  newRequest: newRequestModal,
  form: openForm,
  cell: openCell,
  swapWith(id, d) { openForm('swap', d); if (view.rq) { view.rq.partner = String(id); renderForm(); } },
  rq(key, val) { if (view.rq) { view.rq[key] = val; if (key === 'oldDay') view.rq.newDay = ''; renderForm(); } },
  rqKeep(key, val) { if (view.rq) view.rq[key] = val; },
  rqDate(v) {
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!p || !view.rq) return;
    const y = Number(p[1]), m = Number(p[2]) - 1;
    if (isMonthLocked(y, m) || !isYearPublished(y)) { showToast(isYearPublished(y) ? LOCKED_NOTE : 'ปีนี้ยังไม่ประกาศใช้ ยังยื่นคำขอไม่ได้', 'alert'); renderForm(); return; }
    if (y !== state.currentYear || m !== state.currentMonth) { state.currentYear = y; state.currentMonth = m; renderApp(); }
    view.rq.day = Math.min(Number(p[3]), daysIn(y, m));
    renderForm();
  },
  mode(v) { view.mode = v; if (v === 'day' && !(state.currentYear === DEMO_TODAY.getFullYear() && state.currentMonth === DEMO_TODAY.getMonth())) view.day = 1; renderApp(); },
  today() { view.day = DEMO_TODAY.getDate(); jumpToScheduleMonth(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth()); },
  search(v) { view.q = v; renderApp(); },
  pickDay(d) { view.day = d; renderApp(); },
  dayStep(k) {
    const n = daysIn(state.currentYear, state.currentMonth);
    const d = Math.min(view.day, n) + k;
    if (d < 1) { changeScheduleMonth(-1); view.day = daysIn(state.currentYear, state.currentMonth); renderApp(); return; }
    if (d > n) { view.day = 1; changeScheduleMonth(1); return; }
    view.day = d;
    renderApp();
  },
  whoToday() { view.mode = 'day'; view.day = DEMO_TODAY.getDate(); state.currentYear = DEMO_TODAY.getFullYear(); state.currentMonth = DEMO_TODAY.getMonth(); SF.nav('schedule'); },
  async login() {
    const result = await signIn();
    if (!result) { renderApp(); const el = $('#lgPass'); if (el) el.focus(); return; }
    await enter(result.roleKey, result.actor);
  },
  account() {
    const role = state.roles[state.activeRole] || {};
    openModal('ผู้ใช้งาน', `
      <dl class="facts plain">
        <div><dt>ชื่อ</dt><dd>${esc(role.name)}</dd></div>
        <div><dt>บทบาท</dt><dd>${esc(state.activeRole)}</dd></div>
        <div><dt>ตำแหน่ง</dt><dd>${esc(role.title)}</dd></div>
        <div><dt>ข้อมูล</dt><dd>${esc(DATA_LABEL)} · ส่วนที่ระบบหลังบ้านยังไม่รองรับเก็บในเครื่องนี้</dd></div>
      </dl>
      <button class="link danger" data-click="SF.resetAsk()">ล้างข้อมูลทดลองในเครื่องนี้</button>`,
    '<button class="btn" data-click="closeModal()">ปิด</button><button class="btn danger" data-click="SF.logout()">ออกจากระบบ</button>');
  },
  pubAsk,
  pub: publishYear,
  unpubAsk,
  unpub: unpublishYear,
  monthOf(y, m) { view.mode = 'month'; state.currentYear = y; state.currentMonth = m; switchView('schedule'); },
  toAnnual(y) { state.annualScheduleYear = y; switchView('annual-schedule'); },
  exportYear(y) { exportYear(y); renderApp(); },
  resetAsk() {
    openModal('ล้างข้อมูลทดลองในเครื่องนี้', '<p>คำขอ การแก้ไขตาราง และประวัติที่ทำในเครื่องนี้ (ส่วนที่ยังไม่ได้เก็บในฐานข้อมูล) จะถูกลบทั้งหมด แล้วกลับไปใช้ข้อมูลตั้งต้น เรียกคืนไม่ได้ ข้อมูลในฐานข้อมูลไม่ถูกลบ</p>',
      '<button class="btn" data-click="closeModal()">ยกเลิก</button><button class="btn danger" data-click="SF.reset()">ล้างข้อมูล</button>');
  },
  reset() { clearLocal(); location.reload(); },
  logout
};

register({
  ...Object.fromEntries(Object.entries(SF).map(([k, v]) => [`SF.${k}`, v])),
  switchView, changeScheduleMonth, jumpToScheduleMonth, toggleMonthPicker, filterScheduleShiftType,
  openRequestDetails, approveRequest, promptRejectRequest, confirmRejectRequest, withdrawRequest, resetTestcases,
  submitColleagueSwapRequest, submitOperatorShiftRequest, submitLeaveRequest, submitDayOffChangeRequest, submitOTRequest, submitPublicHolidayChoice,
  filterEmployeeTeam, filterEmployeeSearch, openEmployeeForm, saveEmployeeProfile,
  jumpAnnualYear, jumpAnnualYearTo, updateAnnualTeamFamily, addAnnualHoliday, holidayKey, removeAnnualHoliday,
  updateManagerShiftTime, updateManagerRule, exportMonthlyCSV, exportLeaveRecordsCSV, exportOTRecordsCSV, acknowledgeDriverSchedule
});

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (modalOpen()) closeModal();
  else if (state.monthPickerOpen) toggleMonthPicker(false);
});
window.addEventListener('session-expired', () => { if (view.signed) { closeModal(); showToast('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง', 'alert'); leave(); } });

// รีเฟรชข้อมูลจากฐานข้อมูลทุก 30 วินาที (ข้ามระหว่างเปิดหน้าต่างย่อยหรือกำลังพิมพ์)
setInterval(() => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (!view.signed || view.loading || modalOpen() || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || state.actor.role === 'EXTERNAL') return;
  void afterApi();
}, 30000);

/* ---------- เริ่มระบบ: เปิดเว็บทุกครั้งเริ่มที่หน้าเข้าสู่ระบบ ---------- */
async function boot() {
  watchTranslate();
  const app = $('#app');
  if (app) app.innerHTML = '<p class="boot">กำลังโหลดข้อมูล…</p>';
  loadLocal();
  seedYearData();
  try { state.accounts = await api('/demo/accounts'); } catch (error) { showToast(error.message || 'เชื่อมต่อระบบหลังบ้านไม่สำเร็จ', 'alert'); }
  ready = true;
  view.signed = false;
  renderApp();
}
void boot();
