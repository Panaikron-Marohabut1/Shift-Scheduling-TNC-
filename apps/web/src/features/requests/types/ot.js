/* ==========================================================================
   คำขอทำ OT (LOCAL)
   --------------------------------------------------------------------------
   เต็มกะหรือครึ่งวัน และระบุคนที่มาช่วยทำ OT วันเดียวกันได้หลายคน (สูงสุด 7 คน)
   ทุกคนถูกตรวจเงื่อนไข OT · หัวหน้ากะของผู้ขอ และหัวหน้ากะของทีมที่มีคนมาช่วย อนุมัติ
   ========================================================================== */

import { state, view } from '../../../app/state.js';
import { esc, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getAllEmployees, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import { buildApprovalChain, OT_PICK, validateOTRequest } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, reasonField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

export const MAX_OT_HELPERS = 7;
const helpersOf = f => (Array.isArray(f.helpers) ? f.helpers : []).map(findEmployeeById).filter(Boolean);
// ผู้อนุมัติ: หัวหน้ากะของผู้ขอ + หัวหน้ากะของทุกทีมที่มีคนมาช่วย (ไม่ซ้ำ)
function otApprovers(emp, helpers) {
  const roles = [buildApprovalChain(emp).chain[0].role];
  helpers.forEach(h => { if (h.shiftType !== emp.shiftType) { const r = buildApprovalChain(h).chain[0].role; if (!roles.includes(r)) roles.push(r); } });
  return roles;
}

// เลือก/เอาออกคนที่มาช่วยทำ OT (เรียกจากปุ่มในแบบฟอร์ม)
export function toggleOtHelper(id, checked) {
  const f = view.rq;
  if (!f) return false;
  const list = Array.isArray(f.helpers) ? f.helpers : (f.helpers = []);
  const i = list.indexOf(String(id));
  if (checked && i < 0) {
    if (list.length >= MAX_OT_HELPERS) { showToast(`เพิ่มคนมาช่วยทำ OT ได้สูงสุด ${MAX_OT_HELPERS} คน`, 'alert'); return false; }
    list.push(String(id));
  } else if (!checked && i >= 0) list.splice(i, 1);
  return true;
}

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function otForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [], ready = false, submit = '', note = '';
  fields.push(dateField('วันที่ต้องการทำ OT', 'otReqDay'));
  fields.push(`
    <div class="field"><label for="otReqCode">รูปแบบ OT</label>
      <select class="inp" id="otReqCode" data-change="SF.rq('ot', this.value)">${OT_PICK.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.ot)).join('')}</select></div>`);
  fields.push(reasonField('otReqReason'));
  const helpers = helpersOf(f);
  const others = getAllEmployees().filter(e => e.id !== emp.id);
  const groups = {};
  others.forEach(e => { (groups[e.shiftType] = groups[e.shiftType] || []).push(e); });
  fields.push(`
    <fieldset class="field helpers">
      <legend>คนที่มาช่วยทำ OT วันนั้น (ไม่บังคับ เลือกได้สูงสุด ${MAX_OT_HELPERS} คน · เลือกแล้ว ${helpers.length})</legend>
      ${Object.keys(groups).sort().map(t => `
        <div class="helper-team"><span class="muted small">${esc(t)}</span>
          ${groups[t].map(e => `<label class="chk"><input type="checkbox" ${helpers.some(h => h.id === e.id) ? 'checked' : ''} data-change="SF.rqHelper(${js(e.id)}, this.checked)"><span>${esc(e.name)} · วันนั้น ${esc(getShiftCodeForDate(e, y, m, f.day))}</span></label>`).join('')}
        </div>`).join('')}
    </fieldset>`);
  const date = shortDate(y, m, f.day);
  const v = validateOTRequest(emp.id, f.day, f.ot);
  rows = [{ e: emp, date, from: myCode, to: f.ot }];
  checks = checksList(`ตรวจกฎของ ${emp.name}`, v.results);
  let allOk = v.valid;
  helpers.forEach(h => {
    const hv = validateOTRequest(h.id, f.day, f.ot);
    rows.push({ e: h, date, from: getShiftCodeForDate(h, y, m, f.day), to: f.ot });
    checks += checksList(`ตรวจเงื่อนไข OT ของ ${h.name}`, hv.results);
    allOk = allOk && hv.valid;
  });
  if (v.requiresManagerSpecialReview) note = '<p class="notice">วันนี้อยู่ระหว่างลาพักร้อน ต้องได้รับอนุมัติพิเศษจากผู้จัดการ</p>';
  approvers = otApprovers(emp, helpers);
  ready = allOk;
  submit = `submitOTRequest(${js(emp.id)})`;
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitOTRequest(empId) {
  const emp = findEmployeeById(empId);
  const f = view.rq || {};
  if (!emp) return;
  const y = state.currentYear, m = state.currentMonth;
  const day = Number(f.day);
  const otCode = OT_PICK.includes(f.ot) ? f.ot : 'MT';
  const reason = String(f.reason || '').trim();
  const helpers = helpersOf(f).slice(0, MAX_OT_HELPERS);
  if (!day) { showToast('กรุณาระบุวันที่ต้องการทำงานล่วงเวลา', 'alert'); return; }
  if ([emp, ...helpers].some(e => !validateOTRequest(e.id, day, otCode).valid)) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert'); return; }
  const dateLabel = `${day} ${monthText()}`;
  const roles = otApprovers(emp, helpers);
  const withText = helpers.length ? ` พร้อมคนมาช่วย ${helpers.length} คน: ${helpers.map(h => h.name).join(', ')}` : '';
  saveLocalRequest({
    kind: 'ot', type: 'ขอทำ OT', person: emp.name, requesterId: emp.id, day, initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    helpers: helpers.map(h => ({ id: h.id, name: h.name })),
    date: dateLabel, currentShift: getShiftCodeForDate(emp, y, m, day), targetShift: otCode,
    reason: (reason || `ขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`) + withText, isCrossShift: roles.length > 1,
    changes: [emp, ...helpers].map(e => ({ empId: e.id, y, m, d: day, to: otCode })),
    approvers: roles.map(role => ({ role, status: 'pending' })), status: roles.length > 1 ? `รออนุมัติครบ ${roles.length} ฝ่าย` : 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}${withText}`, emp);
  done('ส่งคำขอทำงานล่วงเวลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}
