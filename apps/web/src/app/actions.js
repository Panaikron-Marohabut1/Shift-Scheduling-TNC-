/* ==========================================================================
   คำสั่งของปุ่มทั้งหมดในหน้าเว็บ
   --------------------------------------------------------------------------
   ปุ่มในหน้าจอเขียนเป็น data-click="ชื่อคำสั่ง(ค่า)" (ดู shared/events.js)
   ทุกคำสั่งที่ปุ่มเรียกได้ต้องลงทะเบียนในไฟล์นี้เท่านั้น ชื่อที่ไม่ได้ลงทะเบียนจะกดไม่ได้
   ========================================================================== */

import { renderApp } from './render.js';
import { enter, logout } from './session.js';
import { DATA_LABEL } from './shell.js';
import { clearLocal, DEMO_TODAY, state, view } from './state.js';
import { $, esc } from '../shared/dom.js';
import { register } from '../shared/events.js';
import { openModal } from '../shared/modal.js';
import { isYearPublished } from '../shared/scheduling/annual.js';
import { daysIn } from '../shared/scheduling/dates.js';
import { isMonthLocked } from '../shared/scheduling/roster.js';
import { showToast } from '../shared/toast.js';
import { acknowledgeDriverSchedule } from '../features/external/view.js';
import { exportLeaveRecordsCSV, exportMonthlyCSV, exportOTRecordsCSV, exportYear } from '../features/hr/view.js';
import {
  addAnnualHoliday, holidayKey, jumpAnnualYear, jumpAnnualYearTo, pubAsk, publishYear, removeAnnualHoliday, unpubAsk, unpublishYear,
  updateAnnualTeamFamily
} from '../features/manager/annual.js';
import { filterEmployeeSearch, filterEmployeeTeam, openEmployeeForm, saveEmployeeProfile } from '../features/manager/people.js';
import { updateManagerRule, updateManagerShiftTime } from '../features/manager/settings.js';
import { openNotification, readAllNotifications } from '../features/notifications/view.js';
import { approveRequest, confirmRejectRequest, promptRejectRequest, resetTestcases, withdrawRequest } from '../features/requests/decisions.js';
import { openRequestDetails } from '../features/requests/detail.js';
import { openForm, renderForm } from '../features/requests/form.js';
import { LOCKED_NOTE, newRequestModal } from '../features/requests/new-request.js';
import { submitOperatorShiftRequest } from '../features/requests/types/change.js';
import { submitDayOffChangeRequest } from '../features/requests/types/dayoff.js';
import { submitPublicHolidayChoice } from '../features/requests/types/holiday.js';
import { submitLeaveRequest } from '../features/requests/types/leave.js';
import { submitOTRequest } from '../features/requests/types/ot.js';
import { submitColleagueSwapRequest } from '../features/requests/types/swap.js';
import { openCell } from '../features/schedule/cell.js';
import { codesModal } from '../features/schedule/page.js';
import { signIn } from '../features/session/view.js';

/* ---------- เปลี่ยนหน้า เดือน และมุมมอง ---------- */
function switchView(id) { state.activeView = id; view.moreNav = false; state.monthPickerOpen = false; renderApp(); }
function changeScheduleMonth(delta) {
  const next = new Date(state.currentYear, state.currentMonth + delta, 1);
  state.currentYear = next.getFullYear();
  state.currentMonth = next.getMonth();
  renderApp();
}
function jumpToScheduleMonth(y, m) { state.currentYear = Number(y); state.currentMonth = Number(m); state.monthPickerOpen = false; renderApp(); }
export function toggleMonthPicker(force) { state.monthPickerOpen = typeof force === 'boolean' ? force : !state.monthPickerOpen; renderApp(); }
function filterScheduleShiftType(t) { state.selectedShiftFilter = t; renderApp(); }

/* ---------- คำสั่งของปุ่ม ---------- */
const SF = {
  nav(id) {
    view.moreNav = false;
    if (id === 'driver') { switchView('driver'); return; }
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
  updateManagerShiftTime, updateManagerRule, exportMonthlyCSV, exportLeaveRecordsCSV, exportOTRecordsCSV, acknowledgeDriverSchedule, openNotification, readAllNotifications
});
