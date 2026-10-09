/* ==========================================================================
   หน้าต่างรายละเอียดคำขอ
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { canWithdrawRequest } from './permissions.js';

/* ---------- รายละเอียด ---------- */
export const findReq = id => state.requests.find(r => r.id === Number(id) || r.id === id);
export function openRequestDetails(reqId) {
  const req = findReq(reqId);
  if (!req) return;
  const statusLabel = req.status === 'อนุมัติแล้ว' ? 'อนุมัติแล้ว' : req.status === 'ไม่อนุมัติ' ? 'ไม่อนุมัติ' : req.status === 'ยกเลิกแล้ว' ? 'ยกเลิกแล้ว' : 'รอตรวจสอบ';
  const statusClass = req.status === 'อนุมัติแล้ว' ? 'pill-approved' : req.status === 'ไม่อนุมัติ' ? 'pill-rejected' : req.status === 'ยกเลิกแล้ว' ? '' : 'pill-pending';
  const body = `
    <div class="request-detail-view">
      <div class="request-detail-status">
        <span>สถานะคำขอ</span>
        <span class="pill ${statusClass}">${statusLabel}</span>
      </div>
      <dl class="request-detail-list">
        <div class="request-detail-row"><dt>ประเภทคำขอ</dt><dd>${esc(req.type)}</dd></div>
        <div class="request-detail-row"><dt>วันที่เกี่ยวข้อง</dt><dd>${esc(req.date)}</dd></div>
        ${req.targetPerson ? `<div class="request-detail-row"><dt>คู่สลับ/ผู้เกี่ยวข้อง</dt><dd>${esc(req.targetPerson)}${req.targetRole ? ` (${esc(req.targetRole)})` : ''}</dd></div>` : ''}
        ${req.currentShift && req.currentShift !== '-' ? `<div class="request-detail-row"><dt>กะเดิม → กะใหม่</dt><dd>${esc(req.currentShift)} → ${esc(req.targetShift)}</dd></div>` : ''}
        <div class="request-detail-row request-detail-row-long"><dt>รายละเอียด</dt><dd>${esc(req.reason)}</dd></div>
        <div class="request-detail-row"><dt>ส่งคำขอเมื่อ</dt><dd>${esc(req.submittedAt)}</dd></div>
        <div class="request-detail-row"><dt>ผู้ตรวจสอบ</dt><dd>${esc(req.approvers.map(a => a.role).join(', '))}</dd></div>
        ${req.rejectReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>${esc(req.rejectReason)}</dd></div>` : ''}
      </dl>
    </div>`;
  const foot = canWithdrawRequest(req)
    ? `<button class="btn btn-secondary" data-click="closeModal()">ปิด</button><button class="btn btn-danger" data-click="withdrawRequest(${js(req.id)})">ยกเลิกคำขอ</button>`
    : '<button class="btn btn-secondary" data-click="closeModal()">ปิด</button>';
  openModal('รายละเอียดคำขอ', body, foot);
}
