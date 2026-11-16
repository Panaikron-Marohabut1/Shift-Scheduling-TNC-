/* คำขอลา ใช้สำหรับอัปเดตตารางกะและเก็บประวัติคำขอ */
import { state, view } from '../../../app/state.js';
import { refreshAll, submitLeaveApi } from '../../../app/data.js';
import { $, esc, js } from '../../../shared/dom.js';
import { isoOf, shortDate } from '../../../shared/scheduling/dates.js';
import { currentEmp, getAllEmployees, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { getShiftCodeForDate, getTeamForDate } from '../../../shared/scheduling/roster.js';
import { buildApprovalChain, validateOTRequest } from '../../../shared/scheduling/rules.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, dateField, opt, reasonField } from '../form-parts.js';
import { done, monthText, saveLocalRequest } from '../submit.js';
import { leaveShiftStartsAt } from '../leave-time.js';
import { canSubmitRequestDate } from '../request-time.js';
import { requestConflictAt, requestConflictText } from '../request-conflict.js';

const LEAVE_TYPES = Object.freeze({ V: 'ลาพักผ่อน', S: 'ลาป่วย', B: 'ลากิจ', VG: 'ลาอื่น ๆ' });
const OT_BY_SHIFT = { M: 'MT', N: 'NT' };
const MANAGER = 'ผู้จัดการฝ่ายผลิต';

function leavePlan(emp, f, y, m, myCode) {
  const { day } = f;
  const team = getTeamForDate(emp, y, m, day);
  const needsCover = f.leaveCoverage === 'cover';
  const otCode = OT_BY_SHIFT[myCode];
  const shiftStartsAt = leaveShiftStartsAt(emp.id, y, m, day, myCode);
  const candidates = needsCover && otCode ? getAllEmployees().map(person => ({
    person, team: getTeamForDate(person, y, m, day)
  })).filter(candidate =>
    candidate.team !== team && candidate.person.id !== emp.id
    && candidate.person.roleCategory === emp.roleCategory
    && getShiftCodeForDate(candidate.person, y, m, day) === 'O'
  ) : [];
  const cover = candidates.find(candidate => candidate.person.id === f.cover);
  const conflict = requestConflictAt(emp.id, y, m, day) || requestConflictAt(cover?.person.id, y, m, day);
  const ot = cover && !state.actor?.centralLeave ? validateOTRequest(cover.person.id, day, otCode) : null;
  const supervisor = (person, shiftType) => buildApprovalChain({ ...person, shiftType }).chain[0].role;
  const approvers = emp.roleCategory === 'Shift Supervisor' ? [MANAGER] : [
    supervisor(emp, team), ...(cover ? [supervisor(cover.person, cover.team)] : [])
  ];
  let problem = '';
  if (conflict) problem = requestConflictText(conflict);
  else if (!canSubmitRequestDate(isoOf(y, m, day))) problem = 'ยื่นคำขอลาได้ตั้งแต่วันนี้ถึงวันสุดท้ายของเดือนนี้';
  else if (!['M', 'N', 'D', 'OT'].includes(state.shiftDefs[myCode]?.family)) problem = 'กรุณาเลือกวันที่คุณมีกะทำงาน';
  else if (!Number.isFinite(shiftStartsAt)) problem = 'ยังไม่มีเวลาเริ่มกะสำหรับวันที่เลือก';
  else if (!['solo', 'cover'].includes(f.leaveCoverage)) problem = 'กรุณาเลือกรูปแบบการลา';
  else if (needsCover && !otCode) problem = 'การทำแทนแบบ OT ใช้กับกะเช้า M และกะดึก N';
  else if (needsCover && !candidates.length) problem = 'วันที่เลือกไม่มีคนต่างทีมที่หยุดและมีบทบาทเดียวกับคุณ';
  else if (needsCover && !cover) problem = 'กรุณาเลือกคนที่ตกลงมาทำแทน';
  else if (ot && !ot.valid) problem = 'ผู้มาทำแทนยังไม่ผ่านเงื่อนไขการทำ OT';
  return { needsCover, cover, candidates, otCode, ot, approvers, problem, conflict, shiftStartsAt };
}

export function leaveForm({ f, emp, y, m, myCode }) {
  if (!Object.hasOwn(LEAVE_TYPES, f.leave)) f.leave = 'V';
  const plan = leavePlan(emp, f, y, m, myCode);
  const date = shortDate(y, m, f.day);
  const fields = [dateField('วันที่ลา', 'leaveReqDay'), `
    <div class="field"><label for="leaveReqTypeSelect">ประเภทการลา</label>
      <select class="inp" id="leaveReqTypeSelect" data-change="SF.rq('leave', this.value)">
        ${Object.entries(LEAVE_TYPES).map(([code, label]) => opt(code, `${label} (${code})`, f.leave)).join('')}
      </select></div>
    <div class="field"><label for="leaveCoverageSelect">รูปแบบการลา</label>
      <select class="inp" id="leaveCoverageSelect" data-change="SF.rq('leaveCoverage', this.value)">
        ${opt('', 'เลือกรูปแบบการลา', f.leaveCoverage)}
        ${opt('solo', 'ลาแบบไม่มีคนทำแทน', f.leaveCoverage)}
        ${opt('cover', 'ลาแบบมีคนทำแทน', f.leaveCoverage)}
      </select></div>`];
  const rows = !plan.conflict && f.leaveCoverage && ['M', 'N', 'D', 'OT'].includes(state.shiftDefs[myCode]?.family)
    ? [{ e: emp, date, from: myCode, to: f.leave, targetCodeOnly: true }] : [];
  if (plan.needsCover) {
    const teams = [...new Set(plan.candidates.map(candidate => candidate.team))].sort();
    fields.push(`<div class="field"><label for="leaveCoverSelect">คนที่มาทำแทน</label>
      <select class="inp" id="leaveCoverSelect" data-change="SF.rq('cover', this.value)" ${teams.length ? '' : 'disabled'}>
        ${opt('', 'เลือกคนที่ตกลงมาทำแทน', plan.cover?.person.id || '')}
        ${teams.map(team => `<optgroup label="${esc(team)}">${plan.candidates.filter(candidate => candidate.team === team)
          .map(({ person }) => opt(person.id, person.name + (requestConflictAt(person.id, y, m, f.day) ? ' · มีคำขออยู่แล้ว' : ''), f.cover)).join('')}</optgroup>`).join('')}
      </select>
      ${plan.otCode ? `<small>ผู้ทำแทนจะได้ ${esc(getEmployeeFacingShiftLabel(plan.otCode))} (${esc(plan.otCode)}) เมื่ออนุมัติครบ</small>` : ''}
    </div>`);
  }
  if (plan.cover && !plan.conflict) rows.push({ e: plan.cover.person, date, from: 'O', to: plan.otCode });
  fields.push(reasonField('leaveReqReason', { required: true, hint: 'ผู้เกี่ยวข้องกับคำขอนี้จะเห็นเหตุผล ระบุเฉพาะข้อมูลที่จำเป็น' }));
  const ready = !plan.problem;
  return { fields, rows, checks: plan.ot && !plan.conflict ? checksList(`ตรวจเงื่อนไข OT ของ ${plan.cover.person.name}`, plan.ot.results) : '',
    approvers: ready ? plan.approvers : [], ready, submit: `submitLeaveRequest(${js(emp.id)})`,
    note: plan.problem && (plan.conflict || f.leaveCoverage) ? `<p class="notice">${esc(plan.problem)}</p>` : '' };
}

export async function submitLeaveRequest(empId) {
  const emp = currentEmp();
  const f = view.rq;
  if (!emp || emp.id !== empId || f?.k !== 'leave' || f.submitting || (state.actor?.remotePilot && !state.actor.centralLeave)) return;
  const { currentYear: y, currentMonth: m } = state;
  const { day } = f;
  const reason = String(f.reason || '').trim();
  const plan = leavePlan(emp, f, y, m, getShiftCodeForDate(emp, y, m, day));
  if (plan.problem) { showToast(plan.problem, 'alert'); return; }
  if (!reason) {
    showToast('กรุณากรอกเหตุผลการลาก่อนส่งคำขอ', 'alert');
    $('#leaveReqReason')?.focus();
    return;
  }
  const leaveCode = Object.hasOwn(LEAVE_TYPES, f.leave) ? f.leave : 'V';
  const date = `${day} ${monthText()}`;
  const cover = plan.cover?.person;
  if (state.actor?.centralLeave) {
    const workDate = isoOf(y, m, day);
    const source = state.apiAssign[emp.id]?.[workDate];
    const target = cover && state.apiAssign[cover.id]?.[workDate];
    if (!source || (cover && !target)) { showToast('ไม่พบกะในตารางส่วนกลาง กรุณาโหลดตารางใหม่', 'alert'); return; }
    const input = { assignmentId: source.assignment_id, assignmentVersion: source.version, leaveCode, reason,
      ...(target ? { coverAssignmentId: target.assignment_id, coverVersion: target.version } : {}) };
    const signature = JSON.stringify(input);
    if (f.submission?.signature !== signature) f.submission = { signature, key: crypto.randomUUID() };
    const button = $('#leaveSubmit');
    f.submitting = true;
    if (button) button.disabled = true;
    try {
      await submitLeaveApi(input, f.submission.key);
      await refreshAll();
      if (view.rq === f && button?.isConnected) {
        if (state.activeRole === 'Shift Employee') view.employeeRequestGroup = cover ? 'shared' : 'personal';
        done('ส่งคำขอลาเรียบร้อยแล้ว');
      } else showToast('ส่งคำขอลาเรียบร้อยแล้ว');
    } catch (error) {
      showToast(error.message || 'ส่งคำขอลาไม่สำเร็จ', 'alert');
    } finally {
      f.submitting = false;
      if (button?.isConnected) button.disabled = !f.reason.trim();
    }
    return;
  }
  const changes = [{ empId: emp.id, y, m, d: day, to: leaveCode }];
  if (cover) changes.push({ empId: cover.id, y, m, d: day, to: plan.otCode });
  const wait = plan.approvers.length > 1 ? 'รออนุมัติครบ 2 ฝ่าย'
    : emp.roleCategory === 'Shift Supervisor' ? 'รอผู้จัดการอนุมัติ' : 'รอหัวหน้ากะอนุมัติ';
  const approvers = plan.approvers.map(role => ({ role, status: 'pending' }));
  if (!saveLocalRequest({
    kind: 'leave', type: `ขอลา (${leaveCode})`, person: emp.name, requesterId: emp.id, day, leaveCode,
    coverId: cover?.id, coverOtCode: cover ? plan.otCode : null, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: cover?.name, targetRole: cover?.roleCategory, date,
    currentShift: getShiftCodeForDate(emp, y, m, day), targetShift: leaveCode,
    reason, isCrossShift: !!cover, changes, approvers, parallelApproval: approvers.length > 1, status: wait,
    shiftStartsAt: plan.shiftStartsAt, quotaUsed: '-'
  }, `ยื่นคำขอลา (${leaveCode}) วันที่ ${date}`, emp)) return;
  done(`ส่งคำขอลาเรียบร้อยแล้ว · ${wait}`);
}
