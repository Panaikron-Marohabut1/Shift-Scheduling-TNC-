/* ==========================================================================
   หน้ารายการคำขอ: ตารางคำขอ ปุ่มตามสิทธิ์ของแต่ละคน และขั้นอนุมัติ
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';
import { canUserReviewRequest, canWithdrawRequest, getVisibleRequests, managerCanAct } from './permissions.js';

export function statusCls(req) {
  if (req.status === 'อนุมัติแล้ว') return 'ok';
  if (req.status === 'ไม่อนุมัติ') return 'bad';
  if (req.status === 'ยกเลิกแล้ว') return '';
  return 'wait';
}

/* ---------- หน้ารายการ ---------- */
function reqActions(req) {
  const pending = req.status.includes('รอ');
  const next = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  const detail = `<button class="btn sm" data-click="openRequestDetails(${js(req.id)})">ดูรายละเอียด</button>`;
  const decide = `<button class="btn sm danger" data-click="promptRejectRequest(${js(req.id)})">ไม่อนุมัติ</button><button class="btn sm primary" data-click="approveRequest(${js(req.id)})">อนุมัติ</button>`;
  const me = currentEmp();
  const mine = me && req.requesterId === me.id;
  const withdraw = () => (canWithdrawRequest(req)
    ? `<button class="btn sm danger" data-click="withdrawRequest(${js(req.id)})" title="ยกเลิกได้จนกว่าหัวหน้ากะจะเริ่มตรวจสอบ">ยกเลิกคำขอ</button>`
    : pending ? '<button class="btn sm" disabled title="ยกเลิกไม่ได้ คำขอนี้ผ่านการตรวจสอบไปแล้ว">ยกเลิกคำขอ</button>' : '');
  if (state.activeRole === 'Manager') return (managerCanAct(req) ? decide : '') + detail;
  if (mine) return detail + withdraw();
  if (canUserReviewRequest(req) && pending) return decide;
  if (isSupervisorRoleName(state.activeRole) && pending) return `<span class="muted small wait-for">รอ ${esc(next ? next.role : 'หัวหน้ากะอีกฝ่าย')}</span>${detail}`;
  return detail;
}
function stepsInline(req) {
  if (!req.approvers || req.approvers.length < 2) return '';
  return `<div class="steps-inline">${req.approvers.map((a, i) => {
    const prior = req.approvers.slice(0, i).every(p => p.status === 'approved');
    const cls = a.status === 'approved' ? 'done' : prior && req.status.includes('รอ') ? 'now' : '';
    return `<span class="${cls}">${esc(a.role)}${a.status === 'approved' ? ` ✓${a.at ? ` ${esc(a.at)}` : ''}` : ''}</span>`;
  }).join('<i>›</i>')}</div>`;
}
export function requestsHtml(title) {
  const list = getVisibleRequests();
  const isEmp = state.activeRole === 'Shift Employee';
  const pendingN = list.filter(r => r.status && r.status.includes('รอ')).length;
  const right = [`<span class="st ${pendingN ? 'wait' : ''}">${isEmp ? `คำขอของฉัน ${list.length} รายการ` : `รอดำเนินการ ${pendingN} รายการ`}</span>`];
  if (state.localRequests.length) right.push('<button class="btn" data-click="resetTestcases()" title="ล้างรายการคำขอทดลองในเครื่องนี้ เพื่อเริ่มทดสอบใหม่">ล้างคิวคำขอ</button>');
  if (isEmp) right.push('<button class="btn primary" data-click="SF.newRequest()">ยื่นคำขอ</button>');
  return `
    ${pageHead(esc(title), right.join(''))}
    ${list.length ? `
      <div class="panel flush tbl-wrap only-wide">
        <table class="tbl reqs">
          <thead><tr><th>คำขอ</th><th>วันที่</th><th>รายละเอียด</th><th>สถานะ</th><th><span class="sr">ดำเนินการ</span></th></tr></thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td><b class="rq-type">${esc(r.type)}</b><small>${esc(r.person)} · ${esc(r.roleCategory)}</small></td>
                <td class="nowrap">${esc(r.date)}<small>ยื่นเมื่อ ${esc(r.submittedAt)}</small></td>
                <td>${esc(r.reason)}${r.currentShift && r.currentShift !== '-' ? `<small>${esc(r.type.includes('OT') ? 'กะเดิม → OT ที่ขอ' : 'กะเดิม → กะใหม่')}: ${esc(r.currentShift)} → ${esc(r.targetShift)}</small>` : ''}${r.targetPerson ? `<small>คู่สลับ/ผู้เกี่ยวข้อง: ${esc(r.targetPerson)}</small>` : ''}${r.quotaUsed && r.quotaUsed !== '-' ? `<small>โควตาเดือนนี้ ${esc(r.quotaUsed)}</small>` : ''}${stepsInline(r)}${r.rejectReason ? `<small class="err">เหตุผลที่ไม่อนุมัติ: ${esc(r.rejectReason)}</small>` : ''}</td>
                <td><span class="st ${statusCls(r)}">${esc(r.status)}</span></td>
                <td class="act"><div class="acts">${reqActions(r)}</div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <ul class="rcards only-narrow">
        ${list.map(r => `
          <li class="panel">
            <div class="rc-top"><b>${esc(r.type)} · ${esc(r.date)}</b><span class="st ${statusCls(r)}">${esc(r.status)}</span></div>
            <p class="muted small">${esc(r.person)} · ${esc(r.reason)}</p>
            ${r.rejectReason ? `<p class="small err">เหตุผลที่ไม่อนุมัติ: ${esc(r.rejectReason)}</p>` : ''}
            <div class="rc-act">${reqActions(r)}</div>
          </li>`).join('')}
      </ul>` : `<p class="empty">${isEmp ? 'ยังไม่มีคำขอ' : 'ไม่มีคำขอที่ต้องตรวจสอบ'}</p>`}`;
}
