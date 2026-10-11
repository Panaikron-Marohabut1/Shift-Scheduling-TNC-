/* ==========================================================================
   แจ้งเตือน: ใครควรได้รับแจ้งเมื่อมีการเปลี่ยนแปลง และสถานะอ่านแล้ว/ยังไม่อ่าน
   --------------------------------------------------------------------------
   มาจาก 2 ที่ แล้วรวมเป็นรายการเดียวให้หน้าจอ
   - ฐานข้อมูล (GET /api/notifications): ระบบหลังบ้านสร้างให้เองเมื่อมีการยื่น อนุมัติ ไม่อนุมัติ
     หรือยกเลิกคำขอสลับกะ
   - LOCAL: เรื่องที่ระบบหลังบ้านยังไม่มี (คำขอประเภทอื่น ประกาศตารางรายปี วันหยุด ตั้งค่า
     แก้ข้อมูลพนักงาน คนขับรถรับทราบ) เก็บในเบราว์เซอร์จนกว่าระบบหลังบ้านจะมี API
     ตอนต่อ API ให้เปลี่ยนที่ notify() จุดเดียว

   ผู้รับเขียนเป็น "กุญแจ": emp:<รหัสพนักงาน>, sup:<ทีม A–D>, mgr (ผู้จัดการ), hr (ฝ่ายบุคคล),
   driver (คนขับรถ), all (ทุกคน) — ผู้ที่ทำรายการเองไม่ได้รับแจ้งเรื่องที่ตัวเองทำ
   ========================================================================== */

import { saveLocal, state } from '../../app/state.js';
import { currentEmp, isSupervisorRoleName } from '../../shared/scheduling/employees.js';

const KEEP = 300; // เก็บแจ้งเตือนในเครื่องล่าสุดไม่เกินจำนวนนี้

// ผู้ใช้ที่เข้าสู่ระบบอยู่ (ใช้แยกสถานะอ่านแล้วของแต่ละบัญชี)
const meKey = () => (state.actor ? `u${state.actor.userId}` : '');

// กุญแจผู้รับที่ตรงกับผู้ใช้คนนี้
export function myKeys() {
  const keys = ['all'];
  const role = state.activeRole;
  if (role === 'Manager') keys.push('mgr');
  else if (role === 'HR') keys.push('hr');
  else if (role === 'Contractor / Van Driver') keys.push('driver');
  else if (isSupervisorRoleName(role)) keys.push(`sup:${role.slice(-1)}`);
  const me = currentEmp();
  if (me) keys.push(`emp:${me.id}`);
  return keys;
}

// ขั้นอนุมัติ (ข้อความ) → ผู้รับ: "ผู้จัดการ..." → mgr, "Shift Supervisor B (...)" / "(Shift B)" / "หัวหน้ากะ B" → sup:B
export function stepKey(role) {
  const text = String(role || '');
  if (text.includes('ผู้จัดการ') || /Manager/.test(text)) return 'mgr';
  const m = /(?:Supervisor|Shift|กะ)\s+([A-D])\b/.exec(text);
  return m ? `sup:${m[1]}` : '';
}
// คนที่เกี่ยวข้องกับคำขอ: ผู้ยื่น คู่สลับ และผู้มาทำแทน
export function partiesOf(req) {
  return [req.requesterId, req.targetId, req.coverId].filter(Boolean).map(id => `emp:${id}`);
}

// LOCAL: สร้างแจ้งเตือน — ตอนระบบหลังบ้านมี API ให้ส่ง POST ไปที่นี่แทน
export function notify(to, title, message, reqId = null) {
  const keys = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
  if (!keys.length) return;
  const ts = Date.now();
  state.localNotifications.unshift({ id: `n${ts}-${Math.random().toString(36).slice(2, 7)}`, ts, to: keys, by: meKey(), title, message, reqId, readBy: [] });
  state.localNotifications.length = Math.min(state.localNotifications.length, KEEP);
  saveLocal();
}

// แจ้งเตือนทั้งหมดของผู้ใช้คนนี้ ใหม่สุดก่อน
export function myNotifications() {
  const me = meKey();
  const keys = new Set(myKeys());
  const readApi = new Set(state.notifRead[me] || []);
  const local = state.localNotifications
    .filter(n => n.by !== me && n.to.some(k => keys.has(k)))
    .map(n => ({ id: n.id, ts: n.ts, title: n.title, message: n.message, reqId: n.reqId, read: n.readBy.includes(me) }));
  const fromApi = state.apiNotifications.map(n => {
    // ข้อความจากระบบหลังบ้านเป็นข้อความกลาง ๆ จึงเติมว่าเป็นคำขอของใคร วันไหน (ถ้าผู้ใช้เห็นคำขอนั้น)
    const req = state.requests.find(r => r.api && String(r.id) === String(n.request_id));
    return {
      id: `api-${n.notification_id}`, ts: Date.parse(n.created_at) || 0, title: n.title,
      message: req ? `${req.type} ของ ${req.person} · ${req.date}` : n.message, reqId: n.request_id,
      read: !!n.is_read || readApi.has(n.notification_id)
    };
  });
  return [...local, ...fromApi].sort((a, b) => b.ts - a.ts);
}
export const unreadCount = () => myNotifications().filter(n => !n.read).length;

// LOCAL: สถานะอ่านแล้ว (ระบบหลังบ้านยังไม่มี API บันทึกว่าอ่านแล้ว จึงจำไว้ในเครื่อง)
export function markRead(id) {
  const me = meKey();
  if (String(id).startsWith('api-')) {
    const list = state.notifRead[me] || (state.notifRead[me] = []);
    const n = Number(String(id).slice(4));
    if (!list.includes(n)) list.push(n);
  } else {
    const item = state.localNotifications.find(n => n.id === id);
    if (item && !item.readBy.includes(me)) item.readBy.push(me);
  }
  saveLocal();
}
export function markAllRead() { myNotifications().filter(n => !n.read).forEach(n => markRead(n.id)); }
