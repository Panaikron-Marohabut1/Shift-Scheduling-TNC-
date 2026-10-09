/* ==========================================================================
   กฎและข้อมูลตารางกะ
   --------------------------------------------------------------------------
   - รหัสกะของแต่ละวัน: ค่าที่แก้ไข/อนุมัติในเดโม → ตารางจริงจากฐานข้อมูล → ค่าคาดการณ์ตามรอบ 2 วันสลับ 2 วัน
   - กฎตรวจคำขอ (ทำงานติดกันสูงสุด, กะดึกต่อกะเช้า, OT, โควตา, กรอบ ±7 วัน) และลำดับผู้อนุมัติ
   - วันหยุดนักขัตฤกษ์ ตารางรายปี และการประกาศใช้ทั้งปี
   กฎชุดเดียวกับเวอร์ชันต้นแบบ ShiftFlow
   ========================================================================== */
import { state, DEMO_TODAY } from '../app/state.js';

export const TH_DW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
export const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
export function thaiMonthName(monthIndex, style = 'long') { return new Date(2000, monthIndex, 1).toLocaleDateString('th-TH', { month: style }); }
export const pad2 = n => String(n).padStart(2, '0');
export const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
export const shortDate = (y, m, d) => `${TH_DW[new Date(y, m, d).getDay()]}. ${d} ${thaiMonthName(m, 'short')}`;
export const monthKey = (y, m) => `${y}-${m}`;
export const TEAM_KEYS = ['shiftA', 'shiftB', 'shiftC', 'shiftD'];
export const ANNUAL_SCHEDULE_TEAMS = ['Shift A', 'Shift B', 'Shift C', 'Shift D'];
export const OT_PICK = ['MT', 'NT'];

/* ---------- พนักงาน ---------- */
export function getAllEmployees() { return TEAM_KEYS.reduce((all, k) => all.concat(state.shiftsData[k].employees), []); }
export function findEmployeeById(id) { return getAllEmployees().find(e => e.id === String(id)); }
export function getTeamKeyByLabel(label) { return { 'Shift A': 'shiftA', 'Shift B': 'shiftB', 'Shift C': 'shiftC', 'Shift D': 'shiftD' }[label]; }
export function isSupervisorRoleName(roleName) { return /^Shift Supervisor [A-D]$/.test(roleName || ''); }
export function getSupervisorShiftType(roleName) { return isSupervisorRoleName(roleName) ? `Shift ${roleName.slice(-1)}` : 'Shift A'; }
export function getEmployeeFacingRoleLabel(roleCategory) { return { 'Shift Supervisor': 'หัวหน้ากะ', 'Shift Employee': 'พนักงานปฏิบัติ' }[roleCategory] || roleCategory; }
export function getEmployeeFacingShiftLabel(code) {
  const labels = {
    M: 'กะเช้า', MT: 'กะเช้าพร้อมทำงานล่วงเวลา', MTh: 'กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน',
    N: 'กะดึก', NT: 'กะดึกพร้อมทำงานล่วงเวลา', NTh: 'กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน',
    OT: 'ทำงานล่วงเวลา (OT)', D: 'เวลาทำการปกติ', O: 'วันหยุด',
    V: 'ลาพักร้อน', B: 'ลากิจ', S: 'ลาป่วย', H: 'วันหยุดนักขัตฤกษ์', VG: 'ลาอื่นๆ', VGh: 'ลาอื่นๆ ครึ่งวัน'
  };
  return labels[code] || (state.shiftDefs[code] && state.shiftDefs[code].label) || code;
}
// ผู้ใช้ที่เข้าสู่ระบบ (เฉพาะหัวหน้ากะและพนักงาน)
export function currentEmp() {
  const a = state.actor;
  if (!a || a.employeeId == null) return null;
  return getAllEmployees().find(e => e.eid === a.employeeId) || null;
}

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
const LEAVE = new Set(['V', 'B', 'S', 'H', 'VG', 'VGh']);
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

const MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// อ่าน "14 สิงหาคม 2569", "16 → 18 สิงหาคม 2569", "12 ส.ค. 2569 (วันแม่)", "13–15 เม.ย. 2569"
export function parseThaiDate(text) {
  const s = String(text || '');
  let m = -1, at = -1;
  MONTH_LONG.forEach((name, i) => { const p = s.indexOf(name); if (p >= 0 && (at < 0 || p < at)) { m = i; at = p; } });
  if (m < 0) MONTH_SHORT.forEach((name, i) => { const p = s.indexOf(name); if (p >= 0 && (at < 0 || p < at)) { m = i; at = p; } });
  if (m < 0) return null;
  const yearMatch = /(\d{4})/.exec(s.slice(at));
  if (!yearMatch) return null;
  let y = Number(yearMatch[1]);
  if (y > 2400) y -= 543;
  const head = s.slice(0, at);
  const range = /(\d{1,2})\s*[–-]\s*(\d{1,2})\s*$/.exec(head.trim());
  let days = [];
  if (range) { for (let d = Number(range[1]); d <= Number(range[2]); d++) days.push(d); } else days = (head.match(/\d{1,2}/g) || []).map(Number);
  return { y, m, days };
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

/* ---------- กฎตรวจคำขอ ---------- */
function getShiftFamily(code) {
  const def = state.shiftDefs[code];
  if (!def) return 'OTHER';
  if (code === 'O') return 'O';
  if (def.leave) return 'LEAVE';
  if (code === 'D') return 'D';
  if (['M', 'MT', 'MTh'].includes(code)) return 'M';
  if (['N', 'NT', 'NTh'].includes(code)) return 'N';
  return 'OTHER';
}
function checkShiftTransitionRules(emp, targetDay, targetShiftCode) {
  const results = [];
  let hasHardBlock = false;
  const targetFamily = getShiftFamily(targetShiftCode);
  const currentCodeOnDay = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay);
  const currentFamily = getShiftFamily(currentCodeOnDay);
  const prevCode = targetDay > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;
  if (currentFamily === 'O') results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: 'วันดังกล่าวเดิมเป็นวันหยุด (O) — เปลี่ยนกะได้ทันที' });
  else results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: `วันดังกล่าวเดิมเป็นกะ ${currentCodeOnDay} — ตรวจสอบเงื่อนไขทิศทางกะด้านล่าง` });
  if (targetFamily === 'N') {
    results.push({ rule: 'เงื่อนไข 3: เปลี่ยนเป็นกะดึก (M→N / N→N)', status: 'pass', msg: 'อนุญาตให้เปลี่ยน/สลับเป็นกะดึกได้ — ตรวจสอบวันหยุดตามรอบ 6 วันด้านล่างประกอบ' });
  } else if (targetFamily === 'M') {
    if (prevFamily === 'N') {
      results.push({ rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า หลังกะดึก (N→M)', status: 'fail', msg: `วันก่อนหน้า (วันที่ ${targetDay - 1}) เป็นกะดึก (${prevCode}) — ห้ามสลับเป็นกะเช้าทันที ต้องมีวันหยุดคั่นอย่างน้อย 1 วันก่อนเข้ากะเช้า` });
      hasHardBlock = true;
    } else results.push({ rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า (M→M)', status: 'pass', msg: 'วันก่อนหน้าไม่ใช่กะดึก — อนุญาตให้เปลี่ยน/สลับเป็นกะเช้าได้' });
  }
  return { hasHardBlock, results };
}
export function validateShiftAssignment(empId, targetDay, targetShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, results: [] };
  const results = [];
  let hasHardBlock = false;
  const transition = checkShiftTransitionRules(emp, targetDay, targetShiftCode);
  results.push(...transition.results);
  if (transition.hasHardBlock) hasHardBlock = true;

  const n = daysIn(state.currentYear, state.currentMonth);
  const codes = Array.from({ length: n }, (_, i) => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, i + 1));
  codes[targetDay - 1] = targetShiftCode;
  let maxConsecutive = 0, streak = 0;
  for (const s of codes) { if (s !== 'O' && !LEAVE.has(s)) { streak++; if (streak > maxConsecutive) maxConsecutive = streak; } else streak = 0; }
  const maxDays = state.managerConfig.maxConsecutiveWorkDays;
  if (maxConsecutive > maxDays) {
    results.push({ rule: `วันทำงานติดต่อกันสูงสุด (Max ${maxDays} Days)`, status: 'fail', msg: `เกินเกณฑ์ ${maxDays} วันติดต่อกัน (นับได้ ${maxConsecutive} วัน) — ฝ่าฝืนกฎความปลอดภัยและกฎหมายแรงงาน` });
    hasHardBlock = true;
  } else if (maxConsecutive >= maxDays - 2) {
    results.push({ rule: 'วันทำงานติดต่อกัน', status: 'warn', msg: `ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน (ใกล้ครบกำหนด ต้องจัดวันหยุดชดเชย)` });
  } else {
    results.push({ rule: 'รอบการเข้ากะ (2-on 2-off Pattern)', status: 'pass', msg: `สอดคล้องกับรอบหมุนเวียน (ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน)` });
  }
  if (['MT', 'NT', 'MTh', 'NTh', 'OT'].includes(targetShiftCode)) results.push({ rule: 'ชั่วโมงล่วงเวลา (OT Check)', status: 'pass', msg: 'มีชั่วโมง OT ส่งต่องานกะ (บันทึกเข้า Payroll ตามอัตรา x1.5 / x3.0)' });
  else results.push({ rule: 'สังกัดชุดกะ', status: 'pass', msg: `ตรงตามรหัสพนักงาน ${emp.code} (${emp.shiftType})` });
  const diff = Math.abs(targetDay - state.currentDay);
  if (diff > 7) results.push({ rule: 'กรอบเวลาการขอปรับเปลี่ยน (±7 วัน)', status: 'warn', msg: `วันที่ ${targetDay} อยู่นอกกรอบ ±7 วันจากปัจจุบัน (${state.currentDay})` });
  else results.push({ rule: 'กรอบเวลายื่นเรื่อง', status: 'pass', msg: 'อยู่ภายในกรอบเวลาที่ระบบอนุญาต (±7 วัน)' });
  const used = countMonthlySwapRequests(empId), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) {
    results.push({ rule: `สิทธิ์คำขอสลับ/เปลี่ยนกะ (สูงสุด ${limit} ครั้ง/เดือน)`, status: 'fail', msg: `ใช้สิทธิ์ไปแล้ว ${used}/${limit} ครั้ง — ระบบไม่อนุญาตให้ยื่นคำขอเพิ่มในเดือนนี้` });
    hasHardBlock = true;
  } else results.push({ rule: 'สิทธิ์คำขอสลับ/เปลี่ยนกะ', status: 'pass', msg: `ใช้สิทธิ์ไปแล้ว ${used}/${limit} ครั้งในเดือนนี้` });
  return { valid: !hasHardBlock, results };
}
export function validateSwapBothSides(empAId, empBId, day) {
  const empA = findEmployeeById(empAId), empB = findEmployeeById(empBId);
  if (!empA || !empB) return { valid: false, sideA: { results: [] }, sideB: { results: [] } };
  const aOldCode = getShiftCodeForDate(empA, state.currentYear, state.currentMonth, day);
  const bOldCode = getShiftCodeForDate(empB, state.currentYear, state.currentMonth, day);
  const sideA = validateShiftAssignment(empAId, day, bOldCode);
  const sideB = validateShiftAssignment(empBId, day, aOldCode);
  return { valid: sideA.valid && sideB.valid, sideA, sideB, aOldCode, bOldCode, aNewCode: bOldCode, bNewCode: aOldCode };
}
export function validateOTRequest(empId, day, otShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, results: [], requiresManagerSpecialReview: false };
  const base = validateShiftAssignment(empId, day, otShiftCode);
  const results = [...base.results];
  let hasHardBlock = !base.valid;
  const prevCode = day > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;
  if (getShiftFamily(otShiftCode) === 'M' && prevFamily === 'N') {
    results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า (OT กะเช้า)', status: 'fail', msg: `พบว่าทำกะดึกในวันก่อนหน้า (วันที่ ${day - 1}) — ไม่อนุญาตให้ทำ OT กะเช้าต่อทันที ต้องพักก่อนอย่างน้อย 1 วัน` });
    hasHardBlock = true;
  } else results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า', status: 'pass', msg: 'ไม่พบการทำกะดึกในวันก่อนหน้าที่กระทบต่อการทำ OT' });
  if (prevFamily === 'O') results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'pass', msg: `วันก่อนหน้า (วันที่ ${day - 1}) เป็นวันหยุด — พร้อมสำหรับการทำ OT` });
  else results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'warn', msg: `วันก่อนหน้าไม่ใช่วันหยุด (เป็นกะ ${prevCode || '-'}) — โปรดพิจารณาความเหนื่อยล้าก่อนอนุมัติ` });
  const onVacation = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day) === 'V';
  if (onVacation) results.push({ rule: 'กรณีพิเศษ: ขอ OT ระหว่างลาพักร้อน', status: 'warn', msg: 'พนักงานอยู่ในช่วงลาพักร้อน (V) — การขอ OT ระหว่างวันลาต้องได้รับอนุมัติพิเศษจากผู้จัดการเป็นกรณีๆ ไป (ไม่บล็อกอัตโนมัติ)' });
  return { valid: !hasHardBlock, results, requiresManagerSpecialReview: onVacation };
}
// นับเฉพาะคำขอของเดือนที่กำลังดู (คำขอที่ไม่อนุมัติหรือยกเลิกแล้วไม่นับ)
export function countMonthlySwapRequests(employeeId) {
  if (!employeeId) return 0;
  return state.requests.filter(r => r.type && (r.type.includes('สลับกะ') || r.type.includes('เปลี่ยนกะ')) && r.requesterId === employeeId
    && r.status !== 'ไม่อนุมัติ' && r.status !== 'ยกเลิกแล้ว'
    && (r.y == null || (r.y === state.currentYear && r.m === state.currentMonth))).length;
}
// หัวหน้ากะสลับได้เฉพาะกับหัวหน้ากะทีมอื่น / พนักงานสลับได้เฉพาะกับพนักงานทีมอื่น
export function getEligibleSwapColleagues(aEmp) {
  const others = getAllEmployees().filter(e => e.id !== aEmp.id);
  if (aEmp.roleCategory === 'Shift Supervisor') return others.filter(e => e.roleCategory === 'Shift Supervisor' && e.shiftType !== aEmp.shiftType);
  return others.filter(e => e.shiftType !== aEmp.shiftType && e.roleCategory !== 'Shift Supervisor');
}
// ลำดับผู้อนุมัติสลับกะ: หัวหน้ากะของทั้งสองทีม
export function buildApprovalChain(aEmp, bEmp) {
  const sup = e => { const t = state.shiftsData[getTeamKeyByLabel(e.shiftType)]; return t ? t.employees.find(x => x.id === t.supervisorId) : null; };
  const letter = e => e.shiftType.replace('Shift ', '').trim();
  const name = e => { const s = sup(e); return s ? s.name.split(' ')[0] : `กะ ${letter(e)}`; };
  const chain = [];
  if (bEmp) {
    chain.push({ role: `Shift Supervisor ${letter(bEmp)} (${name(bEmp)})`, status: 'pending' });
    chain.push({ role: `Shift Supervisor ${letter(aEmp)} (${name(aEmp)})`, status: 'pending' });
  } else chain.push({ role: `Shift Supervisor ${letter(aEmp)} (${name(aEmp)})`, status: 'pending' });
  return { chain, isCrossTeam: true };
}
