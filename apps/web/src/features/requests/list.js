/* ==========================================================================
   หน้ารายการคำขอ: ตารางคำขอ ปุ่มตามสิทธิ์ของแต่ละคน และขั้นอนุมัติ
   ========================================================================== */

import { state, view } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';
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
  const detail = `<button class="btn sm" data-click="openRequestDetails(${js(req.id)})">ดูรายละเอียด</button>`;
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
  if (isSupervisorRoleName(state.activeRole) && pending) return `<span class="muted small wait-for">รอ ${esc(next ? next.role : 'หัวหน้ากะอีกฝ่าย')}</span>${detail}`;
  return detail;
}
function stepsInline(req) {
  if (!req.approvers || req.approvers.length < 2) return '';
  return `<div class="steps-inline">${req.approvers.map((a, i) => {
    const prior = req.approvers.slice(0, i).every(p => p.status === 'approved');
    const cls = a.status === 'approved' ? 'done' : (req.parallelApproval || prior) && req.status.includes('รอ') ? 'now' : '';
    return `<span class="${cls}">${esc(a.role)}${a.status === 'approved' ? ` ✓${a.at ? ` ${esc(a.at)}` : ''}` : ''}</span>`;
  }).join(req.parallelApproval ? '<i>·</i>' : '<i>›</i>')}</div>`;
}
export function requestsHtml(title) {
  const isEmp = state.activeRole === 'Shift Employee';
  const visible = getVisibleRequests().map(request => {
    const status = localLeaveClosureStatus(request);
    return status ? { ...request, status } : request;
  });
  const group = view.employeeRequestGroup;
  const list = isEmp ? visible.filter(request => hasOtherParticipants(request) === (group === 'shared')) : visible;
  const pendingN = list.filter(r => r.status && r.status.includes('รอ')).length;
  const right = [`<span class="st ${pendingN ? 'wait' : ''}">${isEmp ? `ทั้งหมด ${list.length} รายการ` : `รอดำเนินการ ${pendingN} รายการ`}</span>`];
  const personLine = request => isEmp
    ? `ผู้ยื่น ${isRequestOwner(request, currentEmp()) ? 'คุณ' : request.person}`
    : `${request.person} · ${request.roleCategory}`;
  const relatedPerson = request => request.kind === 'leave' ? 'คนที่มาทำแทน' : 'คู่สลับ/ผู้เกี่ยวข้อง';
  if (!state.actor?.remotePilot && state.localRequests.length) right.push('<button class="btn" data-click="resetTestcases()" title="ล้างรายการคำขอทดลองในเครื่องนี้ เพื่อเริ่มทดสอบใหม่">ล้างคิวคำขอ</button>');
  if (isEmp) right.push('<button class="btn primary" data-click="SF.newRequest()">ยื่นคำขอ</button>');
  return `
    ${pageHead(esc(title), right.join(''))}
    ${isEmp ? `<div class="bar"><div class="seg" role="group" aria-label="กลุ่มคำขอ">
      ${Object.entries(employeeRequestGroups).map(([key, label]) => `<button id="employee-requests-${key}" type="button" class="${group === key ? 'on' : ''}" aria-pressed="${group === key}" data-click="SF.employeeRequestGroup(${js(key)})">${label}</button>`).join('')}
    </div></div>` : ''}
    ${list.length ? `
      <div class="panel flush tbl-wrap only-wide">
        <table class="tbl reqs">
          <thead><tr><th>คำขอ</th><th>วันที่</th><th>รายละเอียด</th><th>สถานะ</th><th><span class="sr">ดำเนินการ</span></th></tr></thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td><b class="rq-type">${esc(r.type)}</b><small>${esc(personLine(r))}</small></td>
                <td class="nowrap">${esc(r.date)}<small>ยื่นเมื่อ ${esc(r.submittedAt)}</small></td>
                <td>${esc(visibleRequestReason(r))}${r.currentShift && r.currentShift !== '-' ? `<small>${esc(r.type.includes('OT') ? 'กะเดิม → OT ที่ขอ' : 'กะเดิม → กะใหม่')}: ${esc(r.currentShift)} → ${esc(r.targetShift)}</small>` : ''}${r.targetPerson ? `<small>${relatedPerson(r)}: ${esc(r.targetPerson)}</small>` : ''}${r.quotaUsed && r.quotaUsed !== '-' ? `<small>โควตาเดือนนี้ ${esc(r.quotaUsed)}</small>` : ''}${stepsInline(r)}${r.rejectReason ? `<small class="err">เหตุผลที่ไม่อนุมัติ: ${esc(r.rejectReason)}</small>` : ''}</td>
                <td><span class="st ${statusCls(r)}">${esc(r.status)}</span>${r.approvalBlockReason ? '<small>ต้องยื่นใหม่</small>' : ''}${r.cancelBlockReason ? `<small>${esc(r.cancelBlockReason)}</small>` : ''}</td>
                <td class="act"><div class="acts">${reqActions(r)}</div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <ul class="rcards only-narrow">
        ${list.map(r => `
          <li class="panel">
            <div class="rc-top"><b>${esc(r.type)} · ${esc(r.date)}</b><span class="st ${statusCls(r)}">${esc(r.status)}</span></div>
            <p class="muted small">${[isEmp ? personLine(r) : r.person, visibleRequestReason(r)].filter(Boolean).map(esc).join(' · ')}</p>
            ${r.approvalBlockReason ? `<p class="small err">${esc(r.approvalBlockReason)}</p>` : ''}
            ${r.cancelBlockReason ? `<p class="muted small">${esc(r.cancelBlockReason)}</p>` : ''}
            ${r.rejectReason ? `<p class="small err">เหตุผลที่ไม่อนุมัติ: ${esc(r.rejectReason)}</p>` : ''}
            <div class="rc-act">${reqActions(r)}</div>
          </li>`).join('')}
      </ul>` : `<p class="empty">${isEmp ? `ยังไม่มี${employeeRequestGroups[group]}` : 'ไม่มีคำขอที่ต้องตรวจสอบ'}</p>`}`;
}
