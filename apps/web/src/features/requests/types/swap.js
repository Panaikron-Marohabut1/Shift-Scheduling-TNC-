/* ==========================================================================
   คำขอสลับกะ
   --------------------------------------------------------------------------
   สลับกะกัน (แลกกะวันเดียวกัน) กับข้อมูลจริง → ส่งเข้าระบบหลังบ้าน (POST /api/requests)
   ลา + ให้เพื่อนทำ OT แทน และเดือนที่ยังไม่มีข้อมูลจริง → LOCAL
   ========================================================================== */

import { apiSwapTarget, submitApiSwap } from '../../../app/data.js';
import { state } from '../../../app/state.js';
import { $, esc, js } from '../../../shared/dom.js';
import { shortDate } from '../../../shared/scheduling/dates.js';
import { findEmployeeById, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../../shared/scheduling/roster.js';
import {
  buildApprovalChain, countMonthlySwapRequests, getEligibleSwapColleagues, OT_PICK, validateOTRequest, validateSwapBothSides
} from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, ownSup } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';

// ช่องกรอกในแบบฟอร์ม และผลตรวจกฎ (form.js เป็นคนวาดหน้าต่าง)
export function swapForm({ f, emp, y, m, n, myCode }) {
  const fields = [];
  let rows = [], checks = '', approvers = [ownSup(emp)], ready = false, submit = '', note = '';
  fields.push(dateField('วันที่ต้องการสลับกะ'));
  const partners = getEligibleSwapColleagues(emp);
  const groups = {};
  partners.forEach(p => { (groups[p.shiftType] = groups[p.shiftType] || []).push(p); });
  fields.push(`
    <div class="field"><label for="colleagueSelect">สลับกับ</label>
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
    </div>
    <div class="field"><label for="swapModeSelect">แบบคำขอ</label>
      <select class="inp" id="swapModeSelect" data-change="SF.rq('mode', this.value)">
        ${opt('mutual', 'สลับกะกัน แลกกะของวันเดียวกัน', f.mode)}
        ${opt('leaveOT', 'ฉันขอลา ให้เพื่อนร่วมงานทำ OT แทน', f.mode)}
      </select>
    </div>`);
  if (f.mode === 'leaveOT') {
    fields.push(`
      <div class="formrow tight">
        <div class="field grow"><label for="leaveTypeSelect">ประเภทการลาของคุณ</label>
          <select class="inp" id="leaveTypeSelect" data-change="SF.rq('leave', this.value)">${['V', 'B', 'S'].map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.leave)).join('')}</select></div>
        <div class="field grow"><label for="otCodeSelect">OT ที่เพื่อนทำแทน</label>
          <select class="inp" id="otCodeSelect" data-change="SF.rq('ot', this.value)">${OT_PICK.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.ot)).join('')}</select></div>
      </div>`);
  }
  const b = f.partner && findEmployeeById(f.partner);
  if (b) {
    const date = shortDate(y, m, f.day);
    if (f.mode === 'mutual') {
      const sw = validateSwapBothSides(emp.id, b.id, f.day);
      rows = [{ e: emp, date, from: sw.aOldCode, to: sw.aNewCode }, { e: b, date, from: sw.bOldCode, to: sw.bNewCode }];
      checks = checksList(`ตรวจกฎของ ${emp.name}`, sw.sideA.results) + checksList(`ตรวจกฎของ ${b.name}`, sw.sideB.results);
      approvers = buildApprovalChain(emp, b).chain.map(s => s.role);
      ready = sw.valid;
    } else {
      const ot = validateOTRequest(b.id, f.day, f.ot);
      rows = [{ e: emp, date, from: myCode, to: f.leave }, { e: b, date, from: getShiftCodeForDate(b, y, m, f.day), to: f.ot }];
      checks = checksList(`ตรวจเงื่อนไข OT ของ ${b.name}`, ot.results);
      approvers = [`Shift Supervisor (${b.shiftType})`];
      ready = ot.valid;
    }
    submit = `submitColleagueSwapRequest(${js(emp.id)}, ${js(b.id)}, ${f.day})`;
  }
  return { fields, rows, checks, approvers, ready, submit, note };
}

export async function submitColleagueSwapRequest(aId, bId, day) {
  const aEmp = findEmployeeById(aId), bEmp = findEmployeeById(bId);
  if (!aEmp) return;
  if (!bEmp) { showToast('กรุณาเลือกเพื่อนร่วมงานจากทีมอื่นก่อนส่งคำขอ', 'alert'); return; }
  const used = countMonthlySwapRequests(aId), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) { showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${limit} ครั้ง/เดือนแล้ว`, 'alert'); return; }
  const mode = ($('#swapModeSelect') || {}).value || 'mutual';
  const dateLabel = `${day} ${monthText()}`;
  if (mode === 'mutual') {
    const swap = validateSwapBothSides(aId, bId, day);
    if (!swap.valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert'); return; }
    // ข้อมูลจริงในฐานข้อมูล → ส่งเข้าระบบหลังบ้าน
    const target = apiSwapTarget(aId, bId, state.currentYear, state.currentMonth, Number(day));
    if (target) {
      const btn = $('#modalRoot footer .btn.primary');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่งคำขอ…'; }
      try {
        await submitApiSwap(target.a, target.b);
        done(`ส่งคำขอสลับกะเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${used + 1}/${limit} ครั้งในเดือนนี้)`);
      } catch (error) {
        showToast(error.message || 'ส่งคำขอไม่สำเร็จ', 'alert');
        if (btn) { btn.disabled = false; btn.textContent = 'ส่งคำขอ'; }
      }
      return;
    }
    const chain = buildApprovalChain(aEmp, bEmp).chain;
    saveLocalRequest({
      type: 'สลับกะข้ามทีม', person: aEmp.name, requesterId: aEmp.id, targetPerson: bEmp.name, targetId: bEmp.id, day: Number(day),
      aNewCode: swap.aNewCode, bNewCode: swap.bNewCode, initials: aEmp.initials, roleCategory: aEmp.roleCategory, targetRole: bEmp.roleCategory,
      date: dateLabel, currentShift: swap.aOldCode, targetShift: swap.aNewCode, reason: `สลับกะกับ ${bEmp.name} (${swap.aOldCode} ↔ ${swap.bOldCode})`,
      isCrossShift: aEmp.shiftType !== bEmp.shiftType, approvers: chain, status: chain.length > 1 ? 'รออนุมัติครบ 2 ฝ่าย' : 'รอดำเนินการ', quotaUsed: `${used + 1} / ${limit} ครั้ง`
    }, `ยื่นคำขอสลับกะวันที่ ${dateLabel} กับ ${bEmp.name} (${swap.aOldCode} ↔ ${swap.bOldCode})`, aEmp);
    done(`ส่งคำขอสลับกะเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${used + 1}/${limit} ครั้งในเดือนนี้)`);
  } else {
    const leaveCode = ($('#leaveTypeSelect') || {}).value || 'V';
    const otCode = ($('#otCodeSelect') || {}).value || 'MT';
    if (!validateOTRequest(bId, day, otCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่ง OT ไม่ผ่านเงื่อนไข', 'alert'); return; }
    saveLocalRequest({
      type: 'ลา + OT คุมกะแทน', person: aEmp.name, requesterId: aEmp.id, targetPerson: bEmp.name, targetId: bEmp.id, day: Number(day), leaveCode, otCode,
      initials: aEmp.initials, roleCategory: aEmp.roleCategory, targetRole: bEmp.roleCategory, date: dateLabel,
      currentShift: getShiftCodeForDate(aEmp, state.currentYear, state.currentMonth, day), targetShift: leaveCode,
      reason: `${aEmp.name} ขอลา (${leaveCode}) และให้ ${bEmp.name} ทำ OT (${otCode}) แทน`, isCrossShift: false,
      approvers: [{ role: `Shift Supervisor (${bEmp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: `${used + 1} / ${limit} ครั้ง`
    }, `ยื่นคำขอลา (${leaveCode}) พร้อมให้ ${bEmp.name} ทำ OT (${otCode}) แทน วันที่ ${dateLabel}`, aEmp);
    done('ส่งคำขอลา + OT คุมกะแทนเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
  }
}
