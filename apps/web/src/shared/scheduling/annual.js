/* ==========================================================================
   ตารางรายปี: ทิศทางกะของแต่ละทีม วันหยุดนักขัตฤกษ์ และการประกาศใช้ทั้งปี
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { monthKey, pad2, parseThaiDate, thaiMonthName } from './dates.js';
import demoHolidays from './demo-holidays.json' with { type: 'json' };
import { naturalFamily } from './roster.js';

export const ANNUAL_SCHEDULE_TEAMS = ['Shift A', 'Shift B', 'Shift C', 'Shift D'];
/* ---------- ตารางรายปี วันหยุดนักขัตฤกษ์ และการประกาศใช้ ---------- */
export function getAnnualConfig(year) {
  if (!state.annualScheduleConfig[year]) state.annualScheduleConfig[year] = { teamFamily: {}, holidays: [] };
  const cfg = state.annualScheduleConfig[year];
  if (!cfg.teamFamily) cfg.teamFamily = {};
  return cfg;
}
export function getHolidaysForYear(year) {
  if (state.actor?.remotePilot) return HOLIDAYS[year] || [];
  return getAnnualConfig(year).holidays;
}
export function getTeamFamilyForYear(team, year) { return getAnnualConfig(year).teamFamily[team] || naturalFamily(team) || 'M'; }

// ข้อมูลเดโมชุดเดียวกับที่ใช้แสดงผลคำนวณย้อนหลัง
const HOLIDAYS = {};
for (const { date, through, name } of demoHolidays) {
  const [year, month, day] = date.split('-');
  const days = through ? `${day}–${through.slice(-2)}` : day;
  (HOLIDAYS[year] ??= []).push(`${days} ${thaiMonthName(Number(month) - 1, 'short')} ${Number(year) + 543} (${name})`);
}
export function seedYearData() {
  Object.keys(HOLIDAYS).forEach(y => {
    const cfg = state.annualScheduleConfig[y];
    if (!cfg) state.annualScheduleConfig[y] = { teamFamily: {}, holidays: HOLIDAYS[y].slice() };
    else if (!cfg.holidays || !cfg.holidays.length) cfg.holidays = HOLIDAYS[y].slice();
  });
  // ปีปัจจุบันใช้งานอยู่แล้วจึงถือว่าประกาศใช้แล้ว ปีถัดไปเป็นฉบับร่างรอผู้จัดการ
  if (!state.publishedMonths.length) {
    for (let m = 0; m < 12; m++) state.publishedMonths.push(`${DEMO_TODAY.getFullYear()}-${pad2(m + 1)}`);
  }
}
export function isYearPublished(y) {
  for (let m = 0; m < 12; m++) if (state.publishedMonths.indexOf(`${y}-${pad2(m + 1)}`) < 0) return false;
  return true;
}

export function hasCentralHolidayCalendar(year, month) {
  return !!state.apiMonths[monthKey(year, month)]?.holidays?.length;
}

export function holidayDates(year) {
  const out = {};
  (getHolidaysForYear(year) || []).forEach(text => {
    const p = parseThaiDate(text);
    if (!p || p.y !== year) return;
    const name = (/\(([^)]+)\)/.exec(text) || [])[1] || 'วันหยุดนักขัตฤกษ์';
    p.days.forEach(d => { out[`${p.m}-${d}`] = name; });
  });
  for (let month = 0; month < 12; month++) {
    if (!hasCentralHolidayCalendar(year, month)) continue;
    const central = state.apiMonths[monthKey(year, month)].holidays;
    for (const key of Object.keys(out)) if (key.startsWith(`${month}-`)) delete out[key];
    for (const holiday of central) out[`${month}-${Number(holiday.date.slice(-2))}`] = holiday.name;
  }
  return out;
}
