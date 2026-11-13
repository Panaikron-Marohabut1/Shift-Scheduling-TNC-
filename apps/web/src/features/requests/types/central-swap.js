import { api } from '../../../api/client.js';
import { refreshAll, reloadMonths } from '../../../app/data.js';
import { state, view } from '../../../app/state.js';
import { $, esc } from '../../../shared/dom.js';
import { isoOf, monthKey, shortDate } from '../../../shared/scheduling/dates.js';
import { currentEmp, getEmployeeFacingShiftLabel } from '../../../shared/scheduling/employees.js';
import { showToast } from '../../../shared/toast.js';
import { checksList, opt } from '../form-parts.js';
import { done } from '../submit.js';

const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', dateStyle: 'short' });
const isDayOff = shift => shift?.shift_code === 'O' && shift.is_working === false;

function choices(f, emp, y, m) {
  const today = bangkokDate.format(new Date());
  const month = isoOf(y, m, 1).slice(0, 7);
  const twoDates = f.mode === 'two';
  const own = state.apiAssign[emp.id] || {};
  const dates = Object.entries(own)
    .filter(([date, shift]) => date.slice(0, 7) === month && month === today.slice(0, 7)
      && date >= today && shift.status === 'ACTIVE')
    .map(([date]) => date).sort();
  const canSwap = (date, other) => {
    const a = own[date], b = other[date];
    return a && b?.status === 'ACTIVE' && a.team_id !== b.team_id && a.position === b.position
      && a.shift_type_id !== b.shift_type_id;
  };
  const colleagues = Object.entries(state.apiAssign);
  const crossDatePartners = new Map();
  if (twoDates) {
    const workingDates = dates.filter(date => own[date].is_working === true);
    const offDates = dates.filter(date => isDayOff(own[date]));
    for (const [id, other] of colleagues) {
      const secondDates = offDates.filter(date => other[date]?.is_working === true && canSwap(date, other));
      if (!secondDates.length) continue;
      for (const date of workingDates) {
        if (!isDayOff(other[date]) || !canSwap(date, other)) continue;
        const sameTeams = secondDates.filter(second => own[second].team_id === own[date].team_id
          && other[second].team_id === other[date].team_id);
        if (!sameTeams.length) continue;
        if (!crossDatePartners.has(date)) crossDatePartners.set(date, []);
        crossDatePartners.get(date).push({ id, shift: other[date], secondDates: sameTeams });
      }
    }
  }
  const firstDates = twoDates ? dates.filter(date => crossDatePartners.has(date)) : dates;
  const selected = isoOf(y, m, Number(f.day));
  const first = firstDates.includes(selected) ? selected : firstDates[0];
  const partners = twoDates ? crossDatePartners.get(first) || [] : colleagues
    .filter(([, other]) => first && canSwap(first, other))
    .map(([id, other]) => ({ id, shift: other[first] }));
  const partner = partners.find(candidate => candidate.id === f.partner);
  const secondDates = partner?.secondDates || [];
  const second = secondDates.includes(f.secondDate) ? f.secondDate : null;
  const other = partner ? state.apiAssign[partner.id] : null;
  const pairDates = !partner ? [] : twoDates ? (second ? [first, second] : []) : [first];
  const pairs = pairDates.map(date => ({ date, a: own[date], b: other[date] }));
  return { dates, firstDates, first, partners, partner, secondDates, second, pairs };
}

const dayLabel = (date, y, m) => shortDate(y, m, Number(date.slice(-2)));
const swapDateLabel = date => {
  const [year, month, day] = date.split('-').map(Number);
  return shortDate(year, month - 1, day);
};
const payloadFor = ({ a, b }) => ({
  assignmentId: a.assignment_id, targetAssignmentId: b.assignment_id,
  assignmentVersion: a.version, targetVersion: b.version,
});

const checkPresentation = {
  PASS: { status: 'pass', statusText: 'ผ่าน' },
  FAIL: { status: 'fail', statusText: 'ไม่ผ่าน' },
  UNCONFIRMED: { status: 'pending', statusText: 'รอยืนยัน' },
};
const hiddenPassingChecks = new Set(['OWN_ASSIGNMENT', 'SAME_DATE']);
const quotaMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' });

function renderSwapChecks(checks, selectedDates) {
  const rows = new Map();
  for (const check of checks) {
    const presentation = checkPresentation[check.status];
    if (!presentation) continue;
    const key = JSON.stringify([check.rule, check.status, check.message, Boolean(check.workDate)]);
    if (!rows.has(key)) rows.set(key, {
      ...presentation, rule: check.label || '', msg: check.message, dates: new Set(),
    });
    if (check.workDate) rows.get(key).dates.add(check.workDate);
  }
  return checksList('', [...rows.values()].map(({ dates, ...row }) => {
    const coversSelection = dates.size === selectedDates.length && selectedDates.every(date => dates.has(date));
    if (!dates.size || coversSelection) return row;
    const label = [...dates].map(swapDateLabel).join(' และ ');
    return { ...row, msg: `${row.msg} (${label})` };
  }));
}

function renderRulePreview(preview, requesterName, partnerName, selectedDates) {
  if (!preview) return '';
  const retry = '<button class="btn sm" type="button" id="centralSwapCheckRetry">ตรวจอีกครั้ง</button>';
  if (preview.error) {
    return `<section class="central-swap-checks" id="centralSwapChecks" aria-labelledby="centralSwapChecksTitle">
      <h3 id="centralSwapChecksTitle">ตรวจเงื่อนไขคำขอ</h3>
      <p class="err" role="alert">${esc(preview.error)}</p>
      <div>${retry}</div>
    </section>`;
  }
  const result = preview.result;
  if (!result) {
    return '<section class="central-swap-checks" id="centralSwapChecks" aria-busy="true"><p role="status">กำลังตรวจเงื่อนไขและโควตา…</p></section>';
  }
  const pending = result.checks.filter(check => check.status === 'UNCONFIRMED');
  const checked = result.checks.filter(check => check.status === 'FAIL'
    || (check.status === 'PASS' && !hiddenPassingChecks.has(check.rule)));
  const quota = result.quota;
  const quotaBlock = quota ? `<div class="swap-quota-summary" id="centralSwapQuota">
    <div><strong>โควตาสลับกะ เดือน${esc(quotaMonth.format(new Date(`${quota.month}T00:00:00+07:00`)))}</strong>
      <p>ใช้แล้ว ${esc(quota.used)} จาก ${esc(quota.limit)} ครั้ง</p></div>
    <strong>เหลือ ${esc(quota.remaining)} ครั้ง</strong>
    <p class="small">คำขอที่รออนุมัติยังไม่ใช้โควตา${quota.remaining === 0 ? ' ส่งคำขอได้ ระบบจะตรวจโควตาอีกครั้งตอนอนุมัติ' : ''}</p>
  </div>` : '';
  const sections = [
    { id: 'Requester', title: 'ผู้ขอ', name: requesterName, extra: quotaBlock,
      checks: checked.filter(check => check.participant === 'requester') },
    { id: 'Partner', title: 'ผู้ถูกขอ (คู่สลับ)', name: partnerName,
      checks: checked.filter(check => check.participant === 'partner') },
    { id: 'Shared', title: 'เงื่อนไขร่วม', checks: checked.filter(check => !check.participant) },
    { id: 'Pending', title: 'กฎที่รอยืนยัน', checks: pending },
  ];
  return `<section class="central-swap-checks" id="centralSwapChecks" aria-labelledby="centralSwapChecksTitle">
    <h3 id="centralSwapChecksTitle">ตรวจเงื่อนไขคำขอ</h3>
    ${selectedDates.length ? `<p class="small muted">วันที่สลับกะ ${esc(selectedDates.map(swapDateLabel).join(' และ '))}</p>` : ''}
    <p class="small" role="status">${result.valid ? 'ผ่านเงื่อนไขที่ตรวจได้' : 'มีเงื่อนไขที่ยังไม่ผ่าน'}</p>
    ${sections.filter(section => section.name || section.checks.length).map(({ id, title, name, extra, checks }) => `
      <section class="swap-check-group" aria-labelledby="centralSwap${id}RulesTitle">
        <h4 id="centralSwap${id}RulesTitle">${title}${name ? `<span> · ${esc(name)}</span>` : ''}</h4>
        ${extra || ''}
        ${renderSwapChecks(checks, selectedDates) || '<p class="small muted">ยังไม่ได้ตรวจเงื่อนไขรายคน</p>'}
      </section>`).join('')}
    ${result.valid ? '' : `<div>${retry}</div>`}
  </section>`;
}

export function centralSwapForm({ f, emp, y, m }) {
  const { dates, firstDates, first, partners, partner, secondDates, second, pairs } = choices(f, emp, y, m);
  const teams = new Map();
  for (const { id, shift } of partners) {
    if (!teams.has(shift.team_code)) teams.set(shift.team_code, []);
    teams.get(shift.team_code).push(opt(id, shift.name, f.partner));
  }
  const twoDates = f.mode === 'two';
  const noCrossDate = twoDates && !firstDates.length;
  const disabled = f.submitting ? 'disabled' : '';
  const fields = [
    `<div class="field"><label for="centralSwapMode">รูปแบบสลับกะ</label>
      <select class="inp" id="centralSwapMode" aria-describedby="centralSwapModeHelp" data-change="SF.rq('mode', this.value)" ${disabled}>
        ${opt('one', 'สลับกะภายในวันเดียวกัน', f.mode)}${opt('two', 'สลับกะคนละวันกัน', f.mode)}
      </select>
      <small id="centralSwapModeHelp">${twoDates
        ? 'คู่สลับมาทำกะแทนคุณในวันที่เขาหยุด ส่วนคุณไปทำกะแทนเขาในวันที่คุณหยุด ทั้งสองวันต้องอยู่ในเดือนเดียวกัน'
        : 'เลือกวันเดียว เช่น วันที่ 12 คุณเข้ากะดึกแทนคู่สลับ และคู่สลับเข้ากะเช้าแทนคุณในวันเดียวกัน'}</small>
    </div>`,
  ];
  if (!noCrossDate) fields.push(
    `<div class="field"><label for="centralSwapDay">${twoDates ? 'วันที่คู่สลับมาทำกะแทนคุณ' : 'วันที่ต้องการสลับกะ'}</label>
      <select class="inp" id="centralSwapDay" data-change="SF.rq('day', this.value)" ${firstDates.length ? disabled : 'disabled'}>
        ${firstDates.map(date => opt(Number(date.slice(-2)), dayLabel(date, y, m)
          + (twoDates ? ` · ${getEmployeeFacingShiftLabel(state.apiAssign[emp.id][date].shift_code)}` : ''), Number(first?.slice(-2)))).join('')}
      </select></div>`,
    `<div class="field"><label for="centralSwapPartner">คู่สลับ</label>
      <select class="inp" id="centralSwapPartner" data-change="SF.rq('partner', this.value)" ${disabled}>
        ${opt('', 'เลือกคนที่ตกลงสลับกะด้วย', f.partner)}
        ${[...teams.keys()].sort().map(team => `<optgroup label="Shift ${esc(team)}">${teams.get(team).join('')}</optgroup>`).join('')}
      </select></div>`,
  );
  if (twoDates && !noCrossDate) {
    fields.push(`<div class="field"><label for="centralSwapSecond">วันที่คุณไปทำกะแทนคู่สลับ</label>
      <select class="inp" id="centralSwapSecond" data-change="SF.rq('secondDate', this.value)" ${partner ? disabled : 'disabled'}>
        ${opt('', partner ? 'เลือกวันที่คุณหยุดและคู่สลับมีกะ' : 'เลือกคู่สลับก่อน', second || '')}
        ${secondDates.map(date => opt(date, `${dayLabel(date, y, m)} · ${getEmployeeFacingShiftLabel(state.apiAssign[partner.id][date].shift_code)}`, second)).join('')}
      </select></div>`);
  }
  if (!f.submitting) {
    const payload = pairs.length === (twoDates ? 2 : 1)
      ? { ...payloadFor(pairs[0]), ...(pairs[1] ? { secondSwap: payloadFor(pairs[1]) } : {}) } : null;
    const signature = JSON.stringify(payload);
    if (f.preview?.signature !== signature) f.preview = payload ? { signature, payload } : null;
  }
  const rows = pairs.flatMap(({ date, a, b }) => [
    { e: a, date: dayLabel(date, y, m), from: a.shift_code, to: b.shift_code },
    { e: b, date: dayLabel(date, y, m), from: b.shift_code, to: a.shift_code },
  ]);
  const note = noCrossDate ? `<div class="notice field">
      <b>เดือนนี้ไม่มีคู่สลับกะคนละวัน</b>
      <p>ในตารางที่เหลือ ยังไม่มีคู่ต่างทีมที่หยุดในวันที่คุณมีกะ และมีกะในวันที่คุณหยุด</p>
      <div><button class="btn sm" type="button" data-click="SF.rq('mode', 'one')">ดูตัวเลือกสลับกะวันเดียวกัน</button></div>
    </div>`
    : f.error ? `<p class="err" role="alert">${esc(f.error)}</p>`
    : !dates.length ? '<p class="notice">ยื่นได้เฉพาะกะที่มีในตารางส่วนกลางของเดือนนี้และยังไม่ผ่านวัน</p>'
      : '<p class="muted small">ตกลงกับคู่สลับก่อนส่ง ระบบจะหักสิทธิ์จากผู้ยื่นเมื่ออนุมัติครบ</p>';
  const coverage = pairs[1] ? `<p class="notice"><b>ใครทำกะแทนใคร</b><br>
    ${esc(dayLabel(first, y, m))} · ${esc(pairs[0].b.name)} รับ${esc(getEmployeeFacingShiftLabel(pairs[0].a.shift_code))}แทน ${esc(pairs[0].a.name)}<br>
    ${esc(dayLabel(second, y, m))} · ${esc(pairs[1].a.name)} รับ${esc(getEmployeeFacingShiftLabel(pairs[1].b.shift_code))}แทน ${esc(pairs[1].b.name)}
  </p>` : '';
  return {
    fields, rows, checks: renderRulePreview(f.preview, emp.name, partner?.shift.name, pairs.map(({ date }) => date)),
    ready: !f.submitting && f.preview?.result?.valid === true,
    note: note + coverage, submit: 'submitCentralSwap()',
    approvers: noCrossDate ? [] : state.actor.role === 'SUPERVISOR' ? ['ผู้จัดการ'] : ['หัวหน้ากะทั้งสองทีม (กดได้ทั้งสองลำดับ)'],
  };
}

export async function validateCentralSwapPreview(f, render) {
  const preview = f.preview;
  if (!preview || preview.loading || preview.result || preview.error || f.submitting) return;
  preview.loading = true;
  const isCurrent = () => view.rq === f && f.preview === preview && $('#centralSwapChecks');
  try {
    const result = await api('/swap/validate', { method: 'POST', body: preview.payload });
    if (isCurrent()) preview.result = result;
  } catch (error) {
    if (!isCurrent()) return;
    preview.error = error.message || 'ตรวจเงื่อนไขคำขอไม่สำเร็จ';
    if (error.code === 'SCHEDULE_CHANGED') await reloadMonths([monthKey(state.currentYear, state.currentMonth)]);
  } finally {
    preview.loading = false;
    if (isCurrent()) render();
  }
}

export async function submitCentralSwap(render) {
  const f = view.rq;
  if (!state.actor?.centralSwap || f?.k !== 'swap' || f.submitting || !currentEmp() || f.preview?.result?.valid !== true) return;
  // Send the versions shown in the preview even if background polling refreshed the roster.
  const { payload: body, signature } = f.preview;
  const viewedMonth = monthKey(state.currentYear, state.currentMonth);
  if (f.submission?.signature !== signature) f.submission = { signature, key: crypto.randomUUID() };
  Object.assign(f, { submitting: true, error: '' });
  render();
  try {
    await api('/requests', { method: 'POST', body, key: f.submission.key });
    await refreshAll();
    if (view.rq === f && $('#centralSwapMode')) done('ส่งคำขอสลับกะแล้ว');
    else showToast('ส่งคำขอสลับกะแล้ว');
  } catch (error) {
    f.error = error.message || 'ส่งคำขอไม่สำเร็จ';
    if (error.details?.validation) {
      f.preview.result = { ...f.preview.result, ...error.details.validation };
    }
    if (error.code === 'SCHEDULE_CHANGED') await reloadMonths([viewedMonth]);
    if (view.rq === f && $('#centralSwapMode')) showToast(f.error, 'alert');
  } finally {
    f.submitting = false;
    if (view.rq === f && $('#centralSwapMode')) render();
  }
}
