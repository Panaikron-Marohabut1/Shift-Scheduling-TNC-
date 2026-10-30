/* ==========================================================================
   คำขอสลับกะ (LOCAL)
   --------------------------------------------------------------------------
   แบบที่ 1 สลับกะกันพร้อมวันคืนกะ: วันแรกเพื่อนมาทำกะแทนเรา แล้วเราไปทำกะแทนเพื่อนคืนในอีกวัน
            ทั้ง 2 วันต้องอยู่ในเดือนเดียวกัน (ข้อตกลงกับหัวหน้ากะ) · หัวหน้ากะทั้ง 2 ทีมอนุมัติ
   แบบที่ 2 ขอลา แล้วให้เพื่อนต่างทีมทำ OT แทน · หัวหน้ากะของผู้ลาและของคนมาแทนอนุมัติ (2 ฝั่ง)
   หัวหน้ากะสลับได้เฉพาะกับหัวหน้ากะทีมอื่น · สิทธิ์ขอเปลี่ยน 1 ครั้งต่อเดือน (ผู้จัดการตั้งค่าได้)
   ระบบหลังบ้านตอนนี้รับได้เฉพาะสลับวันเดียว (POST /api/requests) จึงเก็บในเบราว์เซอร์จนกว่าจะรองรับวันคืนกะ
   ========================================================================== */

import { state, view } from '../../../app/state.js';
import { esc, js } from '../../../shared/dom.js';
import { daysIn, shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import {
  buildApprovalChain, countMonthlySwapRequests, getEligibleSwapColleagues, leaveApprovalChain, OT_PICK, validateOTRequest,
  validateSwapBothSides
} from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, ownSup } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';


// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function swapForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  fields.push(dateField(f.mode === 'mutual' ? 'วันที่ให้เพื่อนมาทำกะแทน' : 'วันที่ขอลา'));
  const partners = getEligibleSwapColleagues(emp);
  const groups = {};
  partners.forEach(p => { (groups[p.shiftType] = groups[p.shiftType] || []).push(p); });
  fields.push(`
    <div class="field"><label for="swapModeSelect">แบบคำขอ</label>
      <select class="inp" id="swapModeSelect" data-change="SF.rq('mode', this.value)">
        ${opt('mutual', 'สลับกะกัน พร้อมวันคืนกะในเดือนเดียวกัน', f.mode)}
        ${opt('leaveOT', 'ฉันขอลา ให้เพื่อนร่วมงานทำ OT แทน', f.mode)}
      </select>
    </div>
    <div class="field"><label for="colleagueSelect">${f.mode === 'mutual' ? 'คนที่มาทำกะแทน' : 'คนที่มาทำ OT แทน'}</label>
      <select class="inp" id="colleagueSelect" data-change="SF.rq('partner', this.value)">
        <option value="">เลือกเพื่อนร่วมงานจากทีมอื่น</option>
        ${Object.keys(groups).sort().map(t => `<optgroup label="${esc(t)}">${groups[t].map(p => {
          const pc = getShiftCodeForDate(p, y, m, f.day);
          const okRule = f.mode === 'mutual' ? validateSwapBothSides(emp.id, p.id, f.day).valid : validateOTRequest(p.id, f.day, f.ot).valid;
          const same = f.mode === 'mutual' && pc === myCode;
          return opt(p.id, `${p.name} · วันนั้น ${pc}${same ? ' (กะเดียวกัน)' : okRule ? '' : ' (ไม่ผ่านกฎ)'}`, f.partner);
        }).join('')}</optgroup>`).join('')}
      </select>
      <small>${emp.roleCategory === 'Shift Supervisor' ? 'หัวหน้ากะสลับได้เฉพาะกับหัวหน้ากะทีมอื่น' : 'สลับได้เฉพาะกับพนักงานกะทีมอื่น'} · ชื่อที่มี "(ไม่ผ่านกฎ)" เลือกได้แต่ส่งไม่ได้ เปิดดูเหตุผลได้</small>
    </div>`);
  const b = f.partner && findEmployeeById(f.partner);

  if (f.mode === 'mutual') {
    // วันคืนกะ: วันในเดือนเดียวกันที่กะของเรากับเพื่อนต่างกัน (เราไปทำกะของเพื่อนแทน)
    if (b) {
      const pays = Array.from({ length: n }, (_, i) => i + 1).filter(d => d !== f.day && getShiftCodeForDate(emp, y, m, d) !== getShiftCodeForDate(b, y, m, d));
      fields.push(`
        <div class="field"><label for="payDaySelect">วันที่คืนกะ (คุณไปทำกะแทน ${esc(b.name)})</label>
          <select class="inp" id="payDaySelect" data-change="SF.rq('payDay', this.value)">
            ${opt('', 'เลือกวันคืนกะในเดือนเดียวกัน', f.payDay)}
            ${pays.map(d => {
              const ok = validateSwapBothSides(emp.id, b.id, d).valid;
              return opt(d, `${shortDate(y, m, d)} · คุณ ${getShiftCodeForDate(emp, y, m, d)} / ${b.name} ${getShiftCodeForDate(b, y, m, d)}${ok ? '' : ' (ไม่ผ่านกฎ)'}`, f.payDay);
            }).join('')}
          </select>
          <small>ต้องอยู่ในเดือนเดียวกัน · แสดงเฉพาะวันที่กะของคุณกับ ${esc(b.name)} ต่างกัน</small>
        </div>`);
    }
    if (b) {
      const date = shortDate(y, m, f.day);
      const sw = validateSwapBothSides(emp.id, b.id, f.day);
      rows = [{ e: emp, date, from: sw.aOldCode, to: sw.aNewCode }, { e: b, date, from: sw.bOldCode, to: sw.bNewCode }];
      checks = checksList(`ตรวจกฎของ ${emp.name} วันที่ ${f.day}`, sw.sideA.results) + checksList(`ตรวจกฎของ ${b.name} วันที่ ${f.day}`, sw.sideB.results);
      approvers = buildApprovalChain(emp, b).chain.map(s => s.role);
      const pay = Number(f.payDay);
      if (pay) {
        const pd = shortDate(y, m, pay);
        const sp = validateSwapBothSides(emp.id, b.id, pay);
        rows.push({ e: emp, date: pd, from: sp.aOldCode, to: sp.aNewCode }, { e: b, date: pd, from: sp.bOldCode, to: sp.bNewCode });
        checks += checksList(`ตรวจกฎวันคืนกะของ ${emp.name} วันที่ ${pay}`, sp.sideA.results) + checksList(`ตรวจกฎวันคืนกะของ ${b.name} วันที่ ${pay}`, sp.sideB.results);
        ready = sw.valid && sp.valid;
      } else note = '<p class="notice">เลือกวันที่คืนกะก่อน จึงจะส่งคำขอได้</p>';
      submit = `submitColleagueSwapRequest(${js(emp.id)}, ${js(b.id)}, ${f.day})`;
    }
  } else {
    fields.push(`
      <div class="formrow tight">
        <div class="field grow"><label for="leaveTypeSelect">ประเภทการลาของคุณ</label>
          <select class="inp" id="leaveTypeSelect" data-change="SF.rq('leave', this.value)">${['V', 'B', 'S'].map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.leave)).join('')}</select></div>
        <div class="field grow"><label for="otCodeSelect">OT ที่เพื่อนทำแทน</label>
          <select class="inp" id="otCodeSelect" data-change="SF.rq('ot', this.value)">${OT_PICK.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.ot)).join('')}</select></div>
      </div>`);
    if (b) {
      const date = shortDate(y, m, f.day);
      const ot = validateOTRequest(b.id, f.day, f.ot);
      rows = [{ e: emp, date, from: myCode, to: f.leave }, { e: b, date, from: getShiftCodeForDate(b, y, m, f.day), to: f.ot }];
      checks = checksList(`ตรวจเงื่อนไข OT ของ ${b.name}`, ot.results);
      approvers = leaveApprovalChain(emp, b);
      ready = ot.valid;
      submit = `submitColleagueSwapRequest(${js(emp.id)}, ${js(b.id)}, ${f.day})`;
    }
  }
  return { fields, rows, checks, approvers, ready, submit, note };
}

export function submitColleagueSwapRequest(aId, bId, day) {
  const aEmp = findEmployeeById(aId), bEmp = findEmployeeById(bId);
  const f = view.rq || {};
  if (!aEmp) return;
  if (!bEmp) { showToast('กรุณาเลือกเพื่อนร่วมงานจากทีมอื่นก่อนส่งคำขอ', 'alert'); return; }
  const used = countMonthlySwapRequests(aId), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) { showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${limit} ครั้ง/เดือนแล้ว`, 'alert'); return; }
  const y = state.currentYear, m = state.currentMonth;
  day = Number(day);
  if (f.mode !== 'leaveOT') {
    const pay = Number(f.payDay);
    if (!pay || pay > daysIn(y, m) || pay === day) { showToast('กรุณาเลือกวันที่คืนกะในเดือนเดียวกัน', 'alert'); return; }
    const sw = validateSwapBothSides(aId, bId, day), sp = validateSwapBothSides(aId, bId, pay);
    if (!sw.valid || !sp.valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert'); return; }
    const chain = buildApprovalChain(aEmp, bEmp).chain;
    const dateLabel = `${day} ${monthText()} (คืนกะวันที่ ${pay})`;
    saveLocalRequest({
      kind: 'swap', type: 'สลับกะข้ามทีม', person: aEmp.name, requesterId: aEmp.id, targetPerson: bEmp.name, targetId: bEmp.id, day, payDay: pay,
      aNewCode: sw.aNewCode, bNewCode: sw.bNewCode, initials: aEmp.initials, roleCategory: aEmp.roleCategory, targetRole: bEmp.roleCategory,
      date: dateLabel, currentShift: sw.aOldCode, targetShift: sw.aNewCode,
      reason: `วันที่ ${day}: ${bEmp.name} มาทำกะ ${sw.aOldCode} แทน ${aEmp.name} · วันที่ ${pay}: ${aEmp.name} คืนกะ ทำกะ ${sp.bOldCode} แทน ${bEmp.name}`,
      changes: [
        { empId: aEmp.id, y, m, d: day, to: sw.aNewCode }, { empId: bEmp.id, y, m, d: day, to: sw.bNewCode },
        { empId: aEmp.id, y, m, d: pay, to: sp.aNewCode }, { empId: bEmp.id, y, m, d: pay, to: sp.bNewCode }
      ],
      isCrossShift: aEmp.shiftType !== bEmp.shiftType, approvers: chain, status: chain.length > 1 ? 'รออนุมัติครบ 2 ฝ่าย' : 'รอดำเนินการ', quotaUsed: `${used + 1} / ${limit} ครั้ง`
    }, `ยื่นคำขอสลับกะกับ ${bEmp.name} วันที่ ${day} และคืนกะวันที่ ${pay} ${monthText()}`, aEmp);
    done(`ส่งคำขอสลับกะเรียบร้อยแล้ว · รอหัวหน้ากะทั้ง 2 ทีมพิจารณา (ใช้สิทธิ์ ${used + 1}/${limit} ครั้งในเดือนนี้)`);
    return;
  }
  const leaveCode = f.leave || 'V', otCode = f.ot || 'MT';
  if (!validateOTRequest(bId, day, otCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่ง OT ไม่ผ่านเงื่อนไข', 'alert'); return; }
  const roles = leaveApprovalChain(aEmp, bEmp);
  const dateLabel = `${day} ${monthText()}`;
  saveLocalRequest({
    kind: 'leaveOT', type: 'ลา + OT คุมกะแทน', person: aEmp.name, requesterId: aEmp.id, targetPerson: bEmp.name, targetId: bEmp.id, day, leaveCode, otCode,
    initials: aEmp.initials, roleCategory: aEmp.roleCategory, targetRole: bEmp.roleCategory, date: dateLabel,
    currentShift: getShiftCodeForDate(aEmp, y, m, day), targetShift: leaveCode,
    reason: `${aEmp.name} ขอลา (${leaveCode}) และให้ ${bEmp.name} ทำ OT (${otCode}) แทน`, isCrossShift: true,
    changes: [{ empId: aEmp.id, y, m, d: day, to: leaveCode }, { empId: bEmp.id, y, m, d: day, to: otCode }],
    approvers: roles.map(role => ({ role, status: 'pending' })), status: 'รออนุมัติครบ 2 ฝ่าย', quotaUsed: `${used + 1} / ${limit} ครั้ง`
  }, `ยื่นคำขอลา (${leaveCode}) พร้อมให้ ${bEmp.name} ทำ OT (${otCode}) แทน วันที่ ${dateLabel}`, aEmp);
  done('ส่งคำขอลา + OT คุมกะแทนเรียบร้อยแล้ว · รออนุมัติ 2 ฝั่ง');
}
