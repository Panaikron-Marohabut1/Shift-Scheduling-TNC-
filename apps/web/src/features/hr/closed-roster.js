import { api } from '../../api/client.js';
import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { monthLabel } from '../../shared/scheduling/dates.js';
import { pageHead } from '../../shared/ui.js';

const endpoint = '/hr/closed-roster';
const models = new WeakMap();
const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/;

export function hasClosedRosterAccess(actor = state.actor) {
  return actor?.role === 'HR' && actor.hrClosedRoster === true;
}

function modelFor(actor) {
  if (!models.has(actor)) models.set(actor, { month: '', roster: null, loading: false, downloading: false, error: '', loadId: 0 });
  return models.get(actor);
}

function isCurrent(actor) {
  return state.actor === actor && state.activeView === 'hr-export';
}

export async function loadClosedRoster(render, month) {
  const actor = state.actor;
  if (!hasClosedRosterAccess(actor) || !isCurrent(actor)) return;
  const model = modelFor(actor);
  const selected = month ?? model.month;
  const loadId = ++model.loadId;
  model.month = selected;
  model.roster = null;
  model.loading = false;
  model.downloading = false;
  model.error = '';
  if (selected && !validMonth.test(selected)) {
    model.error = 'กรุณาเลือกเดือนและปีให้ถูกต้อง';
    render();
    return;
  }
  model.loading = true;
  render();
  try {
    const roster = await api(selected ? `${endpoint}?month=${encodeURIComponent(selected)}` : endpoint);
    if (model.loadId !== loadId) return;
    model.roster = roster;
    model.month = roster.month;
  } catch (error) {
    if (model.loadId === loadId) model.error = error.message || 'โหลดตารางกะไม่สำเร็จ';
  } finally {
    if (model.loadId === loadId) {
      model.loading = false;
      if (isCurrent(actor)) render();
    }
  }
}

export async function downloadClosedRoster(render) {
  const actor = state.actor;
  if (!hasClosedRosterAccess(actor) || !isCurrent(actor)) return;
  const model = modelFor(actor);
  const roster = model.roster;
  if (!roster || model.downloading) return;
  model.downloading = true;
  model.error = '';
  render();
  try {
    const blob = await api(`${endpoint}.csv?month=${encodeURIComponent(roster.month)}`, { method: 'POST', format: 'csv' });
    if (!isCurrent(actor) || model.roster !== roster) return;
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `TNC-Closed-Roster-${roster.month}.csv`;
    document.body.appendChild(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  } catch (error) {
    if (model.roster === roster) model.error = error.message || 'ขอไฟล์ CSV ไม่สำเร็จ';
  } finally {
    if (model.roster === roster) {
      model.downloading = false;
      if (isCurrent(actor)) render();
    }
  }
}

export function closedRosterHtml() {
  const { roster, month, loading, downloading, error } = modelFor(state.actor);
  const [year, monthNumber] = (roster?.month || '').split('-').map(Number);
  return `
    ${pageHead('ตารางกะเดือนที่ปิดแล้ว', roster ? `
      <button id="hr-closed-roster-download" class="btn primary" type="button" data-click="exportHrClosedRoster()" ${downloading ? 'disabled' : ''}>
        ${icon('export')} ${downloading ? 'กำลังขอไฟล์ CSV…' : 'ดาวน์โหลด CSV'}
      </button>` : '')}
    <section id="hr-closed-roster" class="panel" aria-busy="${loading || downloading}">
      <div class="bar">
        <label for="hr-closed-roster-month">เลือกเดือน</label>
        <input id="hr-closed-roster-month" class="inp" type="month" value="${esc(month)}" data-change="selectHrClosedRosterMonth(this.value)">
        <button class="btn sm" type="button" data-click="openLatestHrClosedRoster()" ${loading && !month ? 'disabled' : ''}>เปิดเดือนก่อนหน้า</button>
      </div>
      <p class="muted small">แสดงตารางที่ปิดเดือนและประกาศใช้แล้วจากฐานข้อมูลกลาง</p>
      ${error ? `<p class="err" role="alert">${esc(error)}</p>
        ${!roster ? '<button class="btn sm" type="button" data-click="refreshHrClosedRoster()">ลองอีกครั้ง</button>' : ''}` : ''}
      ${loading ? '<p class="muted" role="status">กำลังโหลดตารางกะ…</p>' : ''}
      ${roster ? `<p class="muted small">${esc(monthLabel(year, monthNumber - 1))} · เวอร์ชันตาราง ${esc(roster.scheduleVersion)} · ${esc(roster.rows.length)} รายการ</p>` : ''}
    </section>
    ${roster ? `
      <div class="panel flush tbl-wrap">
        <table id="hr-closed-roster-table" class="tbl" aria-label="ตารางกะเดือนที่ปิดแล้ว">
          <thead><tr><th scope="col">รหัสพนักงาน</th><th scope="col">ทีม</th><th scope="col">วันที่ตามตาราง</th><th scope="col">รหัสกะ</th></tr></thead>
          <tbody>${roster.rows.map(row => `<tr><td>${esc(row.employeeCode)}</td><td>${esc(row.team)}</td><td>${esc(row.workDate)}</td><td>${esc(row.shiftCode)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}`;
}
