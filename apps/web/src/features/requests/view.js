/* ==========================================================================
   คำขอ: รายการ ปุ่มอนุมัติ/ไม่อนุมัติ/ยกเลิก และรายละเอียด
   --------------------------------------------------------------------------
   คำขอสลับกะจากฐานข้อมูล (req.api) → ปุ่มตามสิทธิ์ที่ระบบหลังบ้านส่งมา (canDecide / canCancel)
                                        และส่งผลไปที่ API (decisions / cancel)
   คำขอเดโม (LOCAL) → ลำดับอนุมัติและการลงตารางทำในเบราว์เซอร์
   ========================================================================== */
import { state, saveLocal } from '../../app/state.js';
import { $, esc, openModal, closeModal, showToast } from '../../shared/dom.js';
import {
  getAllEmployees, findEmployeeById, isSupervisorRoleName, getSupervisorShiftType, setShiftOverride, parseThaiDate, currentEmp
} from '../../shared/scheduling.js';
import { pageHead } from '../schedule/view.js';
import { addLog, merge, decideApi, cancelApi } from '../../app/data.js';

let afterChange = async () => {};
export function onRequestChanged(fn) { afterChange = fn; }

export function statusCls(req) {
  if (req.status === 'อนุมัติแล้ว') return 'ok';
  if (req.status === 'ไม่อนุมัติ') return 'bad';
  if (req.status === 'ยกเลิกแล้ว') return '';
  return 'wait';
}

/* ---------- สิทธิ์ ---------- */
const empOf = (id, name) => findEmployeeById(id) || getAllEmployees().find(e => e.name === name) || null;
export function canUserReviewRequestForRole(req, roleName) {
  if (req.api) return roleName === state.activeRole && req.canDecide;
  if (!isSupervisorRoleName(roleName)) return false;
  if (!req.status || !req.status.includes('รอ')) return false;
  const me = currentEmp();
  if (me && req.requesterId === me.id && roleName === state.activeRole) return false; // หัวหน้ากะไม่อนุมัติคำขอของตัวเอง
  const next = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  if (!next) return false;
  const letter = roleName.slice(-1);
  const team = state.shiftsData[`shift${letter}`];
  const sup = team && team.employees.find(e => e.id === team.supervisorId);
  const supName = sup ? sup.name.split(' ')[0] : '';
  const text = next.role || '';
  return text.includes(`Supervisor ${letter}`) || text.includes(`กะ ${letter}`) || (supName && text.includes(supName)) || text.includes(`Shift ${letter}`);
}
export const canUserReviewRequest = req => canUserReviewRequestForRole(req, state.activeRole);
// ขั้นที่ผู้จัดการต้องพิจารณา: ขั้น "ผู้จัดการ..." หรือขั้นหัวหน้ากะของคำขอที่หัวหน้ากะยื่นเอง
export function managerCanAct(req) {
  if (req.api || !req.status || !req.status.includes('รอ')) return false;
  const next = (req.approvers || []).find(s => s.status !== 'approved');
  if (!next) return false;
  if ((next.role || '').includes('ผู้จัดการ')) return true;
  const a = empOf(req.requesterId, req.person);
  if (!a || a.roleCategory !== 'Shift Supervisor') return false;
  const letter = String(a.shiftType || '').replace('Shift ', '');
  const t = next.role || '';
  return t.includes(`Supervisor ${letter}`) || t.includes(`Shift ${letter}`) || t.includes(a.name.split(' ')[0]);
}
export function canWithdrawRequest(req) {
  if (req.api) return req.canCancel;
  if (!req || !req.status || !req.status.includes('รอ')) return false;
  return (req.approvers || []).every(a => a.status === 'pending');
}
export function getVisibleRequests() {
  if (state.activeRole === 'Manager' || state.activeRole === 'HR') return state.requests;
  if (state.activeRole === 'Shift Employee') {
    const me = currentEmp();
    return state.requests.filter(req => req.requesterId === (me && me.id) || req.person === (me && me.name) || req.targetPerson === (me && me.name));
  }
  if (isSupervisorRoleName(state.activeRole)) {
    const supShift = getSupervisorShiftType(state.activeRole);
    return state.requests.filter(req => {
      if (req.api) return true; // ระบบหลังบ้านส่งมาเฉพาะคำขอที่หัวหน้ากะคนนี้เห็นได้
      const requester = empOf(req.requesterId, req.person);
      if (requester && requester.shiftType === supShift) return true;
      const target = req.targetPerson && empOf(req.targetId, req.targetPerson);
      return !!(target && target.shiftType === supShift);
    });
  }
  return state.requests;
}

/* ---------- หน้ารายการ ---------- */
function reqActions(req) {
  const pending = req.status.includes('รอ');
  const next = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  const detail = `<button class="btn sm" data-click="openRequestDetails(${req.id})">ดูรายละเอียด</button>`;
  const decide = `<button class="btn sm danger" data-click="promptRejectRequest(${req.id})">ไม่อนุมัติ</button><button class="btn sm primary" data-click="approveRequest(${req.id})">อนุมัติ</button>`;
  const me = currentEmp();
  const mine = me && req.requesterId === me.id;
  const withdraw = () => (canWithdrawRequest(req)
    ? `<button class="btn sm danger" data-click="withdrawRequest(${req.id})" title="ยกเลิกได้จนกว่าหัวหน้ากะจะเริ่มตรวจสอบ">ยกเลิกคำขอ</button>`
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

/* ---------- รายละเอียด ---------- */
const findReq = id => state.requests.find(r => r.id === Number(id) || r.id === id);
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
    ? `<button class="btn btn-secondary" data-click="closeModal()">ปิด</button><button class="btn btn-danger" data-click="withdrawRequest(${req.id})">ยกเลิกคำขอ</button>`
    : '<button class="btn btn-secondary" data-click="closeModal()">ปิด</button>';
  openModal('รายละเอียดคำขอ', body, foot);
}

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
      showToast(`อนุมัติคำขอของ ${req.person} ครบ 2 หัวหน้ากะเรียบร้อยแล้ว ✓`);
    } else {
      const nextPending = req.approvers.find(a => a.status !== 'approved');
      req.status = `รออนุมัติครบ 2 ฝ่าย (${nextPending ? nextPending.role : ''})`.trim();
      addLog(`ผ่านการยืนยันโดย "${step ? step.role : me.name}" สำหรับคำขอ ${req.type} ของ ${req.person} — รอหัวหน้ากะอีกฝ่ายยืนยัน`);
      showToast(`กดยืนยันแล้ว — รอ ${nextPending ? nextPending.role : 'หัวหน้ากะอีกฝ่าย'}`);
    }
  } else {
    if (req.approvers && req.approvers.length === 1) { req.approvers[0].status = 'approved'; req.approvers[0].at = timeNow(); }
    req.status = 'อนุมัติแล้ว';
    applyApprovedRequestToSchedule(req);
    addLog(`อนุมัติคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date})`);
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
    <button type="button" class="btn btn-danger" data-click="confirmRejectRequest(${req.id})">ยืนยันปฏิเสธคำขอ</button>`);
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
