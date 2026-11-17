/* ==========================================================================
   หน้าต่างรายละเอียดคำขอ
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { openModal } from '../../shared/modal.js';
import { localLeaveClosureStatus } from './leave-time.js';
import { changesTable } from './form-parts.js';
import { canCancelApproved, canWithdrawRequest, visibleRequestReason } from './permissions.js';
import { localCancellationConflict } from './request-conflict.js';
import { holidayDateLabel, holidayDeadlineLabel, holidayShiftLabel } from './types/holiday.js';

/* ---------- รายละเอียด ---------- */
export const findReq = id => state.requests.find(r => r.id === Number(id) || r.id === id);
const approvalLabel = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', pending: 'รอตรวจสอบ' };
export function openRequestDetails(reqId) {
  const req = findReq(reqId);
  if (!req) return;
  const reason = visibleRequestReason(req);
  const relatedRole = req.coverOtCode ? ` · ${req.coverOtCode}` : req.targetRole ? ` (${req.targetRole})` : '';
  const status = localLeaveClosureStatus(req) || req.status;
  const closed = ['ยกเลิกแล้ว', 'หมดอายุ', 'ตารางเดือนปิดแล้ว', 'ปิดเพราะเปลี่ยนกฎ กรุณายื่นใหม่'].includes(status);
  const statusLabel = closed || ['อนุมัติแล้ว', 'ไม่อนุมัติ'].includes(status) ? status : 'รอตรวจสอบ';
  const statusClass = req.status === 'อนุมัติแล้ว' ? 'pill-approved' : req.status === 'ไม่อนุมัติ' ? 'pill-rejected' : closed ? '' : 'pill-pending';
  const cancelBlockReason = req.cancelBlockReason || (!req.api && status === 'อนุมัติแล้ว' && localCancellationConflict(req));
  const holiday = req.kind === 'holiday' ? req.holiday : null;
  const holidayDate = holiday?.date;
  const holidayRows = holiday?.changes?.map(change => ({
    e: { name: req.person }, date: holidayDateLabel(change.workDate), from: change.before, to: change.after,
    ...(change.after === 'L' ? { targetLabel: holidayShiftLabel(change.after) } : {}),
  })) || [];
  const body = `
    <div class="request-detail-view">
      <div class="request-detail-status">
        <span>สถานะคำขอ</span>
        <span class="pill ${statusClass}">${esc(statusLabel)}</span>
      </div>
      ${req.approvalBlockReason ? `<p class="notice">${esc(req.approvalBlockReason)}</p>` : ''}
      ${cancelBlockReason ? `<p class="notice">${esc(cancelBlockReason)}</p>` : ''}
      ${req.api && req.cancelledAfterApproval ? `<p class="notice">${req.kind === 'swap' ? 'คืนตารางและโควตาแล้ว' : 'คืนตารางกะเดิมแล้ว'}</p>` : ''}
      <dl class="request-detail-list">
        ${req.api ? `<div class="request-detail-row"><dt>เลขคำขอ</dt><dd>#${esc(req.id)}</dd></div>` : ''}
        <div class="request-detail-row"><dt>ประเภทคำขอ</dt><dd>${esc(req.type)}</dd></div>
        <div class="request-detail-row"><dt>ผู้ยื่น</dt><dd>${esc(req.person)}</dd></div>
        <div class="request-detail-row"><dt>วันที่เกี่ยวข้อง</dt><dd>${esc(req.date)}</dd></div>
        ${holidayDate ? `<div class="request-detail-row"><dt>วันนักขัตฤกษ์ที่ใช้สิทธิ์</dt><dd>${esc(holidayDateLabel(holidayDate))}</dd></div>` : ''}
        ${holiday?.deadline && req.status.includes('รอ') ? `<div class="request-detail-row"><dt>ต้องอนุมัติก่อน</dt><dd>${esc(holidayDeadlineLabel(holiday.deadline))} น. ตามเวลาไทย</dd></div>` : ''}
        ${req.targetPerson ? `<div class="request-detail-row"><dt>${req.kind === 'leave' ? 'คนที่มาทำแทน' : 'คู่สลับ/ผู้เกี่ยวข้อง'}</dt><dd>${esc(req.targetPerson + relatedRole)}</dd></div>` : ''}
        ${!holiday && req.currentShift && req.currentShift !== '-' ? `<div class="request-detail-row"><dt>กะเดิม → กะใหม่</dt><dd>${esc(req.currentShift)} → ${esc(req.targetShift)}</dd></div>` : ''}
        ${reason ? `<div class="request-detail-row request-detail-row-long"><dt>รายละเอียด</dt><dd>${esc(reason)}</dd></div>` : ''}
        <div class="request-detail-row"><dt>ส่งคำขอเมื่อ</dt><dd>${esc(req.submittedAt)}</dd></div>
        <div class="request-detail-row"><dt>ผู้ตรวจสอบ</dt><dd>${req.approvers.map(a =>
          esc(`${a.role} · ${approvalLabel[a.status] || approvalLabel.pending}${a.decidedAt || a.at ? ` · ${a.decidedAt || a.at}` : ''}`)
        ).join('<br>')}</dd></div>
        ${req.cancelReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ยกเลิก</dt><dd>${esc(req.cancelReason)}${req.cancelledAfterApproval ? ' (ยกเลิกหลังอนุมัติ ตารางกะกลับเป็นแบบเดิมแล้ว)' : ''}</dd></div>` : ''}
        ${req.rejectReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>${esc(req.rejectReason)}</dd></div>` : ''}
      </dl>
      ${changesTable(holidayRows, req.status === 'อนุมัติแล้ว' ? 'ผลที่อนุมัติในตารางกะ' : 'ผลที่ระบุในคำขอ')}
    </div>`;
  const close = '<button class="btn btn-secondary" data-click="closeModal()">ปิด</button>';
  const foot = canWithdrawRequest(req) ? `${close}<button class="btn btn-danger" data-click="withdrawRequest(${js(req.id)})">ยกเลิกคำขอ</button>`
    : canCancelApproved(req) ? `${close}<button class="btn btn-danger" data-click="promptCancelApproved(${js(req.id)})">ยกเลิกและคืนตาราง</button>`
      : close;
  openModal('รายละเอียดคำขอ', body, foot);
}
