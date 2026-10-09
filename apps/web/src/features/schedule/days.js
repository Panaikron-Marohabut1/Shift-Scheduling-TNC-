/* ==========================================================================
   วันในปฏิทิน: วันนี้ เสาร์-อาทิตย์ วันหยุดนักขัตฤกษ์ และข้อความปีที่ยังไม่ประกาศใช้
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { holidayDates } from '../../shared/scheduling/annual.js';

export function holidaysOf(y) { return holidayDates(y); }
export function isToday(y, m, d) { return d === DEMO_TODAY.getDate() && m === DEMO_TODAY.getMonth() && y === DEMO_TODAY.getFullYear(); }
export function dayClass(y, m, d, hol) {
  const w = new Date(y, m, d).getDay();
  const c = [];
  if (hol[`${m}-${d}`]) c.push('hol');
  else if (w === 0 || w === 6) c.push('we');
  if (w === 1 && d > 1) c.push('wk');
  if (isToday(y, m, d)) c.push('tdy');
  return c.join(' ');
}
export function draftNote(y) {
  return state.activeRole === 'Manager'
    ? `ตารางกะปี ${y + 543} ยังเป็นฉบับร่าง คนอื่นดูได้อย่างเดียว ตรวจลำดับกะและวันหยุดในหน้า "ตารางรายปี" แล้วกด "อนุมัติและประกาศใช้ทั้งปี" เพื่อให้หัวหน้ากะและพนักงานเริ่มใช้งาน`
    : `ตารางกะปี ${y + 543} ยังไม่ประกาศใช้ (ฉบับร่าง รอผู้จัดการอนุมัติ) ดูได้อย่างเดียว ยังยื่นคำขอไม่ได้`;
}
