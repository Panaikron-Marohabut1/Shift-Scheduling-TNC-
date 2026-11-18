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
import { summarizeMonth } from '../../shared/scheduling/month-summary.js';
import { getCalendarShiftCode, getCurrentWorkRun, getShiftCodeForDate, getShiftOverride, getTeamForDate } from '../../shared/scheduling/roster.js';
import { countMonthlySwapRequests } from '../../shared/scheduling/rules.js';
import { isRequestInProgress, requestSectionLabels, statusCls, withCurrentRequestStatus } from '../requests/list.js';
import { changeNote, codeClass, overtimeKindLabel, overtimeLegendHtml, shownCode } from './codes.js';
import { changeSource } from './change-info.js';
import { isToday } from './days.js';
import { monthNav, scheduleState, statusChips } from './month-nav.js';

// "07:30–19:30 (+OT x1, รับ-ส่ง)" → { hours: '07:30–19:30', details: ['OT ×1', 'รับ–ส่ง'] }
function splitTime(time) {
  const [, hours, extra] = /^(\d{2}:\d{2}–\d{2}:\d{2})(?: \((.+)\))?$/.exec(time || '') || [];
  const details = extra?.replace(/^\+/, '').replace('รับ-ส่ง', 'รับ–ส่ง').replace('OT x', 'OT ×').split(', ') || [];
  return { hours: hours || '', details };
}

function formatSummaryAmount({ minutes, shifts, unquantifiedShifts }, incomplete = false) {
  const uncertain = incomplete || unquantifiedShifts > 0;
  const remainder = minutes % 60;
  const duration = `${Math.floor(minutes / 60)} ชม.${remainder ? ` ${remainder} นาที` : ''}`;
  const hours = uncertain && !minutes ? 'ไม่ทราบชั่วโมง'
    : `${uncertain ? 'อย่างน้อย ' : ''}<span class="my-sum-unit">${esc(duration)}</span>`;
  const count = incomplete ? (shifts ? `อย่างน้อย ${shifts} กะ` : 'ไม่ทราบจำนวนกะ') : `${shifts} กะ`;
  return `${hours}<wbr><span class="my-sum-unit"> / ${esc(count)}</span>`;
}

function monthSummaryHtml(title, summary, previewCount, absenceHistoryUnavailable) {
  const { regular, overtime, holidayOvertime, leave, absence, total, unclassifiedShifts } = summary;
  const incomplete = unclassifiedShifts > 0;
  const absenceValue = absenceHistoryUnavailable ? 'พ้นระยะเวลาเก็บประวัติขาดงาน'
    : absence.shifts ? formatSummaryAmount(absence) : 'ยังไม่มีรายการขาดงานที่บันทึก';
  const items = [
    ['ทำงานปกติ', formatSummaryAmount(regular)],
    ['OT ปกติ', formatSummaryAmount(overtime)],
    ['OT นักขัตฤกษ์', formatSummaryAmount(holidayOvertime)],
    ['ลา', formatSummaryAmount(leave)],
    ['ขาดงาน', absenceValue],
  ];
  return `<section class="my-sum" aria-label="สรุปตารางกะประจำเดือน">
    <header class="my-sum-header">
      <h2>${esc(title)}</h2>
      <dl class="my-sum-total"><div><dt>รวมเวลาทำงานตามตาราง</dt><dd>${absenceHistoryUnavailable ? 'ยืนยันยอดรวมไม่ได้' : formatSummaryAmount(total, incomplete)}</dd></div></dl>
    </header>
    <dl class="my-stats">
      ${items.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}
      ${previewCount ? `<div><dt>OT คำนวณย้อนหลัง</dt><dd>${previewCount} กะ</dd></div>` : ''}
    </dl>
    ${incomplete ? '<p class="my-sum-note">ข้อมูลกะไม่ครบ สรุปจากรายการที่มีข้อมูล</p>' : ''}
    ${absenceHistoryUnavailable ? '<p class="my-sum-note">ยอดแยกประเภทแสดงกะตามตาราง ประวัติขาดงานพ้นระยะเวลาเก็บ</p>' : ''}
  </section>`;
}

function localSummaryDay(emp, y, m, day, code, slot, rosterCode) {
  const request = changeSource(emp, y, m, day);
  const applied = !request?.api && request?.applied?.findLast(change =>
    change.empId === emp.id && change.y === y && change.m === m && change.d === day && change.code === code);
  const baseCode = applied?.from ?? applied?.prev;
  const hasRosterClock = shift => shift != null && (shift === slot?.shift_code || shift === rosterCode);
  return {
    code, baseCode,
    ...(hasRosterClock(code) ? { startTime: slot?.start_time, endTime: slot?.end_time } : {}),
    ...(hasRosterClock(baseCode) ? { baseStartTime: slot?.start_time, baseEndTime: slot?.end_time } : {}),
  };
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
  const monthRoster = state.apiMonths[monthKey(y, m)];
  const preview = historical ? monthRoster?.holidayOvertimePreview ?? [] : [];
  const slots = state.apiAssign[emp.id] ?? {};
  const overtimeByDate = new Map(preview.map(item => [item.workDate, item]));
  const unavailable = state.actor?.remotePilot && !hasData && !projected;
  const todayNum = Math.min(state.currentDay, n);
  const monthStatus = monthRoster?.loadFailed ? '<span class="st warn" role="status">โหลดตารางกะไม่สำเร็จ กรุณาโหลดหน้าใหม่</span>'
    : unavailable ? '<span class="st warn" role="status">ไม่พบข้อมูลตารางกะสำหรับเดือนนี้</span>'
    : statusChips(schedule, { holidayOvertimePreview: overtimeByDate.size > 0 }).replace('<span class="st ok">ยื่นคำขอได้</span>', '');
  const codes = Array.from({ length: n }, (_, i) => unavailable ? null : getCalendarShiftCode(emp, y, m, i + 1));
  const team = getTeamForDate(emp, y, m, todayNum);
  const todayCode = codes[todayNum - 1];
  const todaySlot = slots[isoOf(y, m, todayNum)];
  const todayHolidayOT = Boolean(todaySlot?.holidayOvertime);
  const todayDef = state.shiftDefs[todayCode] || state.shiftDefs.O;
  const time = ['MT', 'NT'].includes(todayCode) && getShiftCodeForDate(emp, y, m, todayNum) !== todayCode
    ? todayDef.time.split(' (')[0] : todayDef.time || '';
  const { hours, details } = splitTime(time);
  const todayOT = overtimeKindLabel(todayCode, todayHolidayOT);
  if (todayOT) details.unshift(todayOT);
  const todayStr = new Date(y, m, todayNum).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const workRun = isCurrentMonth && !unavailable ? getCurrentWorkRun(emp, DEMO_TODAY) : null;
  const workLimit = state.actor?.maxConsecutiveWorkDays ?? state.managerConfig.maxConsecutiveWorkDays;
  const streakText = workRun
    ? `${workRun.total && !workRun.totalComplete ? 'อย่างน้อย ' : ''}${workRun.total ?? 0} / ${workLimit} วัน`
    : 'ข้อมูลกะไม่ครบ';
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
  const sum = unavailable ? null : summarizeMonth(codes.map((code, index) => {
    const day = index + 1;
    const iso = isoOf(y, m, day);
    const slot = slots[iso];
    const override = getShiftOverride(emp, y, m, day);
    if (hasData && slot?.status !== 'ACTIVE' && !override) return { code: null };
    const absence = slot?.absence;
    if (override && !absence && !slot?.holidayLeave && !slot?.holidayOvertime) {
      return localSummaryDay(emp, y, m, day, override, slot, state.apiCodes[emp.id]?.[iso]);
    }
    return {
      code: absence?.shiftCode ?? code,
      baseCode: slot?.leaveBaseCode,
      leaveMinutes: slot?.leaveMinutes,
      holidayOvertime: slot?.holidayOvertime,
      absence: Boolean(absence),
      startTime: absence ? absence.startTime : slot?.start_time,
      endTime: absence ? absence.endTime : slot?.end_time,
    };
  }), state.shiftDefs);
  const summaryTitle = projected ? 'สรุปกะคาดการณ์' : !schedule.published ? 'สรุปตารางกะฉบับร่าง'
    : isCurrentMonth ? 'สรุปเดือนนี้' : 'สรุปตารางกะ';
  const lead = new Date(y, m, 1).getDay();
  const label = c => getEmployeeFacingShiftLabel(String(c).split('/').length === 2 ? String(c).split('/')[0] : c);
  const calendarKinds = ['M', 'N', 'D'].filter(code => codes.some(c => state.shiftDefs[c]?.family === code));
  const hasOvertime = overtimeByDate.size > 0 || codes.some(c => overtimeKindLabel(c));
  const cal = `
    <div class="cal">
      <div class="cal-head">${TH_DW.map((d, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${d}</span>`).join('')}</div>
      <div class="cal-body">
        ${Array.from({ length: lead }, () => '<span class="cal-x"></span>').join('')}
        ${codes.map((rosterCode, i) => {
          const d = i + 1;
          const date = new Date(y, m, d);
          const iso = isoOf(y, m, d);
          const slot = slots[iso];
          const absence = slot?.absence;
          const actualOT = slot?.holidayOvertime;
          const previewOT = actualOT || absence ? null : overtimeByDate.get(iso);
          const holidayOT = Boolean(actualOT || previewOT);
          const c = previewOT?.shiftCode || rosterCode;
          const overtime = overtimeKindLabel(c, holidayOT);
          const today = isToday(y, m, d);
          const weekday = date.getDay();
          const h = hol[`${m}-${d}`];
          const dayKind = h ? 'hol' : weekday === 0 || weekday === 6 ? 'we' : '';
          const chg = c ? changeNote(emp, y, m, d, getShiftCodeForDate(emp, y, m, d)) : '';
          const cls = `cal-d ${codeClass(c || 'O', holidayOT)} ${absence ? 'is-absent' : ''} ${chg ? 'chg' : ''} ${today ? 'tdy' : ''} ${date < DEMO_TODAY ? 'past' : ''} ${!hasData && !unavailable ? 'proj' : ''} ${dayKind}`;
          const def = state.shiftDefs[c] || {};
          const dayHours = splitTime(def.time).hours;
          // เวลาเข้า–ออกในทุกวันทำงาน; จอแคบแบ่งเป็นสองบรรทัดโดยไม่ตัดข้อมูล
          return `<button class="${cls}" ${c ? `data-click="SF.cell(${js(emp.id)}, ${d}, ${js(previewOT ? 'holiday-preview' : '')})"` : 'disabled'} ${today ? 'aria-current="date"' : ''} aria-label="${d} ${esc(monthLabel(y, m))} ${esc(c ? label(c) : 'ไม่มีข้อมูลกะ')}${overtime ? ` · ${esc(overtime)}` : ''}${previewOT ? ' ผลคำนวณย้อนหลัง' : ''}${absence ? ' · ขาดงาน' : ''}${chg ? ` · ${esc(chg)}` : ''}${h ? ` · ${esc(h)}` : ''}">
            <span class="n">${d}</span>
            <span class="cal-shift"><b class="cal-code">${c && c !== 'O' ? esc(shownCode(c)) : ''}</b>${dayHours ? `<small class="cal-time"><span>${esc(dayHours.split('–')[0])}</span><span class="cal-time-sep">–</span><span>${esc(dayHours.split('–')[1])}</span></small>` : ''}${absence ? '<span class="absence-tag">ขาดงาน</span>' : ''}</span>
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
              <span class="chip today-chip ${codeClass(todayCode || 'O', todayHolidayOT)}">${todayCode ? esc(shownCode(todayCode)) : '–'}</span>
              <div class="today-summary">
                <div class="today-shift">
                  <div class="my-shift-title"><b>${todayCode ? esc(label(todayCode)) : 'ไม่มีข้อมูลกะ'}</b>${todaySlot?.absence ? '<span class="absence-tag">ขาดงาน</span>' : ''}${hours ? `<span class="today-hours">${esc(hours)}${todayDef.family === 'N' ? '<span class="sr">เลิกวันถัดไป</span>' : ''}</span>` : ''}</div>
                  ${details.length ? `<span class="today-details">${details.map(esc).join(' · ')}</span>` : ''}
                </div>
                <dl class="my-duty-facts">
                  ${unavailable ? '' : `<div id="myWorkRun"><dt>ทำงานต่อเนื่องตามตาราง</dt><dd>${esc(streakText)}</dd></div>`}
                  <div><dt>สิทธิ์สลับกะ</dt><dd id="mySwapQuota">${esc(quotaText)}</dd></div>
                </dl>
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
          <div class="my-calendar-meta"><div class="mstatus">${monthStatus}</div><div class="my-calendar-times">${calendarKinds.map(code => `<span><i class="chip ${codeClass(code)}">${esc(code)}</i>${esc(label(code))}</span>`).join('')}</div>${hasOvertime ? overtimeLegendHtml() : ''}</div>
          ${cal}
          ${unavailable ? '' : `<p class="my-cal-hint">${projected ? 'แตะวันเพื่อดูรายละเอียดกะคาดการณ์' : historical ? 'แตะวันเพื่อดูรายละเอียดกะ' : 'แตะวันเพื่อดูรายละเอียดหรือยื่นคำขอ'}</p>`}
        </section>
        ${unavailable ? '' : monthSummaryHtml(summaryTitle, sum, overtimeByDate.size, monthRoster?.absenceHistoryAvailable === false)}
      </div>
    </div>`;
}
