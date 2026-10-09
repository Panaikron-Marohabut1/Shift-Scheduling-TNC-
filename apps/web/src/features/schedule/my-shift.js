/* ==========================================================================
   กะของฉัน (พนักงาน และหัวหน้ากะ): กะวันนี้ ปฏิทินทั้งเดือน สรุป และคำขอของฉัน
   ปฏิทินนี้คือข้อมูลชุดเดียวกับตารางกะ: เดือนที่เปิด สถานะประกาศ/ล็อก และการกดวัน
   (เปิดหน้าต่างเดียวกับการกดช่องของตัวเองในตารางกะ) ใช้กฎเดียวกันทั้งหมด
   ========================================================================== */
import { state, DEMO_TODAY } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import {
  TH_DW, daysIn, shortDate, getAllEmployees, getShiftCodeForDate, getEmployeeFacingShiftLabel, hasScheduleDataForMonth, isYearPublished,
  countMonthlySwapRequests, currentEmp
} from '../../shared/scheduling.js';
import { codeClass, famOf, cellText, changeNote, holidaysOf, draftNote, pageHead, monthNav, statusChips, scheduleState } from './view.js';
import { statusCls } from '../requests/view.js';

export function myHtml() {
  const emp = currentEmp();
  if (!emp) return '<p class="empty">ไม่พบข้อมูลพนักงาน</p>';
  const y = state.currentYear, m = state.currentMonth, n = daysIn(y, m);
  const todayNum = Math.min(state.currentDay, n);
  const hasData = hasScheduleDataForMonth(y, m);
  const hol = holidaysOf(y);
  const sup = getAllEmployees().find(e => e.roleCategory === 'Shift Supervisor' && e.shiftType === emp.shiftType && e.id !== emp.id);
  const todayCode = getShiftCodeForDate(emp, y, m, todayNum);
  const todayDef = state.shiftDefs[todayCode] || state.shiftDefs.O;
  const todayStr = new Date(y, m, todayNum).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // วันทำงานต่อเนื่อง: นับย้อนหลังจากวันนี้จนเจอวันหยุด
  let streak = 0;
  for (let d = todayNum; d >= 1; d--) {
    const c = getShiftCodeForDate(emp, y, m, d), def = state.shiftDefs[c];
    if (!def || def.family === 'off' || c === 'O' || def.leave) break;
    streak++;
  }
  const next = [1, 2, 3].map(i => todayNum + i).filter(d => d <= n);
  const mine = state.requests.filter(r => r.requesterId === emp.id);
  const left = Math.max(0, state.managerConfig.swapRequestMonthlyLimit - countMonthlySwapRequests(emp.id));
  const codes = Array.from({ length: n }, (_, i) => getShiftCodeForDate(emp, y, m, i + 1));
  const sum = { work: 0, ot: 0, leave: 0, off: 0 };
  codes.forEach(c => { const d = state.shiftDefs[c]; if (c === 'O') sum.off++; else if (d && d.leave) sum.leave++; else { sum.work++; if (d && d.ot) sum.ot++; } });
  const lead = new Date(y, m, 1).getDay();
  const label = c => getEmployeeFacingShiftLabel(String(c).split('/').length === 2 ? String(c).split('/')[0] : c);
  const cal = `
    <div class="cal">
      <div class="cal-head">${TH_DW.map((d, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${d}</span>`).join('')}</div>
      <div class="cal-body">
        ${Array.from({ length: lead }, () => '<span class="cal-x"></span>').join('')}
        ${codes.map((c, i) => {
          const d = i + 1;
          const w = new Date(y, m, d).getDay();
          const h = hol[`${m}-${d}`];
          const chg = changeNote(emp, y, m, d, c);
          const cls = `cal-d ${codeClass(c)} ${chg ? 'chg' : ''} ${d === todayNum ? 'tdy' : ''} ${d < todayNum ? 'past' : ''} ${!hasData ? 'proj' : ''} ${h ? 'hol' : (w === 0 || w === 6) ? 'we' : ''}`;
          return `<button class="${cls}" data-click="SF.cell(${js(emp.id)}, ${d})" title="${esc(label(c))}${chg ? ` · ${esc(chg)}` : ''}${h ? ` · ${esc(h)}` : ''}"><span class="n">${d}</span><b>${cellText(c)}</b>${h ? `<small class="hn">${esc(h)}</small>` : ''}</button>`;
        }).join('')}
      </div>
    </div>`;
  return `
    ${pageHead('กะของฉัน', '<button class="btn primary" data-click="SF.newRequest()">ยื่นคำขอ</button>')}
    <div class="my">
      <section class="panel my-now">
        <p class="my-date">${esc(todayStr)} · ${esc(emp.shiftType)}</p>
        <div class="my-shift ${famOf(todayCode)}">
          <b>${esc(label(todayCode))}</b>
          <span>รหัส ${esc(todayCode)} · ${esc(todayDef.time || '-')}</span>
        </div>
        ${!isYearPublished(y) ? `<p class="note warn">${draftNote(y)}</p>` : !hasData ? '<p class="note warn">ตารางเดือนนี้เป็นการคาดการณ์ ยังไม่ใช่ตารางจริง โปรดยืนยันกะกับหัวหน้ากะ</p>' : ''}
        <dl class="facts plain my-meta">
          ${emp.roleCategory === 'Shift Supervisor' ? '<div><dt>ตำแหน่ง</dt><dd>หัวหน้ากะ</dd></div>' : `<div><dt>หัวหน้ากะ</dt><dd>${sup ? `คุณ${esc(sup.name)}` : 'ไม่ระบุ'}</dd></div>`}
          <div><dt>รหัสพนักงาน</dt><dd>${esc(emp.code || emp.id)}</dd></div>
          <div><dt>ทำงานต่อเนื่อง</dt><dd>${streak} / ${state.managerConfig.maxConsecutiveWorkDays} วัน</dd></div>
        </dl>
        <ul class="my-next">
          ${next.map((d, i) => { const c = getShiftCodeForDate(emp, y, m, d); return `<li><span>${i === 0 ? 'พรุ่งนี้' : shortDate(y, m, d)}</span><i class="cd ${famOf(c)}"></i><b>${esc(label(c))}</b></li>`; }).join('')}
        </ul>
        <div class="linkrow"><button class="link" data-click="SF.whoToday()">ดูว่าใครเข้ากะวันนี้</button><button class="link" data-click="SF.nav('schedule')">ดูตารางกะเต็มของทุกทีม</button></div>
      </section>

      <section class="panel my-cal">
        <div class="bar">${monthNav(true)}<button class="btn ghost" data-click="jumpToScheduleMonth(${DEMO_TODAY.getFullYear()}, ${DEMO_TODAY.getMonth()})">เดือนนี้</button><span class="muted small">แตะวันเพื่อดูรายละเอียดและยื่นคำขอของวันนั้น</span></div>
        <div class="mstatus">${statusChips(scheduleState())}</div>
        ${cal}
        <dl class="facts">
          <div><dt>ทำงาน</dt><dd>${sum.work}</dd></div>
          <div><dt>OT</dt><dd>${sum.ot}</dd></div>
          <div><dt>ลา</dt><dd>${sum.leave}</dd></div>
          <div><dt>หยุด</dt><dd>${sum.off}</dd></div>
        </dl>
      </section>

      <section class="panel my-req">
        <div class="panel-h"><h2>คำขอของฉัน</h2><span class="muted">สิทธิ์สลับกะเหลือ ${left}/${state.managerConfig.swapRequestMonthlyLimit}</span></div>
        ${mine.length ? `<ul class="rlist">${mine.slice(0, 4).map(r => `
          <li><button class="rline" data-click="openRequestDetails(${r.id})">
            <span class="rl-main"><b>${esc(r.type)} · ${esc(r.date)}</b><span>${esc(r.targetPerson ? `กับ ${r.targetPerson}` : r.reason)}</span></span>
            <span class="st ${statusCls(r)}">${esc(r.status)}</span>
          </button></li>`).join('')}</ul>
          <button class="link" data-click="SF.nav(${js(state.activeRole === 'Shift Employee' ? 'my-requests' : 'requests')})">ดูทั้งหมด</button>` : '<p class="none">ยังไม่มีคำขอ</p>'}
      </section>
    </div>`;
}
