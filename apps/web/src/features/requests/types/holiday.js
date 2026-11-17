import { api } from '../../../api/client.js';
import { refreshAll } from '../../../app/data.js';
import { state, view } from '../../../app/state.js';
import { $, esc, js } from '../../../shared/dom.js';
import { isoOf } from '../../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getTeamForDate } from '../../../shared/scheduling/roster.js';
import { buildApprovalChain } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { opt } from '../form-parts.js';
import { done } from '../submit.js';

const dateFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok'
});
const deadlineFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok'
});
export const holidayDateLabel = date => dateFormat.format(new Date(date));
export const holidayDeadlineLabel = date => deadlineFormat.format(new Date(date));
export const holidayShiftLabel = code => code === 'L' ? 'หยุดโดยใช้สิทธิ์นักขัตฤกษ์' : getEmployeeFacingShiftLabel(code);
const deadlineReasons = {
  HOLIDAY_START: 'ก่อนเริ่มวันนักขัตฤกษ์',
  TARGET_START: 'ก่อนเริ่มกะวันที่ขอหยุด',
  OVERTIME_START: 'ก่อนเริ่มกะ OT ที่จะถูกถอน'
};

function optionField(id, label, key, options, value, disabled, hint) {
  return `<div class="field"><label for="${esc(id)}">${esc(label)}</label>
    <select class="inp" id="${esc(id)}" data-change="SF.rq(${js(key)}, this.value)" ${disabled ? 'disabled' : ''}${hint ? ` aria-describedby="${esc(id)}Hint"` : ''}>
      ${options.map(([code, title]) => opt(code, title, value)).join('')}
    </select>${hint ? `<small id="${esc(id)}Hint">${esc(hint)}</small>` : ''}</div>`;
}

function updateSelectedHoliday(f, y, m) {
  const holidays = f.holidayOptions.result.holidays;
  if (f.holidayDate == null) {
    const openedDate = isoOf(y, m, f.day);
    f.holidayDate = holidays.find(holiday => holiday.date === openedDate)?.date
      || (holidays.length === 1 ? holidays[0].date : '');
  }
  if (f.holidaySelectedDate !== f.holidayDate) {
    f.holidaySelectedDate = f.holidayDate;
    f.holidayAction = '';
    f.holidayAssignment = '';
  }
  return holidays.find(holiday => holiday.date === f.holidayDate);
}

function renderOptionsStatus(options) {
  if (options.error) return `<p class="notice bad" role="alert">${esc(options.error)}</p>
    <button class="btn sm" type="button" id="holidayOptionsRetry">โหลดตัวเลือกอีกครั้ง</button>`;
  return options.result
    ? '<p class="notice">ไม่มีสิทธิ์วันหยุดนักขัตฤกษ์ที่เลือกได้ในเดือนนี้</p>'
    : '<p role="status">กำลังโหลดสิทธิ์วันหยุดนักขัตฤกษ์…</p>';
}

function renderHolidayPreview(preview) {
  if (!preview) return '';
  if (preview.error) return `<p class="notice bad" role="alert">${esc(preview.error)}</p>
    <button class="btn sm" type="button" id="holidayPreviewRetry">ตรวจผลอีกครั้ง</button>`;
  if (!preview.result) return '<p role="status">กำลังตรวจผลที่จะเกิดในตารางกะ…</p>';
  const { deadline, deadlineReason } = preview.result;
  return `<div class="notice">
    <strong>ส่งและอนุมัติให้เสร็จก่อน ${esc(holidayDeadlineLabel(deadline))} น. ตามเวลาไทย</strong>
    ${deadlineReasons[deadlineReason] ? `<p>${esc(deadlineReasons[deadlineReason])}</p>` : ''}
  </div>${preview.submitError ? `<p class="notice bad" role="alert">${esc(preview.submitError)}</p>` : ''}`;
}

export function holidayForm({ f, emp, y, m }) {
  const month = isoOf(y, m, 1).slice(0, 7);
  if (f.holidayOptions?.month !== month) {
    Object.assign(f, { holidayOptions: { month }, holidayDate: null, holidayPreview: null });
  }
  const options = f.holidayOptions;
  const fields = [];
  if (!options.result?.holidays.length) return {
    fields, rows: [], checks: renderOptionsStatus(options), approvers: [], note: '', ready: false
  };

  const holiday = updateSelectedHoliday(f, y, m);
  fields.push(optionField('holidayDateSelect', 'สิทธิ์วันหยุดนักขัตฤกษ์', 'holidayDate', [
    ['', 'เลือกวันนักขัตฤกษ์'],
    ...options.result.holidays.map(day => [day.date, `${holidayDateLabel(day.date)} · ${day.name}`])
  ], f.holidayDate, f.submitting));
  const replacements = holiday?.choices.filter(choice => choice.workDate !== holiday.date) || [];
  const direct = holiday?.canTakeDirect && holiday.choices.find(choice => choice.workDate === holiday.date);
  const action = direct ? replacements.length ? f.holidayAction : 'direct' : 'move';
  if (direct && replacements.length) {
    fields.push(optionField('holidayActionSelect', 'รูปแบบการใช้สิทธิ์', 'holidayAction', [
      ['', 'เลือกรูปแบบการใช้สิทธิ์'], ['direct', 'หยุดตรงวันนักขัตฤกษ์'], ['move', 'หยุดวันอื่น']
    ], action, f.submitting));
  }
  if (holiday && action === 'move' && replacements.length) {
    fields.push(optionField('holidayReplacementSelect', 'วันทำงานที่ต้องการหยุดแทน', 'holidayAssignment', [
      ['', 'เลือกวันหยุดแทน'],
      ...replacements.map(choice => [choice.assignmentId, `${holidayDateLabel(choice.workDate)} · ${getEmployeeFacingShiftLabel(choice.shiftCode)}`])
    ], f.holidayAssignment, f.submitting, 'เลือกกะทำงานในเดือนเดียวกัน ภายใน 7 วันก่อนหรือหลังวันนักขัตฤกษ์'));
  }
  const choice = action === 'direct' ? direct : action === 'move'
    ? replacements.find(slot => String(slot.assignmentId) === f.holidayAssignment) : null;
  const body = choice ? { holidayDate: holiday.date, assignmentId: choice.assignmentId, assignmentVersion: choice.assignmentVersion } : null;
  const signature = body && JSON.stringify(body);
  if (!body) f.holidayPreview = null;
  else if (f.holidayPreview?.signature !== signature) f.holidayPreview = { body, signature };
  const preview = f.holidayPreview;
  const result = preview?.result;
  const rows = result?.changes.map(change => ({
    e: emp, date: holidayDateLabel(change.workDate), from: change.before, to: change.after,
    ...(change.after === 'L' ? { targetLabel: holidayShiftLabel(change.after) } : {}),
  })) || [];
  const approvers = !result ? [] : emp.roleCategory === 'Shift Supervisor' ? ['ผู้จัดการฝ่ายผลิต']
    : buildApprovalChain({ ...emp, shiftType: getTeamForDate(emp, y, m, Number(choice.workDate.slice(-2))) }).chain.map(step => step.role);
  const note = holiday ? `<p class="notice">OT อัตโนมัติจากสิทธิ์นี้ ${esc(holidayDateLabel(holiday.overtimeDate))} · ${esc(holiday.overtimeShiftCode)}${!direct && !replacements.length ? ' · ไม่มีวันทำงานที่เลือกหยุดได้' : ''}</p>` : '';
  return { fields, rows, checks: renderHolidayPreview(preview), approvers, note,
    ready: !!result && !preview.error && !f.submitting, submit: 'submitHolidayRequest()' };
}

export async function loadHolidayOptions(f, render) {
  const options = f.holidayOptions;
  if (options.loading || options.result || options.error) return;
  options.loading = true;
  const active = () => view.rq === f && f.holidayOptions === options && $('#holidayForm');
  try {
    const result = await api(`/holiday-requests/options?month=${encodeURIComponent(options.month)}`);
    if (active()) options.result = result;
  } catch (error) {
    if (active()) options.error = error.message || 'โหลดสิทธิ์วันหยุดนักขัตฤกษ์ไม่สำเร็จ';
  } finally {
    options.loading = false;
    if (active()) render();
  }
}

export async function validateHolidayPreview(f, render) {
  const preview = f.holidayPreview;
  if (!preview || preview.loading || preview.result || preview.error || f.submitting) return;
  const active = () => view.rq === f && f.holidayPreview === preview && $('#holidayForm');
  preview.loading = true;
  try {
    const result = await api('/holiday-requests/validate', { method: 'POST', body: preview.body });
    if (active()) preview.result = result;
  } catch (error) {
    if (active()) {
      preview.error = error.message || 'ตรวจผลที่จะเกิดในตารางกะไม่สำเร็จ';
      preview.refreshOptions = error.code !== 'NETWORK_ERROR';
    }
  } finally {
    preview.loading = false;
    if (active()) render();
  }
}

export function retryHolidayPreview(f, render) {
  if (f.holidayPreview?.refreshOptions) f.holidayOptions = { month: f.holidayOptions.month };
  f.holidayPreview = null;
  render();
}

export async function submitHolidayRequest(render) {
  const f = view.rq;
  const preview = f?.holidayPreview;
  if (!state.actor?.centralHoliday || !currentEmp() || f?.k !== 'holiday' || f.submitting || !preview?.result || preview.error) return;
  const token = preview.result.previewToken;
  if (f.holidaySubmit?.token !== token) f.holidaySubmit = { token, key: crypto.randomUUID() };
  preview.submitError = '';
  f.submitting = true;
  render();
  try {
    await api('/holiday-requests', {
      method: 'POST', key: f.holidaySubmit.key, body: { ...preview.body, previewToken: token }
    });
    await refreshAll();
    if (view.rq === f && $('#holidayForm')) {
      if (state.activeRole === 'Shift Employee') view.employeeRequestGroup = 'personal';
      done('ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์แล้ว');
    } else showToast('ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์แล้ว');
  } catch (error) {
    const message = error.message || 'ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์ไม่สำเร็จ';
    if (error.code === 'NETWORK_ERROR') preview.submitError = message;
    else {
      preview.error = message;
      preview.refreshOptions = true;
    }
  } finally {
    f.submitting = false;
    if (view.rq === f && $('#holidayForm')) render();
  }
}
