/* ==========================================================================
   ตารางกะของพนักงานแต่ละคน
   --------------------------------------------------------------------------
   ลำดับการหาค่าในแต่ละช่อง: ค่าที่เปลี่ยนตามคำขอที่อนุมัติแล้ว → ตารางจริงจากฐานข้อมูล
   → ค่าคาดการณ์ตามรอบหมุนเวียน 8 วัน (เช้า 2 หยุด 2 ดึก 2 หยุด 2) สำหรับเดือนที่ยังไม่มีข้อมูล
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { getTeamFamilyForYear } from './annual.js';
import { isoOf, monthKey } from './dates.js';
import { getTeamKeyByLabel } from './employees.js';

/* ---------- ตารางกะจริงจากฐานข้อมูล ---------- */
export function hasScheduleDataForMonth(year, month) {
  const r = state.apiMonths[monthKey(year, month)];
  return !!(r && r.assignments && r.assignments.length);
}
// เดือนแรกที่มีข้อมูลจริง ใช้เป็นฐานคาดการณ์รอบกะของเดือนอื่น
export function dataMonth() {
  const keys = Object.keys(state.apiMonths).filter(k => state.apiMonths[k].assignments && state.apiMonths[k].assignments.length)
    .map(k => k.split('-').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return keys.length ? { y: keys[0][0], m: keys[0][1] } : { y: DEMO_TODAY.getFullYear(), m: DEMO_TODAY.getMonth() };
}
export function hasAnyScheduleData() { return Object.values(state.apiMonths).some(r => r.assignments && r.assignments.length); }

/* ---------- ค่าคาดการณ์ (รอบ 8 วัน: เช้า 2 หยุด 2 ดึก 2 หยุด 2) ---------- */
const ROTATION_CYCLE_DAYS = 8;
export const LEAVE = new Set(['V', 'B', 'S', 'H', 'VG', 'VGh']);
const patternCache = {};
export function clearPatternCache() { Object.keys(patternCache).forEach(k => { delete patternCache[k]; }); }
function familyOf(code) {
  if (code === 'O') return 'O';
  const parts = String(code).split('/');
  // รหัสสลับ เช่น "N/M": ส่วนหลังคือกะเดิมตามรอบ
  for (let i = parts.length - 1; i >= 0; i--) {
    const d = state.shiftDefs[parts[i]];
    if (!LEAVE.has(parts[i]) && d && ['M', 'N', 'O', 'D'].includes(d.family)) return d.family;
  }
  return null;
}
function basePattern(emp) {
  if (patternCache[emp.id]) return patternCache[emp.id];
  const base = dataMonth();
  const codes = state.apiCodes[emp.id] || {};
  const votes = Array.from({ length: ROTATION_CYCLE_DAYS }, () => ({}));
  const start = new Date(base.y, base.m, 1);
  Object.keys(codes).forEach(iso => {
    const dt = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    const diff = Math.round((dt - start) / 86400000);
    const pos = ((diff % ROTATION_CYCLE_DAYS) + ROTATION_CYCLE_DAYS) % ROTATION_CYCLE_DAYS;
    const fam = familyOf(codes[iso]);
    if (fam) votes[pos][fam] = (votes[pos][fam] || 0) + 1;
  });
  let pattern = votes.map(v => { const e = Object.entries(v); if (!e.length) return null; e.sort((a, b) => b[1] - a[1]); return e[0][0]; });
  if (pattern.every(p => p === null)) {
    // พนักงานใหม่ที่ยังไม่มีตารางในฐานข้อมูล: ใช้รอบเดียวกับหัวหน้ากะของทีม
    const team = state.shiftsData[getTeamKeyByLabel(emp.shiftType)];
    const sup = team && team.employees.find(e => e.id === team.supervisorId && e.id !== emp.id);
    pattern = sup ? basePattern(sup) : Array(ROTATION_CYCLE_DAYS).fill('O');
  } else pattern = pattern.map(p => p || 'O');
  patternCache[emp.id] = pattern;
  return pattern;
}
// ทิศทางกะตามธรรมชาติของทีม (เริ่มเช้าก่อน หรือดึกก่อน) อ่านจากตารางจริง
export function naturalFamily(team) {
  const t = state.shiftsData[getTeamKeyByLabel(team)];
  const sup = t && (t.employees.find(e => e.id === t.supervisorId) || t.employees[0]);
  if (!sup) return 'M';
  const p = basePattern(sup);
  const first = p.findIndex((c, i) => c !== 'O' && p[(i + ROTATION_CYCLE_DAYS - 1) % ROTATION_CYCLE_DAYS] === 'O');
  return first >= 0 ? p[first] : 'M';
}
export const NATURAL_TEAM_FAMILY = new Proxy({}, { get: (_, team) => naturalFamily(String(team)) });

export function getShiftCodeForDate(emp, year, month, day) {
  if (!emp) return 'O';
  const ov = state.scheduleOverrides[monthKey(year, month)];
  if (ov && ov[emp.id] && ov[emp.id][day]) return ov[emp.id][day];
  const real = state.apiCodes[emp.id] && state.apiCodes[emp.id][isoOf(year, month, day)];
  if (real) return real;
  if (hasScheduleDataForMonth(year, month)) return 'O';
  const base = dataMonth();
  const diff = Math.round((new Date(year, month, day) - new Date(base.y, base.m, 1)) / 86400000);
  const pos = ((diff % ROTATION_CYCLE_DAYS) + ROTATION_CYCLE_DAYS) % ROTATION_CYCLE_DAYS;
  let code = basePattern(emp)[pos];
  const nat = naturalFamily(emp.shiftType), yr = getTeamFamilyForYear(emp.shiftType, year);
  if (nat && yr && nat !== yr) code = code === 'M' ? 'N' : code === 'N' ? 'M' : code;
  return code;
}
export function setShiftOverride(empId, year, month, day, code) {
  const key = monthKey(year, month);
  if (!state.scheduleOverrides[key]) state.scheduleOverrides[key] = {};
  if (!state.scheduleOverrides[key][empId]) state.scheduleOverrides[key][empId] = {};
  state.scheduleOverrides[key][empId][day] = code;
}
export function isMonthLocked(year, month) {
  if (year < DEMO_TODAY.getFullYear()) return true;
  return year === DEMO_TODAY.getFullYear() && month < DEMO_TODAY.getMonth();
}
