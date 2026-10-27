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
import { monthKey, parseThaiDate, shortDate } from '../../shared/scheduling/dates.js';
import { findEmployeeById } from '../../shared/scheduling/employees.js';
import { clearPatternCache, getShiftCodeForDate, setShiftOverride } from '../../shared/scheduling/roster.js';
import { showToast } from '../../shared/toast.js';
import { notify, partiesOf, stepKey } from '../notifications/store.js';
import { findReq } from './detail.js';
import { canCancelApproved, canWithdrawRequest, empOf } from './permissions.js';

let afterChange = async () => {};
export function onRequestChanged(fn) { afterChange = fn; }

/* ---------- ลงตารางเมื่ออนุมัติครบ (LOCAL) ---------- */
// ทุกช่องที่เปลี่ยนจดไว้ใน req.applied พร้อมค่าก่อนเปลี่ยน เพื่อ (1) บอกในช่องกะว่าเปลี่ยนเพราะคำขอไหน
// และ (2) ยกเลิกคำขอที่อนุมัติแล้วได้ โดยคืนทุกช่องกลับเป็นค่าเดิม
function put(req, empId, y, m, d, code) {
  if (!empId || !d || !code) return;
  const key = monthKey(y, m);
  const cur = state.scheduleOverrides[key] && state.scheduleOverrides[key][empId] ? state.scheduleOverrides[key][empId][d] : undefined;
  const who = findEmployeeById(empId);
  const from = who ? getShiftCodeForDate(who, y, m, d) : null; // กะที่เห็นในตารางก่อนเปลี่ยน
  (req.applied = req.applied || []).push({ empId, y, m, d, prev: cur === undefined ? null : cur, from, code });
  setShiftOverride(empId, y, m, d, code);
}
function applyApprovedRequestToSchedule(req) {
  req.applied = [];
  // คำขอรุ่นใหม่ส่งรายการช่องที่จะเปลี่ยนมาด้วย (req.changes) — ลงตามนั้นทุกช่อง
  if (Array.isArray(req.changes) && req.changes.length) {
    req.changes.forEach(c => put(req, c.empId, c.y, c.m, c.d, c.to));
    return;
  }
  // คำขอที่ยื่นไว้ก่อนปรับรูปแบบ (ยังอยู่ในเครื่อง)
  const parsed = parseThaiDate(req.date);
  const y = req.y != null ? req.y : parsed ? parsed.y : state.currentYear;
  const m = req.m != null ? req.m : parsed ? parsed.m : state.currentMonth;
  const type = req.type || '';
  const a = empOf(req.requesterId, req.person);
  const aId = a && a.id;
  let day = req.day;
  if (!day && req.date) { const mt = String(req.date).match(/^\d+/); if (mt) day = parseInt(mt[0], 10); }
  if (type === 'ลา + OT คุมกะแทน') {
    const b = empOf(req.targetId, req.targetPerson);
    put(req, aId, y, m, day, req.leaveCode || req.targetShift);
    put(req, b && b.id, y, m, day, req.otCode || 'MT');
  } else if (type.startsWith('ขอเปลี่ยนกะ')) {
    put(req, aId, y, m, day, req.targetShift);
  } else if (type.includes('สิทธิ์วันหยุดนักขัตฤกษ์')) {
    if (parsed) parsed.days.forEach(d => put(req, aId, parsed.y, parsed.m, d, req.targetShift || 'H'));
  } else if (type.includes('สลับกะ') && req.targetPerson) {
    const b = empOf(req.targetId, req.targetPerson);
    put(req, aId, y, m, day, req.aNewCode || req.targetShift);
    put(req, b && b.id, y, m, day, req.bNewCode || req.currentShift);
  } else if (type.includes('OT')) {
    put(req, aId, y, m, day, req.targetShift);
  } else if (type.includes('ลา')) {
    put(req, aId, y, m, day, req.targetShift);
    if (req.targetPerson && (req.coverOtCode || req.otCode)) {
      const cover = empOf(req.coverId || req.targetId, req.targetPerson);
      put(req, cover && cover.id, y, m, day, req.coverOtCode || req.otCode || 'MT');
    }
  } else if (type.includes('เปลี่ยนวันหยุด') && a && req.oldDay && req.newDay) {
    put(req, aId, y, m, req.oldDay, (a.shiftType === 'Shift A' || a.shiftType === 'Shift C') ? 'M' : 'N');
    put(req, aId, y, m, req.newDay, 'O');
  }
}
// คืนทุกช่องที่คำขอนี้เคยเปลี่ยน กลับเป็นค่าก่อนอนุมัติ (ย้อนจากช่องสุดท้าย)
function revertRequestFromSchedule(req) {
  [...(req.applied || [])].reverse().forEach(a => {
    const key = monthKey(a.y, a.m);
    if (a.prev === null) {
      const byEmp = state.scheduleOverrides[key] && state.scheduleOverrides[key][a.empId];
      if (byEmp) {
        delete byEmp[a.d];
        if (!Object.keys(byEmp).length) delete state.scheduleOverrides[key][a.empId];
        if (!Object.keys(state.scheduleOverrides[key]).length) delete state.scheduleOverrides[key];
      }
    } else setShiftOverride(a.empId, a.y, a.m, a.d, a.prev);
  });
  clearPatternCache();
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
      addLog(`อนุมัติคำขอ ${req.type} ของ ${req.person} ครบ ${req.approvers.length} ฝ่ายแล้ว (วันที่ ${req.date})`);
      notifyApproved(req);
      showToast(`อนุมัติคำขอของ ${req.person} ครบ ${req.approvers.length} ฝ่ายเรียบร้อยแล้ว ✓`);
    } else {
      const nextPending = req.approvers.find(a => a.status !== 'approved');
      req.status = `รออนุมัติครบ ${req.approvers.length} ฝ่าย (${nextPending ? nextPending.role : ''})`.trim();
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
/* ---------- ยกเลิกคำขอที่อนุมัติแล้ว (เช่น ยกเลิกใบลา / ยกเลิกการเปลี่ยนกะ) ---------- */
// ตารางกะต้องกลับเป็นแบบเดิมทั้งหมด: ขั้นที่ 1 คืนวันลา · ขั้นที่ 2 คืนกะที่เปลี่ยนไป (รวมของคนที่มาแทน)
const isLeaveCode = code => !!(state.shiftDefs[code] && state.shiftDefs[code].leave);
function revertSteps(req) {
  const name = id => (findEmployeeById(id) || { name: id }).name;
  const line = a => `${name(a.empId)} · ${shortDate(a.y, a.m, a.d)} · ${a.code} → กลับเป็น ${a.from || a.prev || 'ตารางเดิม'}`;
  const applied = req.applied || [];
  return { leave: applied.filter(a => isLeaveCode(a.code)).map(line), shifts: applied.filter(a => !isLeaveCode(a.code)).map(line) };
}
export function promptCancelApproved(reqId) {
  const req = findReq(reqId);
  if (!req || !canCancelApproved(req)) { showToast('ยกเลิกคำขอนี้ไม่ได้ — เดือนนั้นถูกล็อกแล้ว หรือคำขอไม่ได้อยู่ในสถานะอนุมัติแล้ว', 'alert'); return; }
  const st = revertSteps(req);
  const list = (title, items) => (items.length ? `<h3>${esc(title)}</h3><ul class="howto">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
  openModal('ยกเลิกคำขอที่อนุมัติแล้ว', `
    <p>ยกเลิก<strong>${esc(req.type)}</strong> ของ <strong>${esc(req.person)}</strong> (${esc(req.date)}) ระบบจะคืนตารางกะทุกช่องที่คำขอนี้เปลี่ยนไปกลับเป็นแบบเดิม และแจ้งทุกคนที่เกี่ยวข้อง</p>
    ${list('ขั้นที่ 1 คืนวันลา', st.leave)}
    ${list(st.leave.length ? 'ขั้นที่ 2 คืนกะที่เปลี่ยน' : 'คืนกะที่เปลี่ยน', st.shifts)}
    ${st.leave.length ? '<p class="notice">ฝ่ายบุคคลจะได้รับแจ้งให้ยกเลิกวันลานี้ในระบบใบลาด้วย</p>' : ''}
    <div class="form-group"><label for="cancelReasonInput">เหตุผลที่ยกเลิก</label><textarea class="form-control" id="cancelReasonInput" rows="2" placeholder="เช่น ไม่ได้ลาแล้ว / คนที่มาแทนมาไม่ได้"></textarea></div>`, `
    <button type="button" class="btn btn-secondary" data-click="closeModal()">ไม่ยกเลิก</button>
    <button type="button" class="btn btn-danger" data-click="confirmCancelApproved(${js(req.id)})">ยกเลิกและคืนตาราง</button>`);
}
export async function confirmCancelApproved(reqId) {
  const req = findReq(reqId);
  if (!req || !canCancelApproved(req)) return;
  const reason = (($('#cancelReasonInput') || {}).value || '').trim();
  if (!reason) { showToast('กรุณาระบุเหตุผลที่ยกเลิก', 'alert'); ($('#cancelReasonInput') || { focus() {} }).focus(); return; }
  const st = revertSteps(req);
  revertRequestFromSchedule(req);
  req.status = 'ยกเลิกแล้ว';
  req.cancelReason = reason;
  req.cancelledAfterApproval = true;
  addLog(`ยกเลิก${req.type} ของ ${req.person} (วันที่ ${req.date}) หลังอนุมัติแล้ว และคืนตารางกะเดิม — เหตุผล: ${reason}`);
  const approverKeys = (req.approvers || []).map(a => stepKey(a.role));
  notify([...partiesOf(req), ...approverKeys], 'ยกเลิกคำขอที่อนุมัติแล้ว ตารางกะกลับเป็นแบบเดิม', `${req.type} ของ ${req.person} · ${req.date} · เหตุผล: ${reason}`, req.id);
  if (st.leave.length) notify('hr', 'ยกเลิกวันลาในระบบใบลา', `${req.person} · ${req.type} · ${req.date} — กรุณายกเลิกวันลานี้ในระบบใบลา`, req.id);
  saveLocal();
  merge();
  closeModal();
  showToast('ยกเลิกคำขอและคืนตารางกะเดิมเรียบร้อยแล้ว');
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
