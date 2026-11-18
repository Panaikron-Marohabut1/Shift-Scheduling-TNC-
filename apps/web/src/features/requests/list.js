/* ==========================================================================
   หน้ารายการคำขอ: ตารางคำขอ ปุ่มตามสิทธิ์ของแต่ละคน และขั้นอนุมัติ
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';
import { codeClass, shownCode } from '../schedule/codes.js';
import { localLeaveClosureStatus } from './leave-time.js';
import { canCancelApproved, canUserReviewRequest, canWithdrawRequest, getVisibleRequests, hasOtherParticipants, isRequestOwner, managerCanAct, visibleRequestReason } from './permissions.js';
import { holidayDateLabel, holidayDeadlineLabel } from './types/holiday.js';

const employeeRequestGroups = { personal: 'คำขอเฉพาะฉัน', shared: 'คำขอร่วมกับผู้อื่น' };

export const requestSectionLabels = {
  inProgress: 'กำลังดำเนินการ',
  recent: 'รายการล่าสุด',
  recentStatuses: 'อนุมัติแล้ว · ไม่อนุมัติ · ยกเลิก · หมดอายุ'
};

export function withCurrentRequestStatus(request) {
  const status = localLeaveClosureStatus(request);
  return status ? { ...request, status } : request;
}

export const isRequestInProgress = request => request.status?.includes('รอ') ?? false;

export function selectEmployeeRequestGroup(group) {
  if (state.activeRole !== 'Shift Employee' || !Object.hasOwn(employeeRequestGroups, group)) return;
  view.employeeRequestGroup = group;
}

export function statusCls(req) {
  if (req.status === 'อนุมัติแล้ว') return 'ok';
  if (req.status === 'ไม่อนุมัติ') return 'bad';
  if (['ยกเลิกแล้ว', 'หมดอายุ', 'ตารางเดือนปิดแล้ว', 'ปิดเพราะเปลี่ยนกฎ กรุณายื่นใหม่'].includes(req.status)) return '';
  return 'wait';
}

/* ---------- หน้ารายการ ---------- */
function reqActions(req) {
  const pending = req.status.includes('รอ');
  const approve = req.approvalBlockReason ? '' : `<button class="btn sm primary" data-click="approveRequest(${js(req.id)})">อนุมัติ</button>`;
  const decide = `<button class="btn sm danger" data-click="promptRejectRequest(${js(req.id)})">ไม่อนุมัติ</button>${approve}`;
  const me = currentEmp();
  const mine = me && req.requesterId === me.id;
  const withdraw = () => (canWithdrawRequest(req)
    ? `<button class="btn sm danger" data-click="withdrawRequest(${js(req.id)})" title="ยกเลิกได้จนกว่าหัวหน้ากะจะเริ่มตรวจสอบ">ยกเลิกคำขอ</button>`
    : pending ? '<button class="btn sm" disabled title="ยกเลิกไม่ได้ คำขอนี้ผ่านการตรวจสอบไปแล้ว">ยกเลิกคำขอ</button>' : '');
  const undo = canCancelApproved(req) ? `<button class="btn sm danger" data-click="promptCancelApproved(${js(req.id)})" title="ยกเลิกคำขอที่อนุมัติแล้ว และคืนตารางกะเป็นแบบเดิม">ยกเลิกและคืนตาราง</button>` : '';
  if (state.activeRole === 'Manager') return (managerCanAct(req) ? decide : '') + undo;
  if (mine) return withdraw() + undo;
  if (canUserReviewRequest(req) && pending) return decide;
  if (isSupervisorRoleName(state.activeRole) && pending && !req.approvers?.length) return '<span class="muted small">รอ หัวหน้ากะอีกฝ่าย</span>';
  return '';
}
// ขั้นอนุมัติแบบสั้น: ไอคอนถูก = อนุมัติแล้ว · จุดทึบ = ถึงคิว · วงกลม = ยังไม่ถึง (ตัดชื่อในวงเล็บที่ซ้ำกับบทบาทออก)
function stepsHtml(req) {
  if (!req.approvers || !req.approvers.length) return '';
  const pending = req.status.includes('รอ');
  return `<ol class="req-steps" aria-label="ขั้นอนุมัติ">${req.approvers.map((a, i) => {
    const prior = req.approvers.slice(0, i).every(p => p.status === 'approved');
    const step = a.status === 'approved' ? 'done' : pending && (req.parallelApproval || prior) ? 'now' : 'todo';
    const mark = icon({ done: 'check', now: 'dot', todo: 'ring' }[step]);
    const word = { done: 'อนุมัติแล้ว', now: 'รอตรวจ', todo: 'ยังไม่ถึงคิว' }[step];
    return `<li class="${step}"><i aria-hidden="true">${mark}</i><span>${esc(String(a.role).replace(/\s*\([^)]*\)\s*$/, ''))}<span class="sr"> ${word}</span></span>${step === 'done' && a.at ? `<small>${esc(a.at)}</small>` : ''}</li>`;
  }).join('')}</ol>`;
}
const shiftChip = code => `<span class="chip ${codeClass(code)}">${esc(shownCode(code))}</span>`;
// ผู้ตรวจสอบทำอะไรกับคำขอนี้ได้ตอนนี้ → ใช้แยกแท็บ "รอฉัน"
function waitsForMe(req) {
  if (!req.status || !req.status.includes('รอ')) return false;
  if (state.activeRole === 'Manager') return managerCanAct(req);
  return canUserReviewRequest(req);
}
export function selectRequestTab(tab) { if (['mine', 'all'].includes(tab)) view.requestTab = tab; }

export function requestsHtml(title) {
  const isEmp = state.activeRole === 'Shift Employee';
  const visible = getVisibleRequests().map(withCurrentRequestStatus);
  const group = view.employeeRequestGroup;
  const me = currentEmp();
  const reviewer = !isEmp && (state.activeRole === 'Manager' || isSupervisorRoleName(state.activeRole));
  const forMe = reviewer ? visible.filter(waitsForMe) : [];
  const tab = reviewer ? (view.requestTab || (forMe.length ? 'mine' : 'all')) : 'all';
  const list = isEmp ? visible.filter(request => hasOtherParticipants(request) === (group === 'shared'))
    : tab === 'mine' ? forMe : visible;
  const pendingN = visible.filter(isRequestInProgress).length;
  const resetButton = !state.actor?.remotePilot && state.localRequests.length
    ? '<button class="btn" data-click="resetTestcases()" title="ล้างรายการคำขอทดลองในเครื่องนี้ เพื่อเริ่มทดสอบใหม่">ล้างคิวคำขอ</button>'
    : '';
  const nameOf = name => (me && name === me.name ? 'คุณ' : name);
  const tabs = isEmp
    ? Object.entries(employeeRequestGroups).map(([key, label]) => [key, label, group === key, `employee-requests-${key}`])
    : reviewer ? [['mine', `รอฉัน ${forMe.length}`, tab === 'mine'], ['all', `ทั้งหมด ${visible.length}`, tab === 'all']] : [];
  // คำขอที่ยังเดินอยู่ (สถานะขึ้นต้นด้วย "รอ") แยกไว้บนสุด ที่จบแล้วอยู่ล่างและจางลง
  const openList = list.filter(isRequestInProgress), closedList = list.filter(r => !isRequestInProgress(r));
  const row = r => {
    const swap = r.kind !== 'holiday' && r.currentShift && r.currentShift !== '-';
    const reason = visibleRequestReason(r);
    const holiday = r.kind === 'holiday' && r.holiday;
    const holidayLines = holiday?.changes?.map(change => `
      <p class="req-meta">${esc(holidayDateLabel(change.workDate))} · ${esc(change.before)} → ${esc(change.after === 'L' ? 'หยุดโดยใช้สิทธิ์นักขัตฤกษ์' : change.after)}</p>`).join('') || '';
    const people = r.targetPerson ? `<span>${esc(nameOf(r.person))}</span> <span class="req-pair"><span class="req-arrow">${r.kind === 'leave' ? 'ให้' : '↔'}</span> ${esc(nameOf(r.targetPerson))}${r.kind === 'leave' ? ' ทำแทน' : ''}</span>` : esc(nameOf(r.person));
    const meta = [`ยื่น ${r.submittedAt}`, !isEmp && r.roleCategory, r.quotaUsed && r.quotaUsed !== '-' && `โควตาเดือนนี้ ${r.quotaUsed}`].filter(Boolean).map(esc).join(' · ');
    const acts = reqActions(r);
    const steps = stepsHtml(r);
    const status = steps ? r.status.replace(/^(รออนุมัติครบ 2 ฝ่าย) \(.+\)$/, '$1') : r.status;
    return `
      <li class="req ${isRequestInProgress(r) ? 'open' : 'closed'}" data-click="openRequestDetails(${js(r.id)})">
        <div class="req-main">
          <button type="button" class="req-open" data-click="openRequestDetails(${js(r.id)})"><b>${esc(r.type)}</b><span class="req-date">${esc(r.date)}</span></button>
          <p class="req-people">${people}${swap ? `<span class="req-shift">${shiftChip(r.currentShift)}<span aria-label="เป็น">→</span>${shiftChip(r.targetShift)}</span>` : ''}</p>
          ${holidayLines}
          ${holiday?.deadline && isRequestInProgress(r) ? `<p class="req-meta">ต้องอนุมัติก่อน ${esc(holidayDeadlineLabel(holiday.deadline))} น.</p>` : ''}
          ${reason && !(swap && r.targetPerson) ? `<p class="req-reason">${esc(reason)}</p>` : ''}
          <p class="req-meta">${meta}</p>
          ${r.rejectReason ? `<p class="req-note err">ไม่อนุมัติเพราะ: ${esc(r.rejectReason)}</p>` : ''}
          ${r.approvalBlockReason ? `<p class="req-note err">${esc(r.approvalBlockReason)}</p>` : ''}
          ${r.cancelBlockReason ? `<p class="req-note">${esc(r.cancelBlockReason)}</p>` : ''}
        </div>
        ${steps}
        <span class="req-status st ${statusCls(r)}">${esc(status)}</span>
        ${acts ? `<div class="req-acts">${acts}</div>` : ''}
      </li>`;
  };
  const empty = isEmp ? `ยังไม่มี${employeeRequestGroups[group]}`
    : tab === 'mine' ? `ไม่มีคำขอที่รอคุณตรวจ · ดูคำขอทั้งหมด ${visible.length} รายการได้ที่แท็บ "ทั้งหมด"` : 'ยังไม่มีคำขอ';
  return `
    ${pageHead(esc(title), resetButton)}
    ${tabs.length ? `<div class="bar req-bar"><div class="seg" role="group" aria-label="${isEmp ? 'กลุ่มคำขอ' : 'แสดงคำขอ'}">
      ${tabs.map(([key, label, on, id]) => `<button ${id ? `id="${id}"` : ''} type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" ${isEmp ? `data-click="SF.employeeRequestGroup(${js(key)})"` : `data-click="SF.requestTab(${js(key)})"`}>${esc(label)}</button>`).join('')}
    </div>${reviewer ? `<span class="muted small">${requestSectionLabels.inProgress}ทั้งหมด ${pendingN} รายการ</span>` : ''}</div>` : ''}
    ${list.length ? `
      ${openList.length ? `<h2 class="req-group">${requestSectionLabels.inProgress} <span>${openList.length}</span></h2><ul class="req-list req-open-list">${openList.map(row).join('')}</ul>` : ''}
      ${closedList.length ? `<h2 class="req-group closed">${requestSectionLabels.recent} <span>${closedList.length}</span><small>${requestSectionLabels.recentStatuses}</small></h2><ul class="req-list req-closed-list">${closedList.map(row).join('')}</ul>` : ''}`
    : `<p class="empty">${esc(empty)}</p>`}`;
}
