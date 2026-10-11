/* ==========================================================================
   อนุมัติ / ไม่อนุมัติ / ยกเลิกคำขอ และลงตารางกะเมื่ออนุมัติครบ
   --------------------------------------------------------------------------
   คำขอจากฐานข้อมูล → ส่งไประบบหลังบ้าน (decisions / cancel)
   คำขอเดโม (LOCAL) → ลำดับอนุมัติและการลงตารางทำในเบราว์เซอร์
   ========================================================================== */

import { addLog, cancelApi, decideApi, merge } from '../../app/data.js';
import { saveLocal, state } from '../../app/state.js';
import { $, esc, js } from '../../shared/dom.js';
import { closeModal, openModal } from '../../shared/modal.js';
import { parseThaiDate } from '../../shared/scheduling/dates.js';
import { setShiftOverride } from '../../shared/scheduling/roster.js';
import { showToast } from '../../shared/toast.js';
import { notify, partiesOf, stepKey } from '../notifications/store.js';
import { findReq } from './detail.js';
import { canWithdrawRequest, empOf } from './permissions.js';

let afterChange = async () => {};
export function onRequestChanged(fn) { afterChange = fn; }

/* ---------- ลงตารางเมื่ออนุมัติครบ (LOCAL) ---------- */
function applyApprovedRequestToSchedule(req) {
  const parsed = parseThaiDate(req.date);
  const y = req.y != null ? req.y : parsed ? parsed.y : state.currentYear;
  const m = req.m != null ? req.m : parsed ? parsed.m : state.currentMonth;
  const type = req.type || '';
  const a = empOf(req.requesterId, req.person);
  let day = req.day;
  if (!day && req.date) { const mt = String(req.date).match(/^\d+/); if (mt) day = parseInt(mt[0], 10); }
  if (type === 'ลา + OT คุมกะแทน') {
    const b = empOf(req.targetId, req.targetPerson);
    if (a && day) setShiftOverride(a.id, y, m, day, req.leaveCode || req.targetShift);
    if (b && day) setShiftOverride(b.id, y, m, day, req.otCode || 'MT');
  } else if (type.startsWith('ขอเปลี่ยนกะ')) {
    if (a && day && req.targetShift) setShiftOverride(a.id, y, m, day, req.targetShift);
  } else if (type.includes('วันหยุดนักขัตฤกษ์')) {
    if (a && parsed) parsed.days.forEach(d => setShiftOverride(a.id, parsed.y, parsed.m, d, req.targetShift || 'H'));
  } else if (type.includes('สลับกะ') && req.targetPerson) {
    const b = empOf(req.targetId, req.targetPerson);
    if (a && b && day) { setShiftOverride(a.id, y, m, day, req.aNewCode || req.targetShift); setShiftOverride(b.id, y, m, day, req.bNewCode || req.currentShift); }
  } else if (type.includes('OT')) {
    if (a && day && req.targetShift) setShiftOverride(a.id, y, m, day, req.targetShift);
  } else if (type.includes('ลา')) {
    if (a && day && req.targetShift) setShiftOverride(a.id, y, m, day, req.targetShift);
    if (req.targetPerson && (req.coverOtCode || req.otCode)) {
      const cover = empOf(req.coverId || req.targetId, req.targetPerson);
      if (cover && day) setShiftOverride(cover.id, y, m, day, req.coverOtCode || req.otCode || 'MT');
    }
  } else if (type.includes('เปลี่ยนวันหยุด')) {
    if (a && req.oldDay && req.newDay) {
      const work = (a.shiftType === 'Shift A' || a.shiftType === 'Shift C') ? 'M' : 'N';
      setShiftOverride(a.id, y, m, req.oldDay, work);
      setShiftOverride(a.id, y, m, req.newDay, 'O');
    }
  }
}

/* ---------- อนุมัติ / ไม่อนุมัติ / ยกเลิก ---------- */
// อนุมัติครบแล้ว: แจ้งผู้ยื่นและคนที่เกี่ยวข้อง ถ้าเป็นการลาหรือ OT แจ้งฝ่ายบุคคลด้วย (ใช้คิดเงินเดือน)
function notifyApproved(req) {
  notify(partiesOf(req), 'คำขออนุมัติแล้ว', `${req.type} · ${req.date} · ตารางกะเปลี่ยนตามคำขอแล้ว`, req.id);
  if (/ลา|OT/.test(req.type)) notify('hr', 'มีการลา/OT ที่อนุมัติแล้ว', `${req.person} · ${req.type} · ${req.date}`, req.id);
}
const roleNow = () => state.roles[state.activeRole] || { name: state.activeRole, initials: '--' };
const timeNow = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
async function viaApi(work, message, kind) {
  try { await work(); closeModal(); showToast(message, kind); await afterChange(true); }
  catch (error) { showToast(error.message || 'ดำเนินการไม่สำเร็จ', 'alert'); await afterChange(true); }
}
export async function approveRequest(reqId) {
  const req = findReq(reqId);
  if (!req) return;
  if (req.api) {
    const last = req.approvers.filter(a => a.status !== 'approved').length <= 1;
    await viaApi(() => decideApi(req, 'APPROVE'), last ? `อนุมัติคำขอของ ${req.person} ครบ 2 หัวหน้ากะเรียบร้อยแล้ว ✓` : `กดยืนยันแล้ว — รอ ${(req.approvers.filter(a => a.status !== 'approved')[1] || {}).role || 'หัวหน้ากะอีกฝ่าย'}`);
    return;
  }
  const me = roleNow();
  if (req.approvers && req.approvers.length > 1) {
    const step = req.approvers.find(a => a.status !== 'approved');
    if (step) { step.status = 'approved'; step.at = timeNow(); }
    if (req.approvers.every(a => a.status === 'approved')) {
      req.status = 'อนุมัติแล้ว';
      applyApprovedRequestToSchedule(req);
      addLog(`อนุมัติคำขอ ${req.type} ของ ${req.person} ครบ 2 หัวหน้ากะแล้ว (วันที่ ${req.date})`);
      notifyApproved(req);
      showToast(`อนุมัติคำขอของ ${req.person} ครบ 2 หัวหน้ากะเรียบร้อยแล้ว ✓`);
    } else {
      const nextPending = req.approvers.find(a => a.status !== 'approved');
      req.status = `รออนุมัติครบ 2 ฝ่าย (${nextPending ? nextPending.role : ''})`.trim();
      addLog(`ผ่านการยืนยันโดย "${step ? step.role : me.name}" สำหรับคำขอ ${req.type} ของ ${req.person} — รอหัวหน้ากะอีกฝ่ายยืนยัน`);
      notify(stepKey(nextPending && nextPending.role), 'คำขอรอการอนุมัติของคุณ', `${req.person} · ${req.type} · ${req.date} (ผ่านขั้นก่อนหน้าแล้ว)`, req.id);
      notify(partiesOf(req), 'คำขอผ่านการอนุมัติขั้นแรก', `${req.type} · ${req.date} · รอ ${nextPending ? nextPending.role : 'ขั้นถัดไป'}`, req.id);
      showToast(`กดยืนยันแล้ว — รอ ${nextPending ? nextPending.role : 'หัวหน้ากะอีกฝ่าย'}`);
    }
  } else {
    if (req.approvers && req.approvers.length === 1) { req.approvers[0].status = 'approved'; req.approvers[0].at = timeNow(); }
    req.status = 'อนุมัติแล้ว';
    applyApprovedRequestToSchedule(req);
    addLog(`อนุมัติคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date})`);
    notifyApproved(req);
    showToast(`อนุมัติคำขอของ ${req.person} เรียบร้อยแล้ว`);
  }
  saveLocal();
  merge();
  await afterChange(false);
}
export function promptRejectRequest(reqId) {
  const req = findReq(reqId);
  if (!req) return;
  openModal('ปฏิเสธคำขอพร้อมระบุเหตุผล', `
    <div class="reject-body">
      <p class="reject-text">คุณกำลังจะปฏิเสธคำขอ <strong>${esc(req.type)}</strong> ของ <strong>${esc(req.person)}</strong> (${esc(req.date)})</p>
      <div class="form-group">
        <label for="rejectReasonInput">ระบุเหตุผลในการไม่อนุมัติ (จำเป็นตามระเบียบ US-033)</label>
        <textarea class="form-control" id="rejectReasonInput" rows="3" placeholder="เช่น อัตรากำลังพลในกะไม่เพียงพอ ฯลฯ"></textarea>
      </div>
    </div>`, `
    <button type="button" class="btn btn-secondary" data-click="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-danger" data-click="confirmRejectRequest(${js(req.id)})">ยืนยันปฏิเสธคำขอ</button>`);
}
export async function confirmRejectRequest(reqId) {
  const reason = ($('#rejectReasonInput') || {}).value || '';
  if (!reason.trim()) { showToast('กรุณาระบุเหตุผลในการไม่อนุมัติ', 'alert'); ($('#rejectReasonInput') || { focus() {} }).focus(); return; }
  const req = findReq(reqId);
  if (!req) return;
  if (req.api) { await viaApi(() => decideApi(req, 'REJECT', reason), 'บันทึกการไม่อนุมัติคำขอเรียบร้อยแล้ว', 'alert'); return; }
  req.status = 'ไม่อนุมัติ';
  req.rejectReason = reason;
  addLog(`ไม่อนุมัติคำขอ ${req.type} ของ ${req.person} (เหตุผล: ${reason})`);
  notify(partiesOf(req), 'คำขอไม่ได้รับการอนุมัติ', `${req.type} · ${req.date} · เหตุผล: ${reason}`, req.id);
  saveLocal();
  closeModal();
  showToast('บันทึกการไม่อนุมัติคำขอเรียบร้อยแล้ว', 'alert');
  await afterChange(false);
}
export async function withdrawRequest(reqId) {
  const req = findReq(reqId);
  if (!req || !canWithdrawRequest(req)) { showToast('ไม่สามารถยกเลิกคำขอนี้ได้ — คำขอผ่านการตรวจสอบแล้ว', 'alert'); return; }
  if (req.api) { await viaApi(() => cancelApi(req), 'ยกเลิกคำขอเรียบร้อยแล้ว'); return; }
  req.status = 'ยกเลิกแล้ว';
  addLog(`ถอนคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date}) — ถอนก่อนการตรวจสอบ`);
  const waiting = (req.approvers || []).find(a => a.status !== 'approved');
  notify([stepKey(waiting && waiting.role), ...partiesOf(req)], 'คำขอถูกยกเลิก', `${req.person} ยกเลิก${req.type} · ${req.date} ตารางกะยังคงเดิม`, req.id);
  saveLocal();
  closeModal();
  showToast('ยกเลิกคำขอเรียบร้อยแล้ว');
  await afterChange(false);
}
// ล้างคำขอทดลองในเครื่องนี้ (คำขอสลับกะในฐานข้อมูลไม่ถูกลบ)
export async function resetTestcases() {
  state.localRequests = [];
  saveLocal();
  merge();
  showToast('ล้างรายการคำขอทดลองในเครื่องนี้เรียบร้อยแล้ว');
  await afterChange(false);
}
