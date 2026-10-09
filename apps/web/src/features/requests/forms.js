/* ==========================================================================
   ยื่นคำขอ: เลือกประเภท → แบบฟอร์มที่บอกผลในตาราง ผลตรวจกฎ และลำดับผู้อนุมัติ
   --------------------------------------------------------------------------
   สลับกะ (พนักงานทีม A/B แลกกะวันเดียวกัน กับข้อมูลจริง) → ส่งเข้าระบบหลังบ้าน (POST /api/requests)
   ประเภทอื่น (ลา, OT, เปลี่ยนวันหยุด, เปลี่ยนกะ, นักขัตฤกษ์, ลา + OT คุมกะแทน, หัวหน้ากะสลับกะ)
   → LOCAL: เก็บในเบราว์เซอร์จนกว่าระบบหลังบ้านจะมี API (ฟังก์ชัน saveLocalRequest)
   ========================================================================== */
import { state, view, saveLocal, DEMO_TODAY } from '../../app/state.js';
import { $, esc, js, openModal, closeModal, showToast } from '../../shared/dom.js';
import {
  daysIn, monthLabel, isoOf, shortDate, OT_PICK, findEmployeeById, getAllEmployees, getShiftCodeForDate, currentEmp,
  getEmployeeFacingShiftLabel, getEmployeeFacingRoleLabel, getEligibleSwapColleagues, validateSwapBothSides, validateOTRequest,
  validateShiftAssignment, buildApprovalChain, countMonthlySwapRequests, getHolidaysForYear, parseThaiDate, isYearPublished, isMonthLocked
} from '../../shared/scheduling.js';
import { swatch, draftNote, isToday } from '../schedule/view.js';
import { addLog, apiSwapTarget, submitApiSwap, merge } from '../../app/data.js';

export const KINDS = [
  { k: 'swap', label: 'สลับกะ', hint: 'สลับกะกับเพื่อนต่างทีม หรือขอลาให้เพื่อนต่างทีมทำ OT แทน' },
  { k: 'change', label: 'เปลี่ยนกะ', hint: 'เปลี่ยนกะของตัวเองในวันนั้น' },
  { k: 'leave', label: 'ลา', hint: 'พักร้อน ลากิจ ลาป่วย เลือกเพื่อนในทีมมาทำแทนได้' },
  { k: 'dayoff', label: 'เปลี่ยนวันหยุด', hint: 'ย้ายวันหยุดไปวันอื่นภายใน 7 วัน' },
  { k: 'ot', label: 'ขอทำ OT', hint: 'ทำงานล่วงเวลา เต็มกะหรือครึ่งวัน' },
  { k: 'holiday', label: 'วันหยุดนักขัตฤกษ์', hint: 'ขอหยุดตามสิทธิ์วันหยุดนักขัตฤกษ์ (H)' }
];
// ทุกบทบาทที่มีกะ (พนักงานและหัวหน้ากะ) เปลี่ยนตารางได้ผ่านคำขอเท่านั้น
export const kindsAllowed = () => KINDS;
const kindLabel = k => (KINDS.find(x => x.k === k) || {}).label || '';
export function kindButtons(list, day) {
  return `<ul class="kinds">${list.map(x => `<li><button data-click="SF.form(${js(x.k)}, ${day || 0})"><b>${x.label}</b><span>${x.hint}</span></button></li>`).join('')}</ul>`;
}
// ยื่นคำขอได้เมื่อปีนั้นประกาศใช้แล้ว และเดือนนั้นยังไม่ถูกล็อก (กฎเดียวกับการกดช่องในตารางกะ)
export const LOCKED_NOTE = 'เดือนนี้ถูกล็อกข้อมูลแล้ว ดูได้อย่างเดียว ยื่นคำขอได้ตั้งแต่เดือนปัจจุบันเป็นต้นไป';
export function draftBlocked() {
  const y = state.currentYear, m = state.currentMonth;
  if (isYearPublished(y) && !isMonthLocked(y, m)) return false;
  openModal('ยังยื่นคำขอไม่ได้', `<p>${isYearPublished(y) ? LOCKED_NOTE : draftNote(y)}</p>`, '<button class="btn" data-click="closeModal()">ปิด</button>');
  return true;
}
export function newRequestModal() {
  if (draftBlocked()) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = isToday(state.currentYear, state.currentMonth, DEMO_TODAY.getDate()) ? DEMO_TODAY.getDate() : Math.min(state.currentDay, n);
  openModal('ยื่นคำขอ', kindButtons(kindsAllowed(), d), '<button class="btn" data-click="closeModal()">ยกเลิก</button>');
}

/* ---------- ส่วนประกอบของแบบฟอร์ม ---------- */
const label = c => `${swatch(c)}<span>${esc(getEmployeeFacingShiftLabel(c))}</span>`;
const opt = (v, text, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(text)}</option>`;
export function checksList(title, results) {
  if (!results || !results.length) return '';
  const mark = { pass: '✓', warn: '!', fail: '✕' };
  return `<div class="checks">${title ? `<p class="checks-t">${esc(title)}</p>` : ''}<ul>${results.map(c => `<li class="${c.status}"><i class="mk">${mark[c.status] || '•'}</i><span><b>${esc(c.rule)}</b> ${esc(c.msg)}</span></li>`).join('')}</ul></div>`;
}
function changesTable(rows) {
  if (!rows.length) return '';
  return `
    <h3>ผลที่จะเกิดในตารางกะเมื่ออนุมัติครบ</h3>
    <table class="tbl chg">
      <thead><tr><th>พนักงาน</th><th>วันที่</th><th>เดิม</th><th>เปลี่ยนเป็น</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.e.name)}</td><td class="nowrap">${esc(r.date)}</td><td>${label(r.from)}</td><td>${label(r.to)}</td></tr>`).join('')}</tbody>
    </table>`;
}
const approversList = roles => `<h3>ลำดับผู้อนุมัติ</h3><ol class="steps">${roles.map(r => `<li><b>${esc(r)}</b></li>`).join('')}</ol>`;
function dateField(labelText, idHidden) {
  const f = view.rq, y = state.currentYear, m = state.currentMonth;
  const c = getShiftCodeForDate(currentEmp(), y, m, f.day);
  return `
    <div class="field"><label for="rqDate">${labelText}</label>
      <input class="inp" id="rqDate" type="date" value="${isoOf(y, m, f.day)}" data-change="SF.rqDate(this.value)">
      ${idHidden ? `<input type="hidden" id="${idHidden}" value="${f.day}">` : ''}
      <small>${esc(new Date(y, m, f.day).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · กะของคุณ ${label(c)}</small>
    </div>`;
}
const reasonField = id => `<div class="field"><label for="${id}">เหตุผล / รายละเอียดเพิ่มเติม (ไม่บังคับ)</label><textarea class="inp" id="${id}" rows="2" data-input="SF.rqKeep('reason', this.value)">${esc(view.rq.reason)}</textarea></div>`;
const retroField = id => `<label class="chk"><input type="checkbox" id="${id}" ${view.rq.retro ? 'checked' : ''} data-change="SF.rqKeep('retro', this.checked)"><span>ยื่นคำขอย้อนหลัง (สำหรับวันที่ผ่านมาแล้ว)</span></label>`;
const ownSup = emp => `Shift Supervisor (${emp.shiftType})`;
// หัวหน้ากะไม่อนุมัติคำขอของตัวเอง: ขั้นที่เป็นหัวหน้ากะทีมเดียวกับผู้ขอ ให้ผู้จัดการฝ่ายผลิตอนุมัติแทน
const MANAGER_STEP = 'ผู้จัดการฝ่ายผลิต (อนุมัติแทนหัวหน้ากะ)';
export function routeApprovers(emp, roles) {
  if (!emp || emp.roleCategory !== 'Shift Supervisor') return roles;
  const letter = emp.shiftType.replace('Shift ', '');
  const out = [];
  roles.forEach(r => {
    const own = r.includes(`Shift ${letter}`) || r.includes(`Supervisor ${letter}`);
    const role = own ? MANAGER_STEP : r;
    const last = out[out.length - 1];
    if (!(last && last.includes('ผู้จัดการ') && role.includes('ผู้จัดการ'))) out.push(role);
  });
  return out;
}

export function openForm(k, day) {
  const emp = currentEmp();
  if (!emp) return;
  if (draftBlocked()) return;
  const n = daysIn(state.currentYear, state.currentMonth);
  const d = Math.min(Math.max(1, day || state.currentDay), n);
  const code = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, d);
  const offDays = Array.from({ length: n }, (_, i) => i + 1).filter(x => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, x) === 'O');
  view.rq = {
    k, day: d, partner: '', mode: 'mutual', leave: 'V', ot: 'MT', cover: '', coverOt: 'MT',
    code: (state.shiftDefs[code] || {}).family === 'M' ? 'N' : 'M',
    ...(((state.shiftDefs[code] || {}).family === 'N' || String(code).startsWith('N')) ? { ot: 'NT', coverOt: 'NT' } : {}),
    oldDay: code === 'O' ? d : (offDays[0] || ''), newDay: '', hol: '', reason: '', retro: false
  };
  renderForm();
}

export function renderForm() {
  const f = view.rq;
  if (!f) return;
  const emp = currentEmp();
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const myCode = getShiftCodeForDate(emp, y, m, f.day);
  const fields = [];
  let checks = '', rows = [], approvers = [ownSup(emp)], ready = false, submit = '', note = '';

  if (f.k === 'swap') {
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
  } else if (f.k === 'change') {
    fields.push(dateField('วันที่ต้องการเปลี่ยนกะ'));
    const groups = [['กะเช้า', ['M', 'MT']], ['กะดึก', ['N', 'NT']], ['อื่น ๆ', ['D', 'O']], ['ลา/หยุด', ['V', 'B', 'S', 'H']]];
    fields.push(`
      <div class="field"><label for="modalShiftSelect">กะที่ต้องการ</label>
        <select class="inp" id="modalShiftSelect" data-change="SF.rq('code', this.value)">
          ${groups.map(([g, codes]) => `<optgroup label="${g}">${codes.map(c => opt(c, `${c} · ${state.shiftDefs[c].label}`, f.code)).join('')}</optgroup>`).join('')}
        </select></div>`);
    const isOT = state.shiftDefs[f.code] && state.shiftDefs[f.code].ot;
    const v = isOT ? validateOTRequest(emp.id, f.day, f.code) : validateShiftAssignment(emp.id, f.day, f.code);
    rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.code }];
    checks = checksList(`ตรวจกฎของ ${emp.name}`, v.results);
    approvers = isOT ? [`หัวหน้ากะตรวจสอบ (${emp.shiftType})`, 'ผู้จัดการอนุมัติ OT'] : [ownSup(emp)];
    ready = v.valid && f.code !== myCode;
    submit = `submitOperatorShiftRequest(${js(emp.id)}, ${f.day}, 'change')`;
  } else if (f.k === 'leave') {
    fields.push(`
      <div class="field"><label for="leaveReqTypeSelect">ประเภทการลา</label>
        <select class="inp" id="leaveReqTypeSelect" data-change="SF.rq('leave', this.value)">${['V', 'B', 'S', 'H'].map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.leave)).join('')}</select></div>`);
    fields.push(dateField('วันที่ลา', 'leaveReqDay'));
    const mates = getAllEmployees().filter(e => e.id !== emp.id && e.shiftType === emp.shiftType);
    fields.push(`
      <div class="field"><label for="leaveCoverSelect">ผู้มาทำงานแทน (ไม่บังคับ)</label>
        <select class="inp" id="leaveCoverSelect" data-change="SF.rq('cover', this.value)">
          ${opt('', 'ไม่ระบุ ให้หัวหน้ากะจัดคนแทนภายหลัง', f.cover)}
          ${mates.map(e => opt(e.id, `${e.name} · วันนั้น ${getShiftCodeForDate(e, y, m, f.day)}`, f.cover)).join('')}
        </select><small>ถ้าเลือก คนนั้นจะได้กะเป็น OT ในวันที่คุณลา</small></div>`);
    rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.leave }];
    ready = true;
    if (f.cover) {
      const c = findEmployeeById(f.cover);
      fields.push(`<div class="field"><label for="leaveCoverOtCode">OT ที่ ${esc(c.name)} ทำแทน</label>
        <select class="inp" id="leaveCoverOtCode" data-change="SF.rq('coverOt', this.value)">${OT_PICK.map(x => opt(x, `${getEmployeeFacingShiftLabel(x)} (${x})`, f.coverOt)).join('')}</select></div>`);
      const ot = validateOTRequest(c.id, f.day, f.coverOt);
      rows.push({ e: c, date: shortDate(y, m, f.day), from: getShiftCodeForDate(c, y, m, f.day), to: f.coverOt });
      checks = checksList(`ตรวจเงื่อนไข OT ของ ${c.name}`, ot.results);
      ready = ot.valid;
    }
    fields.push(reasonField('leaveReqReason'), retroField('leaveReqRetroactive'));
    submit = `submitLeaveRequest(${js(emp.id)})`;
  } else if (f.k === 'dayoff') {
    const offDays = Array.from({ length: n }, (_, i) => i + 1).filter(x => getShiftCodeForDate(emp, y, m, x) === 'O');
    fields.push(`
      <div class="field"><label for="dayOffOldSelect">วันหยุดเดิม</label>
        <select class="inp" id="dayOffOldSelect" data-change="SF.rq('oldDay', this.value)">
          ${offDays.length ? offDays.map(x => opt(x, shortDate(y, m, x), f.oldDay)).join('') : '<option value="">เดือนนี้ไม่มีวันหยุด</option>'}
        </select><small>${esc(monthLabel(y, m))} · เปลี่ยนเดือนได้ที่ปฏิทินกะของฉัน</small></div>`);
    const old = Number(f.oldDay);
    const cand = [];
    if (old) for (let x = Math.max(1, old - 7); x <= Math.min(n, old + 7); x++) if (x !== old) cand.push(x);
    fields.push(`
      <div class="field"><label for="dayOffNewDay">ย้ายวันหยุดไปวันที่</label>
        <select class="inp" id="dayOffNewDay" data-change="SF.rq('newDay', this.value)">
          ${opt('', 'เลือกวัน (ไม่เกิน 7 วันจากวันหยุดเดิม)', f.newDay)}
          ${cand.map(x => opt(x, `${shortDate(y, m, x)} · ปัจจุบัน ${getEmployeeFacingShiftLabel(getShiftCodeForDate(emp, y, m, x))}`, f.newDay)).join('')}
        </select></div>`);
    fields.push(reasonField('dayOffReason'), retroField('dayOffRetroactive'));
    const nd = Number(f.newDay);
    if (old && nd) {
      const work = (emp.shiftType === 'Shift A' || emp.shiftType === 'Shift C') ? 'M' : 'N';
      rows = [{ e: emp, date: shortDate(y, m, old), from: 'O', to: work }, { e: emp, date: shortDate(y, m, nd), from: getShiftCodeForDate(emp, y, m, nd), to: 'O' }];
      const within = Math.abs(nd - old) <= 7;
      checks = checksList('', [{ status: within ? 'pass' : 'fail', rule: 'กรอบเวลา', msg: within ? 'วันหยุดใหม่อยู่ภายใน 7 วันจากวันหยุดเดิม' : 'วันหยุดใหม่ต้องอยู่ภายใน 7 วันจากวันหยุดเดิม' }]);
      ready = within;
    }
    submit = `submitDayOffChangeRequest(${js(emp.id)})`;
  } else if (f.k === 'ot') {
    fields.push(dateField('วันที่ต้องการทำ OT', 'otReqDay'));
    fields.push(`
      <div class="field"><label for="otReqCode">รูปแบบ OT</label>
        <select class="inp" id="otReqCode" data-change="SF.rq('ot', this.value)">${OT_PICK.map(c => opt(c, `${getEmployeeFacingShiftLabel(c)} (${c})`, f.ot)).join('')}</select></div>`);
    fields.push(reasonField('otReqReason'));
    const v = validateOTRequest(emp.id, f.day, f.ot);
    rows = [{ e: emp, date: shortDate(y, m, f.day), from: myCode, to: f.ot }];
    checks = checksList(`ตรวจกฎของ ${emp.name}`, v.results);
    if (v.requiresManagerSpecialReview) note = '<p class="notice">วันนี้อยู่ระหว่างลาพักร้อน ต้องได้รับอนุมัติพิเศษจากผู้จัดการ</p>';
    ready = v.valid;
    submit = `submitOTRequest(${js(emp.id)})`;
  } else if (f.k === 'holiday') {
    const hols = getHolidaysForYear(y);
    if (!f.hol && hols.length) f.hol = hols[0];
    fields.push(`
      <div class="field"><label for="publicHolidaySelect">วันหยุดนักขัตฤกษ์ ปี ${y + 543}</label>
        ${hols.length ? `<select class="inp" id="publicHolidaySelect" data-change="SF.rq('hol', this.value)">${hols.map(h => opt(h, h, f.hol)).join('')}</select>` : '<p class="notice">ยังไม่มีวันหยุดนักขัตฤกษ์ของปีนี้ ผู้จัดการตั้งค่าได้ที่หน้าตารางรายปี</p>'}
      </div>`);
    const p = f.hol && parseThaiDate(f.hol);
    if (p) rows = p.days.map(d => ({ e: emp, date: shortDate(p.y, p.m, d), from: getShiftCodeForDate(emp, p.y, p.m, d), to: 'H' }));
    ready = !!hols.length;
    submit = `submitPublicHolidayChoice(${js(emp.id)})`;
  }

  const body = `
    <dl class="facts plain"><div><dt>ผู้ขอ</dt><dd>${esc(emp.name)} (${esc(emp.id)}) ${esc(getEmployeeFacingRoleLabel(emp.roleCategory))} ${esc(emp.shiftType)}</dd></div></dl>
    <div class="form">${fields.join('')}</div>
    ${note}
    ${changesTable(rows)}
    ${checks}
    ${approversList(routeApprovers(emp, approvers))}`;
  const box = $('#modalRoot .modal-body');
  const top = box ? box.scrollTop : 0;
  openModal(`ยื่นคำขอ ${kindLabel(f.k)}`, body,
    `<button class="btn" data-click="SF.newRequest()">ย้อนกลับ</button><button class="btn primary" ${ready && submit ? `data-click="${submit}"` : 'disabled'}>ส่งคำขอ</button>`);
  const nb = $('#modalRoot .modal-body');
  if (nb) nb.scrollTop = top;
}

/* ==========================================================================
   ส่งคำขอ
   ========================================================================== */
let afterSubmit = () => {};
export function onSubmitted(fn) { afterSubmit = fn; }
const monthText = (style = 'long') => new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: style, year: 'numeric' });

// LOCAL: บันทึกคำขอเดโมในเบราว์เซอร์ — ตอนต่อ API ให้เปลี่ยนเป็น POST ไปยังระบบหลังบ้านที่นี่จุดเดียว
function saveLocalRequest(req, logText, actor) {
  const id = Date.now();
  const requester = findEmployeeById(req.requesterId);
  const roles = routeApprovers(requester, req.approvers.map(a => a.role));
  req.approvers = roles.map(role => ({ role, status: 'pending' }));
  state.localRequests.unshift({ id, ts: id, y: state.currentYear, m: state.currentMonth, submittedAt: 'เมื่อสักครู่', ...req });
  addLog(logText, { actor: actor.name, employeeId: actor.id, avatar: actor.initials });
  saveLocal();
}
function done(message) {
  closeModal();
  showToast(message);
  merge();
  afterSubmit();
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

export function submitOperatorShiftRequest(targetEmpId, dayNum) {
  const emp = currentEmp();
  const shiftCode = ($('#modalShiftSelect') || {}).value;
  if (!emp || !shiftCode) return;
  const used = countMonthlySwapRequests(emp.id), limit = state.managerConfig.swapRequestMonthlyLimit;
  if (used >= limit) { showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${limit} ครั้ง/เดือนแล้ว`, 'alert'); return; }
  const isOT = state.shiftDefs[shiftCode] && state.shiftDefs[shiftCode].ot;
  const requestType = isOT ? 'ขอทำ OT' : 'ขอเปลี่ยนกะ';
  const dateLabel = `${dayNum} ${monthText('short')}`;
  saveLocalRequest({
    type: requestType, person: emp.name, requesterId: emp.id, day: Number(dayNum), initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: dateLabel, currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, dayNum), targetShift: shiftCode,
    reason: isOT ? `ขอทำ OT (${shiftCode}) วันที่ ${dateLabel}` : `ขอเปลี่ยนกะของฉันเป็น ${shiftCode}`, isCrossShift: false,
    approvers: isOT ? [{ role: `หัวหน้ากะตรวจสอบ (${emp.shiftType})`, status: 'pending' }, { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }] : [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }],
    status: 'รอดำเนินการ', quotaUsed: `${used + 1} / ${limit} ครั้ง`
  }, `${requestType}วันที่ ${dateLabel}`, emp);
  done(`ส่ง${requestType}เรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${used + 1}/${limit} ครั้งในเดือนนี้)`);
}

export function submitLeaveRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const leaveCode = ($('#leaveReqTypeSelect') || {}).value || 'V';
  const day = parseInt(($('#leaveReqDay') || {}).value, 10) || state.currentDay;
  const reason = ($('#leaveReqReason') || {}).value || '';
  const isRetroactive = !!($('#leaveReqRetroactive') || {}).checked;
  const coverId = ($('#leaveCoverSelect') || {}).value || '';
  const coverEmp = coverId ? findEmployeeById(coverId) : null;
  const coverOtCode = ($('#leaveCoverOtCode') || {}).value || 'MT';
  const dateLabel = `${day} ${monthText()}`;
  if (coverEmp && !validateOTRequest(coverId, day, coverOtCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่งผู้มาทำแทนไม่ผ่านเงื่อนไข', 'alert'); return; }
  const coverNote = coverEmp ? ` — มอบหมายให้ ${coverEmp.name} มาทำแทน (OT ${coverOtCode})` : '';
  saveLocalRequest({
    type: `ขอลา (${leaveCode})${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, day, leaveCode,
    coverId: coverEmp ? coverEmp.id : null, coverOtCode, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: coverEmp ? coverEmp.name : null, targetRole: coverEmp ? coverEmp.roleCategory : null, date: dateLabel,
    currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day) || '-', targetShift: leaveCode,
    reason: (reason || `ขอลา (${leaveCode}) วันที่ ${dateLabel}`) + coverNote, isCrossShift: false, isRetroactive,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอลา (${leaveCode}) วันที่ ${dateLabel}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}${coverEmp ? ` พร้อมมอบหมายให้ ${coverEmp.name} ทำ OT (${coverOtCode}) แทน` : ''}`, emp);
  done('ส่งคำขอลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}

export function submitDayOffChangeRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const oldDay = parseInt(($('#dayOffOldSelect') || {}).value, 10);
  const newDay = parseInt(($('#dayOffNewDay') || {}).value, 10);
  const reason = ($('#dayOffReason') || {}).value || '';
  const isRetroactive = !!($('#dayOffRetroactive') || {}).checked;
  if (!oldDay || !newDay) { showToast('กรุณาระบุวันหยุดเดิมและวันหยุดใหม่ให้ครบถ้วน', 'alert'); return; }
  if (Math.abs(newDay - oldDay) > 7) { showToast('ไม่สามารถส่งคำขอได้ — วันหยุดใหม่ต้องอยู่ในกรอบ ±7 วันจากวันหยุดเดิม', 'alert'); return; }
  const dateLabel = `${oldDay} → ${newDay} ${monthText()}`;
  saveLocalRequest({
    type: `เปลี่ยนวันหยุด${isRetroactive ? ' — ย้อนหลัง' : ''}`, person: emp.name, requesterId: emp.id, oldDay, newDay, initials: emp.initials, roleCategory: emp.roleCategory,
    targetPerson: null, targetRole: null, date: dateLabel, currentShift: 'O', targetShift: 'O', reason: reason || `ขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}`,
    isCrossShift: false, isRetroactive, approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}`, emp);
  done('ส่งคำขอเปลี่ยนวันหยุดเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}

export function submitOTRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const day = parseInt(($('#otReqDay') || {}).value, 10);
  const otCode = ($('#otReqCode') || {}).value || 'MT';
  const reason = ($('#otReqReason') || {}).value || '';
  if (!day) { showToast('กรุณาระบุวันที่ต้องการทำงานล่วงเวลา', 'alert'); return; }
  if (!validateOTRequest(empId, day, otCode).valid) { showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert'); return; }
  const dateLabel = `${day} ${monthText()}`;
  saveLocalRequest({
    type: 'ขอทำ OT', person: emp.name, requesterId: emp.id, day, initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: dateLabel, currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day), targetShift: otCode,
    reason: reason || `ขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`, isCrossShift: false,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นคำขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`, emp);
  done('ส่งคำขอทำงานล่วงเวลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
}

export function submitPublicHolidayChoice(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const holiday = ($('#publicHolidaySelect') || {}).value;
  saveLocalRequest({
    type: 'สิทธิ์วันหยุดนักขัตฤกษ์', person: emp.name, requesterId: emp.id, initials: emp.initials, roleCategory: emp.roleCategory, targetPerson: null, targetRole: null,
    date: holiday, currentShift: '-', targetShift: 'H', reason: `ขอใช้สิทธิ์หยุดตามประกาศวันหยุดนักขัตฤกษ์ (${holiday})`, isCrossShift: false,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }], status: 'รอดำเนินการ', quotaUsed: '-'
  }, `ยื่นขอใช้สิทธิ์วันหยุดนักขัตฤกษ์ (${holiday})`, emp);
  done('ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
}
