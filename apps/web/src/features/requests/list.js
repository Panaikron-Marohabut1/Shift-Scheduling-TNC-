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

const employeeRequestGroups = { personal: 'คำขอเฉพาะฉัน', shared: 'คำขอร่วมกับผู้อื่น' };

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
  const next = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  // ทั้งแถวเปิดรายละเอียดได้อยู่แล้ว จึงไม่มีปุ่ม "ดูรายละเอียด" ซ้ำทุกแถว
  const detail = '';
  const approve = req.approvalBlockReason ? '' : `<button class="btn sm primary" data-click="approveRequest(${js(req.id)})">อนุมัติ</button>`;
  const decide = `<button class="btn sm danger" data-click="promptRejectRequest(${js(req.id)})">ไม่อนุมัติ</button>${approve}`;
  const me = currentEmp();
  const mine = me && req.requesterId === me.id;
  const withdraw = () => (canWithdrawRequest(req)
    ? `<button class="btn sm danger" data-click="withdrawRequest(${js(req.id)})" title="ยกเลิกได้จนกว่าหัวหน้ากะจะเริ่มตรวจสอบ">ยกเลิกคำขอ</button>`
    : pending ? '<button class="btn sm" disabled title="ยกเลิกไม่ได้ คำขอนี้ผ่านการตรวจสอบไปแล้ว">ยกเลิกคำขอ</button>' : '');
  const undo = canCancelApproved(req) ? `<button class="btn sm danger" data-click="promptCancelApproved(${js(req.id)})" title="ยกเลิกคำขอที่อนุมัติแล้ว และคืนตารางกะเป็นแบบเดิม">ยกเลิกและคืนตาราง</button>` : '';
  if (state.activeRole === 'Manager') return (managerCanAct(req) ? decide : '') + detail + undo;
  if (mine) return detail + withdraw() + undo;
  if (canUserReviewRequest(req) && pending) return decide + detail;
  if (isSupervisorRoleName(state.activeRole) && pending) return `<span class="muted small wait-for">รอ ${esc(String(next ? next.role : 'หัวหน้ากะอีกฝ่าย').replace(/\s*\([^)]*\)\s*$/, ''))}</span>${detail}`;
  return detail;
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
  const visible = getVisibleRequests().map(request => {
    const status = localLeaveClosureStatus(request);
    return status ? { ...request, status } : request;
  });
  const group = view.employeeRequestGroup;
  const me = currentEmp();
  const reviewer = !isEmp && (state.activeRole === 'Manager' || isSupervisorRoleName(state.activeRole));
  const forMe = reviewer ? visible.filter(waitsForMe) : [];
  const tab = reviewer ? (view.requestTab || (forMe.length ? 'mine' : 'all')) : 'all';
  const list = isEmp ? visible.filter(request => hasOtherParticipants(request) === (group === 'shared'))
    : tab === 'mine' ? forMe : visible;
  const pendingN = visible.filter(r => r.status && r.status.includes('รอ')).length;
  const right = [];
  if (!state.actor?.remotePilot && state.localRequests.length) right.push('<button class="btn" data-click="resetTestcases()" title="ล้างรายการคำขอทดลองในเครื่องนี้ เพื่อเริ่มทดสอบใหม่">ล้างคิวคำขอ</button>');
  if (isEmp) right.push('<button class="btn primary" data-click="SF.newRequest()">ยื่นคำขอ</button>');
  const nameOf = name => (me && name === me.name ? 'คุณ' : name);
  const tabs = isEmp
    ? Object.entries(employeeRequestGroups).map(([key, label]) => [key, label, `SF.employeeRequestGroup(${js(key)})`, group === key, `employee-requests-${key}`])
    : reviewer ? [['mine', `รอฉัน ${forMe.length}`, "SF.requestTab('mine')", tab === 'mine'], ['all', `ทั้งหมด ${visible.length}`, "SF.requestTab('all')", tab === 'all']] : [];
  // คำขอที่ยังเดินอยู่ (สถานะขึ้นต้นด้วย "รอ") แยกไว้บนสุด ที่จบแล้วอยู่ล่างและจางลง
  const isOpen = r => !!r.status && r.status.includes('รอ');
  const openList = list.filter(isOpen), closedList = list.filter(r => !isOpen(r));
  const row = r => {
    const swap = r.currentShift && r.currentShift !== '-';
    const reason = visibleRequestReason(r);
    const people = r.targetPerson ? `<span>${esc(nameOf(r.person))}</span> <span class="req-pair"><span class="req-arrow">${r.kind === 'leave' ? 'ให้' : '↔'}</span> ${esc(nameOf(r.targetPerson))}${r.kind === 'leave' ? ' ทำแทน' : ''}</span>` : esc(nameOf(r.person));
    const meta = [`ยื่น ${r.submittedAt}`, !isEmp && r.roleCategory, r.quotaUsed && r.quotaUsed !== '-' && `โควตาเดือนนี้ ${r.quotaUsed}`].filter(Boolean).map(esc).join(' · ');
    const acts = reqActions(r);
    return `
      <li class="req ${isOpen(r) ? 'open' : 'closed'}" data-click="openRequestDetails(${js(r.id)})">
        <div class="req-main">
          <button type="button" class="req-open" data-click="openRequestDetails(${js(r.id)})"><b>${esc(r.type)}</b><span class="req-date">${esc(r.date)}</span></button>
          <p class="req-people">${people}${swap ? `<span class="req-shift">${shiftChip(r.currentShift)}<span aria-label="เป็น">→</span>${shiftChip(r.targetShift)}</span>` : ''}</p>
          ${reason && !(swap && r.targetPerson) ? `<p class="req-reason">${esc(reason)}</p>` : ''}
          <p class="req-meta">${meta}</p>
          ${r.rejectReason ? `<p class="req-note err">ไม่อนุมัติเพราะ: ${esc(r.rejectReason)}</p>` : ''}
          ${r.approvalBlockReason ? `<p class="req-note err">${esc(r.approvalBlockReason)}</p>` : ''}
          ${r.cancelBlockReason ? `<p class="req-note">${esc(r.cancelBlockReason)}</p>` : ''}
        </div>
        ${stepsHtml(r)}
        <span class="req-status st ${statusCls(r)}">${esc(r.status)}</span>
        ${acts ? `<div class="req-acts">${acts}</div>` : ''}
      </li>`;
  };
  const empty = isEmp ? `ยังไม่มี${employeeRequestGroups[group]}`
    : tab === 'mine' ? `ไม่มีคำขอที่รอคุณตรวจ · ดูคำขอทั้งหมด ${visible.length} รายการได้ที่แท็บ "ทั้งหมด"` : 'ยังไม่มีคำขอ';
  return `
    ${pageHead(esc(title), right.join(''))}
    ${tabs.length ? `<div class="bar req-bar"><div class="seg" role="group" aria-label="${isEmp ? 'กลุ่มคำขอ' : 'แสดงคำขอ'}">
      ${tabs.map(([key, label, click, on, id]) => `<button ${id ? `id="${id}"` : ''} type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" data-click="${click}">${esc(label)}</button>`).join('')}
    </div>${reviewer ? `<span class="muted small">รอดำเนินการทั้งหมด ${pendingN} รายการ</span>` : ''}</div>` : ''}
    ${list.length ? `
      ${openList.length ? `<h2 class="req-group">กำลังดำเนินการ <span>${openList.length}</span></h2><ul class="req-list req-open-list">${openList.map(row).join('')}</ul>` : ''}
      ${closedList.length ? `<h2 class="req-group closed">ปิดแล้ว <span>${closedList.length}</span><small>อนุมัติแล้ว · ไม่อนุมัติ · ยกเลิก · หมดอายุ</small></h2><ul class="req-list req-closed-list">${closedList.map(row).join('')}</ul>` : ''}`
    : `<p class="empty">${esc(empty)}</p>`}`;
}
