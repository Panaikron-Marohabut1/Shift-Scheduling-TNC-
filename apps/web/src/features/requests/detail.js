/* ==========================================================================
   หน้าต่างรายละเอียดคำขอ
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { canCancelApproved, canWithdrawRequest } from './permissions.js';

/* ---------- รายละเอียด ---------- */
export const findReq = id => state.requests.find(r => r.id === Number(id) || r.id === id);
const approvalLabel = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', pending: 'รอตรวจสอบ' };
export function openRequestDetails(reqId) {
  const req = findReq(reqId);
  if (!req) return;
  const closed = ['ยกเลิกแล้ว', 'หมดอายุ', 'ตารางเดือนปิดแล้ว', 'ปิดเพราะเปลี่ยนกฎ กรุณายื่นใหม่'].includes(req.status);
  const statusLabel = closed || ['อนุมัติแล้ว', 'ไม่อนุมัติ'].includes(req.status) ? req.status : 'รอตรวจสอบ';
  const statusClass = req.status === 'อนุมัติแล้ว' ? 'pill-approved' : req.status === 'ไม่อนุมัติ' ? 'pill-rejected' : closed ? '' : 'pill-pending';
  const body = `
    <div class="request-detail-view">
      <div class="request-detail-status">
        <span>สถานะคำขอ</span>
        <span class="pill ${statusClass}">${esc(statusLabel)}</span>
      </div>
      ${req.approvalBlockReason ? `<p class="notice">${esc(req.approvalBlockReason)}</p>` : ''}
      ${req.cancelBlockReason ? `<p class="notice">${esc(req.cancelBlockReason)}</p>` : ''}
      ${req.api && req.cancelledAfterApproval ? '<p class="notice">คืนตารางและโควตาแล้ว</p>' : ''}
      <dl class="request-detail-list">
        <div class="request-detail-row"><dt>ประเภทคำขอ</dt><dd>${esc(req.type)}</dd></div>
        <div class="request-detail-row"><dt>วันที่เกี่ยวข้อง</dt><dd>${esc(req.date)}</dd></div>
        ${req.targetPerson ? `<div class="request-detail-row"><dt>คู่สลับ/ผู้เกี่ยวข้อง</dt><dd>${esc(req.targetPerson)}${req.targetRole ? ` (${esc(req.targetRole)})` : ''}</dd></div>` : ''}
        ${req.currentShift && req.currentShift !== '-' ? `<div class="request-detail-row"><dt>กะเดิม → กะใหม่</dt><dd>${esc(req.currentShift)} → ${esc(req.targetShift)}</dd></div>` : ''}
        <div class="request-detail-row request-detail-row-long"><dt>รายละเอียด</dt><dd>${esc(req.reason)}</dd></div>
        <div class="request-detail-row"><dt>ส่งคำขอเมื่อ</dt><dd>${esc(req.submittedAt)}</dd></div>
        <div class="request-detail-row"><dt>ผู้ตรวจสอบ</dt><dd>${req.approvers.map(a =>
          esc(`${a.role} · ${approvalLabel[a.status] || approvalLabel.pending}${a.decidedAt || a.at ? ` · ${a.decidedAt || a.at}` : ''}`)
        ).join('<br>')}</dd></div>
        ${req.cancelReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ยกเลิก</dt><dd>${esc(req.cancelReason)}${req.cancelledAfterApproval ? ' (ยกเลิกหลังอนุมัติ ตารางกะกลับเป็นแบบเดิมแล้ว)' : ''}</dd></div>` : ''}
        ${req.rejectReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>${esc(req.rejectReason)}</dd></div>` : ''}
      </dl>
    </div>`;
  const close = '<button class="btn btn-secondary" data-click="closeModal()">ปิด</button>';
  const foot = canWithdrawRequest(req) ? `${close}<button class="btn btn-danger" data-click="withdrawRequest(${js(req.id)})">ยกเลิกคำขอ</button>`
    : canCancelApproved(req) ? `${close}<button class="btn btn-danger" data-click="promptCancelApproved(${js(req.id)})">ยกเลิกและคืนตาราง</button>`
      : close;
  openModal('รายละเอียดคำขอ', body, foot);
}
