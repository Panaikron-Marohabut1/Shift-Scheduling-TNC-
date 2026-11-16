import { api } from '../../../api/client.js';
import { refreshAll, reloadMonths } from '../../../app/data.js';
import { state, view } from '../../../app/state.js';
import { $, esc } from '../../../shared/dom.js';
import { isoOf, monthKey, shortDate } from '../../../shared/scheduling/dates.js';
import { currentEmp } from '../../../shared/scheduling/employees.js';
import { getTeamForDate } from '../../../shared/scheduling/roster.js';
import { buildApprovalChain } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt } from '../form-parts.js';
import { canSubmitRequestDate } from '../request-time.js';
import { requestConflictAt, requestConflictText } from '../request-conflict.js';
import { done } from '../submit.js';

const otShifts = [['MT', 'ทำ OT กะเช้า (MT)'], ['NT', 'ทำ OT กะดึก (NT)']];

function selectedDayOff(emp, year, month, day) {
  const slot = state.apiAssign[emp.id]?.[isoOf(year, month, day)];
  return slot?.status === 'ACTIVE' && slot.is_working === false && ['O', '-'].includes(slot.shift_code) ? slot : null;
}

function renderOTChecks(preview) {
  if (!preview) return '';
  const { result, error } = preview;
  const body = error
    ? `<p class="err" role="alert">${esc(error)}</p><button class="btn sm" type="button" id="otCheckRetry">ตรวจอีกครั้ง</button>`
    : result ? checksList('', result.checks.map(check => ({
        status: check.status === 'PASS' ? 'pass' : 'fail',
        statusText: check.status === 'PASS' ? 'ผ่าน' : 'ไม่ผ่าน',
        rule: check.label, msg: check.message,
      }))) : '<p role="status">กำลังตรวจเงื่อนไข OT…</p>';
  return `<section class="central-swap-checks" id="otChecks" aria-labelledby="otChecksTitle" aria-busy="${!result && !error}">
    <h3 id="otChecksTitle">ตรวจเงื่อนไข OT</h3>
    ${body}
  </section>`;
}

export function otForm({ f, emp, y, m }) {
  const slot = selectedDayOff(emp, y, m, f.day);
  const conflict = requestConflictAt(emp.id, y, m, f.day);
  const inWindow = canSubmitRequestDate(isoOf(y, m, f.day));
  const body = !conflict && state.actor?.centralOT && slot && inWindow && otShifts.some(([code]) => code === f.ot)
    ? { assignmentId: slot.assignment_id, assignmentVersion: slot.version, otCode: f.ot } : null;
  const signature = body ? JSON.stringify(body) : null;
  if (!body) f.preview = null;
  else if (f.preview?.signature !== signature) f.preview = { body, signature };
  const ready = !f.submitting && f.preview?.result?.valid === true && !f.preview.error;
  const fields = [dateField('วันที่ต้องการทำ OT', 'otReqDay'), `
    <div class="field"><label for="otReqCode">กะที่ต้องการทำ OT</label>
      <select class="inp" id="otReqCode" data-change="SF.rq('ot', this.value)" ${f.submitting ? 'disabled' : ''}>
        ${opt('', 'เลือกกะที่ต้องการทำ OT', f.ot)}
        ${otShifts.map(([code, label]) => opt(code, label, f.ot)).join('')}
      </select></div>`];
  const approvers = emp.roleCategory === 'Shift Supervisor' ? ['ผู้จัดการฝ่ายผลิต'] :
    buildApprovalChain({ ...emp, shiftType: getTeamForDate(emp, y, m, f.day) }).chain.map(step => step.role);
  const note = conflict ? `<p class="notice">${esc(requestConflictText(conflict))}</p>`
    : !inWindow ? '<p class="notice">ยื่นได้ตั้งแต่วันนี้ถึงวันสุดท้ายของเดือนนี้</p>'
    : !slot ? '<p class="notice">กรุณาเลือกวันหยุดของคุณในตารางกะที่ประกาศแล้ว</p>' : '';
  return { fields, rows: body ? [{ e: emp, date: shortDate(y, m, f.day), from: slot.shift_code, to: f.ot }] : [],
    approvers: ready ? approvers : [], checks: renderOTChecks(f.preview), note, ready, submit: 'submitOTRequest()' };
}

export async function validateOTPreview(f, render) {
  const preview = f.preview;
  if (!preview || preview.loading || preview.result || preview.error || f.submitting) return;
  preview.loading = true;
  const active = () => view.rq === f && f.preview === preview && $('#otChecks');
  try {
    const result = await api('/ot-requests/validate', { method: 'POST', body: preview.body });
    if (active()) preview.result = result;
  } catch (error) {
    if (!active()) return;
    preview.error = error.message || 'ตรวจเงื่อนไข OT ไม่สำเร็จ';
    if (error.code === 'SCHEDULE_CHANGED') await reloadMonths([monthKey(state.currentYear, state.currentMonth)]);
  } finally {
    preview.loading = false;
    if (active()) render();
  }
}

export async function submitOTRequest(render) {
  const f = view.rq;
  const emp = currentEmp();
  if (!state.actor?.centralOT || !emp || f?.k !== 'ot' || f.submitting || f.preview?.result?.valid !== true || f.preview.error) return;
  const { body, signature } = f.preview;
  if (f.submission?.signature !== signature) f.submission = { signature, key: crypto.randomUUID() };
  const button = $('#otSubmit');
  f.submitting = true;
  if (button) button.disabled = true;
  try {
    await api('/ot-requests', { method: 'POST', key: f.submission.key, body });
    await refreshAll();
    if (view.rq === f && button?.isConnected) {
      if (state.activeRole === 'Shift Employee') view.employeeRequestGroup = 'personal';
      done('ส่งคำขอทำ OT แล้ว');
    } else showToast('ส่งคำขอทำ OT แล้ว');
  } catch (error) {
    f.preview.error = error.message || 'ส่งคำขอทำ OT ไม่สำเร็จ';
    if (error.code === 'SCHEDULE_CHANGED') await reloadMonths([monthKey(state.currentYear, state.currentMonth)]);
  } finally {
    f.submitting = false;
    if (view.rq === f && $('#otChecks')) render();
  }
}
