/* ==========================================================================
   ตารางกะของพนักงานแต่ละคน
   --------------------------------------------------------------------------
   ลำดับการหาค่าในแต่ละช่อง: ค่าที่เปลี่ยนตามคำขอที่อนุมัติแล้ว → ตารางจริงจากฐานข้อมูล
   → ค่าคาดการณ์ตามรอบหมุนเวียน 8 วัน (เช้า 2 หยุด 2 ดึก 2 หยุด 2) สำหรับเดือนที่ยังไม่มีข้อมูล
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { getTeamFamilyForYear, isYearPublished } from './annual.js';
import { isoOf, monthKey } from './dates.js';
import { getTeamKeyByLabel } from './employees.js';
import rotation from './rotation.json' with { type: 'json' };

const dayMs = 86_400_000;
const rotationAnchor = Date.parse(rotation.anchor);
const offsetOf = team => rotation.offsets[team?.replace('Shift ', '')];
function rotationShift(team, workDate) {
  const offset = offsetOf(team);
  if (!Number.isInteger(offset)) return null;
  const index = (Date.parse(workDate) - rotationAnchor) / dayMs + offset;
  const length = rotation.cycle.length;
  return rotation.cycle[((index % length) + length) % length];
}

/* ---------- ตารางกะจริงจากฐานข้อมูล ---------- */
export function hasScheduleDataForMonth(year, month) {
  const r = state.apiMonths[monthKey(year, month)];
  return !!(r && r.assignments && r.assignments.length);
}
export function isSchedulePublished(year, month) {
  const schedule = state.apiMonths[monthKey(year, month)]?.schedule;
  if (state.actor?.remotePilot || state.actor?.swapPolicy || state.actor?.monthClose) return schedule?.status === 'PUBLISHED';
  return isYearPublished(year);
}
// เดือนแรกที่มีข้อมูลจริง ใช้เป็นฐานคาดการณ์รอบกะของเดือนอื่น
export function dataMonth() {
  const keys = Object.keys(state.apiMonths).filter(k => state.apiMonths[k].assignments && state.apiMonths[k].assignments.length)
    .map(k => k.split('-').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return keys.length ? { y: keys[0][0], m: keys[0][1] } : { y: DEMO_TODAY.getFullYear(), m: DEMO_TODAY.getMonth() };
}
export function hasAnyScheduleData() { return Object.values(state.apiMonths).some(r => r.assignments && r.assignments.length); }

export function hasPilotProjection(year, month) {
  if (!state.actor?.remotePilot || hasScheduleDataForMonth(year, month)) return false;
  const schedule = state.apiMonths[monthKey(year, month)]?.schedule;
  return (schedule === null || schedule?.status === 'DRAFT') && hasAnyScheduleData();
}

/* ---------- ค่าคาดการณ์ (รอบ 8 วัน: เช้า 2 หยุด 2 ดึก 2 หยุด 2) ---------- */
const ROTATION_CYCLE_DAYS = 8;
export const LEAVE = new Set(['L', 'V', 'B', 'S', 'H', 'VG', 'VGh']);
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
  const offset = offsetOf(team);
  if (Number.isInteger(offset)) {
    const arranged = rotation.cycle.slice(offset).concat(rotation.cycle.slice(0, offset));
    return arranged.find(code => code !== 'O');
  }
  const t = state.shiftsData[getTeamKeyByLabel(team)];
  const sup = t && (t.employees.find(e => e.id === t.supervisorId) || t.employees[0]);
  if (!sup) return 'M';
  const p = basePattern(sup);
  const first = p.findIndex((c, i) => c !== 'O' && p[(i + ROTATION_CYCLE_DAYS - 1) % ROTATION_CYCLE_DAYS] === 'O');
  return first >= 0 ? p[first] : 'M';
}
export const NATURAL_TEAM_FAMILY = new Proxy({}, { get: (_, team) => naturalFamily(String(team)) });

export function getShiftOverride(emp, year, month, day) {
  if (state.actor?.remotePilot) return undefined;
  if (state.actor?.monthClose && isMonthLocked(year, month)) return undefined;
  if (state.actor?.swapPolicy && state.apiAssign[emp.id]?.[isoOf(year, month, day)]) return undefined;
  return state.scheduleOverrides[monthKey(year, month)]?.[emp.id]?.[day];
}

export function getShiftCodeForDate(emp, year, month, day) {
  if (!emp) return 'O';
  const date = isoOf(year, month, day);
  if (emp.productionExitOn && date >= emp.productionExitOn) return 'O';
  const override = getShiftOverride(emp, year, month, day);
  if (override) return override;
  const real = state.apiCodes[emp.id]?.[date];
  if (real) return real;
  if (hasScheduleDataForMonth(year, month)) return 'O';
  const scheduled = rotationShift(getTeamForDate(emp, year, month, day), isoOf(year, month, day));
  if (scheduled && (state.actor?.remotePilot || state.actor?.swapPolicy || state.actor?.monthClose)) return scheduled;
  const base = dataMonth();
  const diff = Math.round((new Date(year, month, day) - new Date(base.y, base.m, 1)) / 86400000);
  const pos = ((diff % ROTATION_CYCLE_DAYS) + ROTATION_CYCLE_DAYS) % ROTATION_CYCLE_DAYS;
  let code = scheduled || basePattern(emp)[pos];
  const nat = naturalFamily(emp.shiftType), yr = getTeamFamilyForYear(emp.shiftType, year);
  if (nat && yr && nat !== yr) code = code === 'M' ? 'N' : code === 'N' ? 'M' : code;
  return code;
}
export function getCalendarShiftCode(emp, year, month, day) {
  const slot = state.apiAssign[emp?.id]?.[isoOf(year, month, day)];
  if (slot?.holidayLeave) return 'H';
  return slot?.holidayOvertime?.shiftCode || getShiftCodeForDate(emp, year, month, day);
}

// true = ทำงาน, false = ยืนยันว่าไม่ได้ทำงาน, null = ยังไม่มีข้อมูลยืนยัน
function workingOn(emp, date) {
  const year = date.getFullYear(), month = date.getMonth(), day = date.getDate();
  if (!isSchedulePublished(year, month)) return null;
  const override = getShiftOverride(emp, year, month, day);
  const slot = state.apiAssign[emp.id]?.[isoOf(year, month, day)];
  if (override === undefined && (!slot || slot.status !== 'ACTIVE')) return null;
  const parts = String(override ?? slot.shift_code).split('/');
  const code = parts.length > 2 ? parts.at(-1) : parts[0];
  if (slot?.holidayLeave || code === 'O' || code === '-' || LEAVE.has(code)) return false;
  if (override === undefined && typeof slot.is_working === 'boolean') return slot.is_working;
  return state.shiftDefs[code] ? true : null;
}

export function getCurrentWorkRun(emp, today) {
  const todayWorking = workingOn(emp, today);
  if (todayWorking !== true) return todayWorking === false ? { throughToday: 0 } : null;

  function walk(direction) {
    const cursor = new Date(today);
    let edge = today, days = 0;
    cursor.setDate(cursor.getDate() + direction);
    let working = workingOn(emp, cursor);
    while (working === true) {
      edge = new Date(cursor);
      days++;
      cursor.setDate(cursor.getDate() + direction);
      working = workingOn(emp, cursor);
    }
    return { edge, days, complete: working === false };
  }

  const past = walk(-1), future = walk(1);
  return {
    throughToday: past.days + 1,
    throughTodayComplete: past.complete,
    total: past.days + 1 + future.days,
    totalComplete: past.complete && future.complete,
    start: past.edge,
    end: future.edge,
  };
}

export function getTeamForDate(emp, year, month, day) {
  const date = isoOf(year, month, day);
  if (emp.productionExitOn && date >= emp.productionExitOn) return null;
  if (state.actor?.remotePilot || state.actor?.swapPolicy || state.actor?.monthClose || state.actor?.peopleManagement) {
    const assignments = state.apiAssign[emp.id];
    const team = assignments?.[date]?.team_code;
    if (team) return `Shift ${team}`;
    if (assignments && hasPilotProjection(year, month)) {
      let previous, first;
      for (const slot of Object.values(assignments)) {
        if (!slot.team_code) continue;
        if (!first || slot.work_date < first.work_date) first = slot;
        if (slot.work_date < date && (!previous || slot.work_date > previous.work_date)) previous = slot;
      }
      const projectedTeam = (previous || first)?.team_code;
      if (projectedTeam) return `Shift ${projectedTeam}`;
    }
  }
  return emp.shiftType;
}
export function setShiftOverride(empId, year, month, day, code) {
  if (state.actor?.remotePilot) return;
  const key = monthKey(year, month);
  if (!state.scheduleOverrides[key]) state.scheduleOverrides[key] = {};
  if (!state.scheduleOverrides[key][empId]) state.scheduleOverrides[key][empId] = {};
  state.scheduleOverrides[key][empId][day] = code;
}
const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', dateStyle: 'short' });

export function isPastScheduleDate(year, month, day) {
  const today = state.actor?.swapPolicy || state.actor?.monthClose
    ? bangkokDate.format(new Date())
    : isoOf(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth(), DEMO_TODAY.getDate());
  return isoOf(year, month, day) < today;
}

export function isMonthLocked(year, month) {
  if (state.actor?.monthClose) {
    return isoOf(year, month, 1).slice(0, 7) < bangkokDate.format(new Date()).slice(0, 7);
  }
  if (year < DEMO_TODAY.getFullYear()) return true;
  return year === DEMO_TODAY.getFullYear() && month < DEMO_TODAY.getMonth();
}
