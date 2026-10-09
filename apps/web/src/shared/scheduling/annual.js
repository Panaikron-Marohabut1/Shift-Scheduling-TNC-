/* ==========================================================================
   ตารางรายปี: ทิศทางกะของแต่ละทีม วันหยุดนักขัตฤกษ์ และการประกาศใช้ทั้งปี
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { pad2, parseThaiDate } from './dates.js';
import { naturalFamily } from './roster.js';

export const ANNUAL_SCHEDULE_TEAMS = ['Shift A', 'Shift B', 'Shift C', 'Shift D'];
/* ---------- ตารางรายปี วันหยุดนักขัตฤกษ์ และการประกาศใช้ ---------- */
export function getAnnualConfig(year) {
  if (!state.annualScheduleConfig[year]) state.annualScheduleConfig[year] = { teamFamily: {}, holidays: [] };
  const cfg = state.annualScheduleConfig[year];
  if (!cfg.teamFamily) cfg.teamFamily = {};
  return cfg;
}
export function getHolidaysForYear(year) { return getAnnualConfig(year).holidays; }
export function getTeamFamilyForYear(team, year) { return getAnnualConfig(year).teamFamily[team] || naturalFamily(team) || 'M'; }

// วันหยุดราชการไทย ปี 2569 ตามประกาศคณะรัฐมนตรี (ผู้จัดการแก้ไขได้ในหน้า "ตารางรายปี")
const HOLIDAYS = {
  2026: ['01 ม.ค. 2569 (วันขึ้นปีใหม่)', '02 ม.ค. 2569 (วันหยุดพิเศษ)', '03 มี.ค. 2569 (วันมาฆบูชา)', '06 เม.ย. 2569 (วันจักรี)', '13–15 เม.ย. 2569 (วันสงกรานต์)',
    '01 พ.ค. 2569 (วันแรงงานแห่งชาติ)', '04 พ.ค. 2569 (วันฉัตรมงคล)', '13 พ.ค. 2569 (วันพืชมงคล)', '31 พ.ค. 2569 (วันวิสาขบูชา)', '01 มิ.ย. 2569 (ชดเชยวันวิสาขบูชา)',
    '03 มิ.ย. 2569 (วันเฉลิมพระชนมพรรษา พระราชินี)', '28 ก.ค. 2569 (วันเฉลิมพระชนมพรรษา ร.10)', '29 ก.ค. 2569 (วันอาสาฬหบูชา)', '30 ก.ค. 2569 (วันเข้าพรรษา)',
    '12 ส.ค. 2569 (วันแม่แห่งชาติ)', '13 ต.ค. 2569 (วันนวมินทรมหาราช)', '23 ต.ค. 2569 (วันปิยมหาราช)', '05 ธ.ค. 2569 (วันพ่อแห่งชาติ)', '07 ธ.ค. 2569 (ชดเชยวันพ่อแห่งชาติ)',
    '10 ธ.ค. 2569 (วันรัฐธรรมนูญ)', '31 ธ.ค. 2569 (วันสิ้นปี)']
};
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

export function holidayDates(year) {
  const out = {};
  (getHolidaysForYear(year) || []).forEach(text => {
    const p = parseThaiDate(text);
    if (!p || p.y !== year) return;
    const name = (/\(([^)]+)\)/.exec(text) || [])[1] || 'วันหยุดนักขัตฤกษ์';
    p.days.forEach(d => { out[`${p.m}-${d}`] = name; });
  });
  return out;
}
