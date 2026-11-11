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
        if (!crossDatePartners.has(date)) crossDatePartners.set(date, []);
        crossDatePartners.get(date).push({ id, shift: other[date], secondDates });
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
const payloadFor = ({ a, b }) => ({
  assignmentId: a.assignment_id, targetAssignmentId: b.assignment_id,
  assignmentVersion: a.version, targetVersion: b.version,
});

const checkPresentation = {
  PASS: { status: 'pass', statusText: 'ผ่าน' },
  FAIL: { status: 'fail', statusText: 'ไม่ผ่าน' },
  UNCONFIRMED: { status: 'pending', statusText: 'รอยืนยัน' },
};
const quotaMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' });

function renderRulePreview(preview) {
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
  const groups = new Map();
  for (const check of result.checks) {
    const presentation = checkPresentation[check.status];
    if (!presentation) continue;
    const day = check.workDate || '';
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push({ ...presentation, rule: check.label || '', msg: check.message });
  }
  const quota = result.quota;
  const quotaBlock = quota ? `<div class="swap-quota-summary" id="centralSwapQuota">
    <div><strong>โควตาสลับกะของคุณ เดือน${esc(quotaMonth.format(new Date(`${quota.month}T00:00:00+07:00`)))}</strong>
      <p>ใช้แล้ว ${esc(quota.used)} จาก ${esc(quota.limit)} ครั้ง</p></div>
    <strong>เหลือ ${esc(quota.remaining)} ครั้ง</strong>
    <p class="small">คำขอที่รออนุมัติยังไม่ใช้โควตา${quota.remaining === 0 ? ' ส่งคำขอได้ ระบบจะตรวจโควตาอีกครั้งตอนอนุมัติ' : ''}</p>
  </div>` : '';
  return `<section class="central-swap-checks" id="centralSwapChecks" aria-labelledby="centralSwapChecksTitle">
    <h3 id="centralSwapChecksTitle">ตรวจเงื่อนไขคำขอ</h3>
    <p class="small" role="status">${result.valid ? 'ผ่านเงื่อนไขที่ตรวจได้' : 'มีเงื่อนไขที่ยังไม่ผ่าน'}</p>
    ${quotaBlock}
    ${[...groups].map(([day, checks]) => {
      const [year, month, date] = day.split('-').map(Number);
      return checksList(day ? `วันที่ ${shortDate(year, month - 1, date)}` : 'เงื่อนไขของคำขอ', checks);
    }).join('')}
    ${result.valid ? '' : `<div>${retry}</div>`}
  </section>`;
}

export function centralSwapForm({ f, emp, y, m }) {
  const { dates, firstDates, first, partners, partner, secondDates, second, pairs } = choices(f, emp, y, m);
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
        ${partners.map(({ id, shift }) => opt(id, `${shift.name} · ทีม ${shift.team_code}`, f.partner)).join('')}
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
    fields, rows, checks: renderRulePreview(f.preview), ready: !f.submitting && f.preview?.result?.valid === true,
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
