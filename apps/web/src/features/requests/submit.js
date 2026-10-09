/* ==========================================================================
   บันทึกคำขอเดโม (LOCAL) และสิ่งที่ทำหลังส่งคำขอสำเร็จ
   ตอนระบบหลังบ้านมี API สำหรับประเภทนั้นแล้ว ให้เปลี่ยนที่ saveLocalRequest() จุดเดียว
   ========================================================================== */

import { addLog, merge } from '../../app/data.js';
import { saveLocal, state } from '../../app/state.js';
import { closeModal } from '../../shared/modal.js';
import { findEmployeeById } from '../../shared/scheduling/employees.js';
import { showToast } from '../../shared/toast.js';
import { notify, partiesOf, stepKey } from '../notifications/store.js';
import { routeApprovers } from './form-parts.js';

/* ==========================================================================
   ส่งคำขอ
   ========================================================================== */
let afterSubmit = () => {};
export function onSubmitted(fn) { afterSubmit = fn; }
export const monthText = (style = 'long') => new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: style, year: 'numeric' });

// LOCAL: บันทึกคำขอเดโมในเบราว์เซอร์ — ตอนต่อ API ให้เปลี่ยนเป็น POST ไปยังระบบหลังบ้านที่นี่จุดเดียว
export function saveLocalRequest(req, logText, actor) {
  const id = Date.now();
  const requester = findEmployeeById(req.requesterId);
  const roles = routeApprovers(requester, req.approvers.map(a => a.role));
  req.approvers = roles.map(role => ({ role, status: 'pending' }));
  state.localRequests.unshift({ id, ts: id, y: state.currentYear, m: state.currentMonth, submittedAt: 'เมื่อสักครู่', ...req });
  // แจ้งผู้อนุมัติขั้นแรก และคนที่ถูกระบุในคำขอ (คู่สลับ / ผู้มาทำแทน)
  notify(stepKey(req.approvers[0] && req.approvers[0].role), 'คำขอใหม่รอการอนุมัติของคุณ', `${req.person} · ${req.type} · ${req.date}`, id);
  notify(partiesOf(req).filter(k => k !== `emp:${req.requesterId}`), 'มีคำขอที่เกี่ยวข้องกับคุณ', `${req.person} ระบุชื่อคุณในคำขอ${req.type} · ${req.date}`, id);
  addLog(logText, { actor: actor.name, employeeId: actor.id, avatar: actor.initials });
  saveLocal();
}
export function done(message) {
  closeModal();
  showToast(message);
  merge();
  afterSubmit();
}
