/* ==========================================================================
   กะของฉัน (พนักงาน และหัวหน้ากะ): กะวันนี้ ปฏิทินทั้งเดือน สรุป และคำขอของฉัน
   ปฏิทินนี้คือข้อมูลชุดเดียวกับตารางกะ: เดือนที่เปิด สถานะประกาศ/ล็อก และการกดวัน
   (เปิดหน้าต่างเดียวกับการกดช่องของตัวเองในตารางกะ) ใช้กฎเดียวกันทั้งหมด
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { getMySwapQuota } from '../../app/data.js';
import { esc, js } from '../../shared/dom.js';
import { isoOf, monthKey, monthLabel, TH_DW } from '../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingShiftLabel } from '../../shared/scheduling/employees.js';
import { getCalendarShiftCode, getShiftCodeForDate, getTeamForDate } from '../../shared/scheduling/roster.js';
import { countMonthlySwapRequests } from '../../shared/scheduling/rules.js';
import { isRequestInProgress, requestSectionLabels, statusCls, withCurrentRequestStatus } from '../requests/list.js';
import { changeNote, codeClass, shownCode } from './codes.js';
import { isToday } from './days.js';
import { monthNav, scheduleState, statusChips } from './month-nav.js';

// "07:30–19:30 (+OT x1, รับ-ส่ง)" → { hours: '07:30–19:30', details: ['OT ×1', 'รับ–ส่ง'] }
function splitTime(time) {
  const [, hours, extra] = /^(\d{2}:\d{2}–\d{2}:\d{2})(?: \((.+)\))?$/.exec(time || '') || [];
  const details = extra?.replace(/^\+/, '').replace('รับ-ส่ง', 'รับ–ส่ง').replace('OT x', 'OT ×').split(', ') || [];
  return { hours: hours || '', details };
}

export function myHtml() {
  const emp = currentEmp();
  if (!emp) return '<p class="empty">ไม่พบข้อมูลพนักงาน</p>';
  const schedule = scheduleState();
  const { y, m, n, hasData, projected, hol } = schedule;
  const currentMonth = new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth(), 1).getTime();
  const viewedMonth = new Date(y, m, 1).getTime();
  const isCurrentMonth = viewedMonth === currentMonth;
  const historical = viewedMonth < currentMonth;
  const preview = historical
    ? state.apiMonths[monthKey(y, m)]?.holidayOvertimePreview ?? []
    : [];
  const overtimeByDate = new Map(preview.map(item => [item.workDate, item.shiftCode]));
  const unavailable = state.actor?.remotePilot && !hasData && !projected;
  const todayNum = Math.min(state.currentDay, n);
  const monthStatus = unavailable ? '<span class="st warn" role="status">ไม่พบข้อมูลตารางกะสำหรับเดือนนี้</span>'
    : statusChips(schedule, { holidayOvertimePreview: overtimeByDate.size > 0 }).replace('<span class="st ok">ยื่นคำขอได้</span>', '');
  const codes = Array.from({ length: n }, (_, i) => unavailable ? null : getCalendarShiftCode(emp, y, m, i + 1));
  const team = getTeamForDate(emp, y, m, todayNum);
  const todayCode = codes[todayNum - 1];
  const todayDef = state.shiftDefs[todayCode] || state.shiftDefs.O;
  const time = ['MT', 'NT'].includes(todayCode) && getShiftCodeForDate(emp, y, m, todayNum) !== todayCode
    ? todayDef.time.split(' (')[0] : todayDef.time || '';
  const { hours, details } = splitTime(time);
  const todayStr = new Date(y, m, todayNum).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // วันทำงานต่อเนื่อง: นับย้อนหลังจากวันนี้จนเจอวันหยุด
  let streak = 0;
  for (let d = todayNum; d >= 1; d--) {
    const c = codes[d - 1], def = state.shiftDefs[c];
    if (!def || def.family === 'off' || c === 'O' || def.leave) break;
    streak++;
  }
  const mine = state.requests.filter(r => r.requesterId === emp.id).map(withCurrentRequestStatus);
  const pending = mine.filter(isRequestInProgress);
  const recent = mine.filter(r => !isRequestInProgress(r)).slice(0, 2);
  const requestRows = rows => rows.map(r => `
    <li><button type="button" class="rline" data-click="openRequestDetails(${js(r.id)})">
      <span class="rl-main"><b>${esc(r.type)}</b><span>${esc(r.date)}</span>${r.targetPerson ? `<span>กับ ${esc(r.targetPerson)}</span>` : ''}</span>
      <span class="st ${statusCls(r)}">${esc(r.status)}</span>
    </button></li>`).join('');
  const legacyLimit = state.managerConfig.swapRequestMonthlyLimit;
  const quota = getMySwapQuota();
  const quotaText = state.actor?.centralSwap
    ? quota?.result ? `เหลือ ${quota.result.remaining}/${quota.result.limit} ครั้ง`
      : quota?.error ? 'โหลดข้อมูลไม่สำเร็จ' : 'กำลังโหลด…'
    : `เหลือ ${Math.max(0, legacyLimit - countMonthlySwapRequests(emp.id))}/${legacyLimit} ครั้ง`;
  const sum = { work: 0, ot: 0, leave: 0, off: 0 };
  codes.forEach(c => { if (!c) return; const d = state.shiftDefs[c]; if (c === 'O') sum.off++; else if (d && d.leave) sum.leave++; else { sum.work++; if (d && d.ot) sum.ot++; } });
  const lead = new Date(y, m, 1).getDay();
  const label = c => getEmployeeFacingShiftLabel(String(c).split('/').length === 2 ? String(c).split('/')[0] : c);
  const calendarKinds = ['M', 'N', 'D'].filter(code => codes.some(c => state.shiftDefs[c]?.family === code));
  const cal = `
    <div class="cal">
      <div class="cal-head">${TH_DW.map((d, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${d}</span>`).join('')}</div>
      <div class="cal-body">
        ${Array.from({ length: lead }, () => '<span class="cal-x"></span>').join('')}
        ${codes.map((rosterCode, i) => {
          const d = i + 1;
          const date = new Date(y, m, d);
          const previewCode = overtimeByDate.get(isoOf(y, m, d));
          const c = previewCode || rosterCode;
          const today = isToday(y, m, d);
          const weekday = date.getDay();
          const h = hol[`${m}-${d}`];
          const dayKind = h ? 'hol' : weekday === 0 || weekday === 6 ? 'we' : '';
          const chg = c ? changeNote(emp, y, m, d, getShiftCodeForDate(emp, y, m, d)) : '';
          const cls = `cal-d ${codeClass(c || 'O')} ${chg ? 'chg' : ''} ${today ? 'tdy' : ''} ${date < DEMO_TODAY ? 'past' : ''} ${!hasData && !unavailable ? 'proj' : ''} ${dayKind}`;
          const def = state.shiftDefs[c] || {};
          const dayHours = splitTime(def.time).hours;
          // เวลาเข้า–ออกในทุกวันทำงาน; จอแคบแบ่งเป็นสองบรรทัดโดยไม่ตัดข้อมูล
          return `<button class="${cls}" ${c ? `data-click="SF.cell(${js(emp.id)}, ${d}, ${js(previewCode ? 'holiday-preview' : '')})"` : 'disabled'} ${today ? 'aria-current="date"' : ''} aria-label="${d} ${esc(monthLabel(y, m))} ${esc(c ? label(c) : 'ไม่มีข้อมูลกะ')}${previewCode ? ' · OT นักขัตฤกษ์ ผลคำนวณย้อนหลัง' : ''}${chg ? ` · ${esc(chg)}` : ''}${h ? ` · ${esc(h)}` : ''}">
            <span class="n">${d}</span>
            <span class="cal-shift"><b class="cal-code">${c && c !== 'O' ? esc(shownCode(c)) : ''}</b>${dayHours ? `<small class="cal-time"><span>${esc(dayHours.split('–')[0])}</span><span class="cal-time-sep">–</span><span>${esc(dayHours.split('–')[1])}</span></small>` : ''}</span>
            ${h ? `<small class="hn">${esc(h)}</small>` : ''}
          </button>`;
        }).join('')}
        ${Array.from({ length: (7 - ((lead + n) % 7)) % 7 }, () => '<span class="cal-x"></span>').join('')}
      </div>
    </div>`;
  return `
    <div class="my-home">
      <header class="phead my-heading">
        <div class="my-page-title"><h1>กะของฉัน</h1><p class="my-date">${esc(team)} · ${esc(emp.name)}</p></div>
      </header>
      <div class="my">
        ${isCurrentMonth ? `<section class="my-now" aria-label="กะประจำวัน">
          <div class="my-duty-main">
            <p class="my-duty-date"><span>กะวันนี้</span><strong>${esc(todayStr)}</strong></p>
            <div class="today-line">
              <span class="chip today-chip ${codeClass(todayCode || 'O')}">${todayCode ? esc(shownCode(todayCode)) : '–'}</span>
              <div class="today-text">
                <div class="today-summary">
                  <div class="my-shift-title"><b>${todayCode ? esc(label(todayCode)) : 'ไม่มีข้อมูลกะ'}</b>${hours ? `<span class="today-hours">${esc(hours)}${todayDef.family === 'N' ? '<small>เลิกวันถัดไป</small>' : ''}</span>` : ''}</div>
                  <dl class="my-duty-facts">
                    ${unavailable ? '' : `<div><dt>ทำงานต่อเนื่อง</dt><dd>${streak} / ${state.managerConfig.maxConsecutiveWorkDays} วัน</dd></div>`}
                    <div><dt>สิทธิ์สลับกะ</dt><dd id="mySwapQuota">${esc(quotaText)}</dd></div>
                  </dl>
                </div>
                ${details.length ? `<span class="today-details">${details.map(esc).join(' · ')}</span>` : ''}
              </div>
            </div>
          </div>
          ${projected || unavailable ? '' : '<div class="my-now-actions"><button class="btn primary today-act" data-click="SF.newRequest()">ยื่นคำขอ</button></div>'}
        </section>` : ''}
        <aside class="my-req" aria-label="คำขอของฉัน">
          <section class="my-pending">
            <div class="my-section-heading"><h2>${requestSectionLabels.inProgress}</h2><span>${pending.length}</span></div>
            ${pending.length ? `<ul class="rlist">${requestRows(pending.slice(0, 3))}</ul>` : '<p class="none">ไม่มีคำขอที่กำลังดำเนินการ</p>'}
          </section>
          <section class="my-recent">
            <div class="my-section-heading">
              <h2>${requestSectionLabels.recent}</h2>
              <small>${requestSectionLabels.recentStatuses}</small>
            </div>
            ${recent.length ? `<ul class="rlist">${requestRows(recent)}</ul>` : '<p class="none">ยังไม่มีรายการที่ปิดแล้ว</p>'}
          </section>
          <button type="button" class="link my-req-all" data-click="SF.nav(${js(state.activeRole === 'Shift Employee' ? 'my-requests' : 'requests')})">ดูคำขอทั้งหมด (${mine.length})</button>
          <div class="my-team-links">
            <button type="button" class="link" data-click="SF.whoToday()">ใครเข้ากะวันนี้</button>
            <button type="button" class="link" data-click="SF.nav('schedule')">ตารางกะทุกทีม</button>
          </div>
        </aside>
        <section class="my-cal" aria-label="ปฏิทินกะของฉัน">
          <div class="bar my-cal-bar">${monthNav(true)}<button class="btn ghost" data-click="SF.today()">เดือนนี้</button></div>
          <div class="my-calendar-meta"><div class="mstatus">${monthStatus}</div><div class="my-calendar-times">${calendarKinds.map(code => `<span><i class="chip ${codeClass(code)}">${esc(code)}</i>${esc(label(code))}</span>`).join('')}</div></div>
        ${cal}
        ${unavailable ? '' : `<div class="my-sum">
          <span class="my-sum-label">${projected ? 'สรุปกะคาดการณ์' : isCurrentMonth ? 'สรุปเดือนนี้' : 'สรุปตารางกะ'}</span>
          <dl class="my-stats" aria-label="สรุปตารางกะประจำเดือน">
            <div><dt>ทำงาน</dt><dd>${sum.work} วัน</dd></div>
            <div><dt>OT</dt><dd>${sum.ot} วัน</dd></div>
            ${overtimeByDate.size ? `<div><dt>OT คำนวณย้อนหลัง</dt><dd>${overtimeByDate.size} วัน</dd></div>` : ''}
            <div><dt>ลา</dt><dd>${sum.leave} วัน</dd></div>
            <div><dt>หยุด</dt><dd>${sum.off} วัน</dd></div>
          </dl>
        </div>
        <p class="my-cal-hint">${projected ? 'แตะวันเพื่อดูรายละเอียดกะคาดการณ์' : historical ? 'แตะวันเพื่อดูรายละเอียดกะ' : 'แตะวันเพื่อดูรายละเอียดหรือยื่นคำขอ'}</p>`}
        </section>
      </div>
    </div>`;
}
