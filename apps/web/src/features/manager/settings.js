/* ==========================================================================
   ผู้จัดการ: ตั้งค่าระบบ (เวลากะ จำนวนคนมาตรฐาน สิทธิ์สลับกะต่อเดือน วันทำงานต่อเนื่องสูงสุด)
   โควตาสลับกะส่วนกลางใช้ API ส่วนค่าทดลองเดิมเก็บในเบราว์เซอร์
   ========================================================================== */

import { api } from '../../api/client.js';
import { addLog } from '../../app/data.js';
import { saveLocal, state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { getHolidaysForYear } from '../../shared/scheduling/annual.js';
import { monthLabel } from '../../shared/scheduling/dates.js';
import { showToast } from '../../shared/toast.js';
import { pageHead } from '../../shared/ui.js';
import { changed, rerender } from './refresh.js';
import { notify } from '../notifications/store.js';

const quotaPath = '/settings/swap-quota';
const maxQuota = 2_147_483_647;
let quotaForm;

function getQuotaForm() {
  if (quotaForm?.actor !== state.actor) {
    quotaForm = { actor: state.actor, settings: null, busy: '', draft: null, error: '', notice: '' };
  }
  return quotaForm;
}

function canUseQuotaSettings() {
  return state.actor?.role === 'MANAGER' && state.activeView === 'manager-settings';
}

function renderQuotaForm(form) {
  if (canUseQuotaSettings() && state.actor === form.actor) rerender();
}

function quotaMonthLabel(iso) {
  const [year, month] = iso.split('-').map(Number);
  return monthLabel(year, month - 1);
}

async function readQuotaSettings(form) {
  form.settings = null;
  try {
    form.settings = await api(quotaPath);
  } catch (error) {
    form.error = error.message || 'โหลดโควตาส่วนกลางไม่สำเร็จ';
  }
}

export async function loadSwapQuota() {
  if (!canUseQuotaSettings()) return;
  const form = getQuotaForm();
  if (form.busy) {
    renderQuotaForm(form);
    return;
  }
  form.busy = 'loading';
  form.error = '';
  renderQuotaForm(form);
  await readQuotaSettings(form);
  form.busy = '';
  renderQuotaForm(form);
}

export function updateSwapQuotaDraft(value) {
  if (!canUseQuotaSettings()) return;
  const form = getQuotaForm();
  if (!form.busy) form.draft = value;
}

export async function saveSwapQuota() {
  if (!canUseQuotaSettings()) return;
  const form = getQuotaForm();
  if (!form.settings || form.busy) return;
  const monthlyLimit = Number(form.draft ?? form.settings.nextLimit);
  form.error = '';
  form.notice = '';
  if (!Number.isInteger(monthlyLimit) || monthlyLimit < 1 || monthlyLimit > maxQuota) {
    form.error = 'กรุณาระบุจำนวนเต็มตั้งแต่ 1 ถึง 2,147,483,647';
    renderQuotaForm(form);
    return;
  }
  const { nextMonth: expectedEffectiveMonth, nextRevision: expectedRevision } = form.settings;
  form.busy = 'saving';
  renderQuotaForm(form);
  try {
    form.settings = await api(quotaPath, { method: 'PUT', body: { monthlyLimit, expectedEffectiveMonth, expectedRevision } });
    form.draft = null;
    form.notice = `บันทึกโควตาสำหรับเดือน${quotaMonthLabel(form.settings.nextMonth)}แล้ว`;
  } catch (error) {
    if (error.code === 'QUOTA_EFFECTIVE_MONTH_CHANGED') {
      form.notice = 'เปลี่ยนรอบเดือนแล้ว โปรดตรวจเดือนที่มีผลและกดบันทึกอีกครั้ง';
      await readQuotaSettings(form);
    } else if (error.code === 'QUOTA_SETTINGS_CHANGED') {
      form.notice = 'โควตาถูกแก้ไขแล้ว โปรดตรวจค่าล่าสุดก่อนบันทึกอีกครั้ง';
      await readQuotaSettings(form);
    } else {
      form.error = error.message || 'บันทึกโควตาส่วนกลางไม่สำเร็จ';
    }
  } finally {
    form.busy = '';
    renderQuotaForm(form);
  }
}

function swapQuotaHtml() {
  const form = getQuotaForm();
  const { settings, busy, draft, error, notice } = form;
  const feedback = `${error ? `<p class="err small" role="alert">${esc(error)}</p>` : ''}
    ${notice ? `<p class="muted small" role="status">${esc(notice)}</p>` : ''}`;
  return `<section class="panel" aria-busy="${Boolean(busy)}">
    <div class="panel-h"><h2>โควตาสลับกะส่วนกลาง</h2></div>
    <p class="muted small">กำหนดจำนวนครั้งต่อคนสำหรับทุกทีม ค่าที่บันทึกจะเริ่มใช้เดือนถัดไป
      ${state.actor?.swapPolicy ? 'ระบบหัก 1 สิทธิ์จากผู้ยื่นเมื่ออนุมัติครบ' : 'สภาพแวดล้อมนี้ยังไม่ได้ใช้โควตากลางตอนอนุมัติคำขอ'}</p>
    ${feedback}
    ${!settings ? (busy ? '<p class="muted small" role="status">กำลังโหลดโควตา…</p>' :
      '<button type="button" class="btn sm" data-click="loadSwapQuota()">โหลดโควตาอีกครั้ง</button>') : `
      <ul class="rows">
        <li><span>เดือนนี้ · ${esc(quotaMonthLabel(settings.currentMonth))}</span><b>${esc(settings.currentLimit)} ครั้ง/คน</b></li>
        <li><span>เดือนถัดไป · ${esc(quotaMonthLabel(settings.nextMonth))}</span><b>${esc(settings.nextLimit)} ครั้ง/คน</b></li>
      </ul>
      <form class="fields" data-submit="saveSwapQuota()">
        <div class="field">
          <label for="set-central-swap">จำนวนครั้งต่อคนสำหรับเดือนถัดไป</label>
          <span class="numfield">
            <input class="inp" id="set-central-swap" type="number" required min="1" max="${maxQuota}" step="1"
              value="${esc(draft ?? settings.nextLimit)}" data-input="updateSwapQuotaDraft(this.value)" ${busy ? 'disabled' : ''}>
            <button type="submit" class="btn sm" ${busy ? 'disabled' : ''}>${busy === 'saving' ? 'กำลังบันทึก…' : 'บันทึกสำหรับเดือนถัดไป'}</button>
          </span>
        </div>
      </form>
      ${error ? '<button type="button" class="btn sm" data-click="loadSwapQuota()">โหลดค่าล่าสุด</button>' : ''}
    `}
  </section>`;
}

/* ==========================================================================
   ตั้งค่าระบบ — บันทึกทันทีเมื่อเปลี่ยนค่า
   ========================================================================== */
export function settingsHtml() {
  if (state.actor?.remotePilot) return `${pageHead('โควตาสลับกะ')}${swapQuotaHtml()}`;
  const cfg = state.managerConfig;
  const hol = getHolidaysForYear(state.currentYear);
  return `
    ${pageHead('ตั้งค่าระบบ')}
    <div class="cols2">
      <section class="panel">
        <div class="panel-h"><h2>ช่วงเวลากะ</h2><span class="muted small">บันทึกทันทีเมื่อแก้ไข</span></div>
        <div class="fields">
          ${Object.keys(cfg.shiftTimes).map(code => `
            <div class="field"><label for="set-${code}">${esc(code)} · ${esc((state.shiftDefs[code] || {}).label || '')}</label>
              <input class="inp" id="set-${code}" value="${esc(cfg.shiftTimes[code])}" data-change="updateManagerShiftTime(${js(code)}, this.value)"></div>`).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-h"><h2>กฎการทำงานและคำขอ</h2></div>
        <ul class="rows">
          <li><span class="rows-l"><b>วันทำงานติดต่อกันสูงสุด</b><span class="muted small">นับรวมกะปกติ, OT และการสลับกะ</span></span>
            <span class="numfield"><input class="inp" id="set-max" type="number" value="${cfg.maxConsecutiveWorkDays}" data-change="updateManagerRule('maxConsecutiveWorkDays', this.value)"> วัน</span></li>
          <li><span class="rows-l"><b>คำขอสลับ/เปลี่ยนกะต่อเดือน (เดโม่)</b><span class="muted small">ใช้เฉพาะคำขอทดลองในเบราว์เซอร์นี้</span></span>
            <span class="numfield"><input class="inp" id="set-swap" type="number" value="${cfg.swapRequestMonthlyLimit}" data-change="updateManagerRule('swapRequestMonthlyLimit', this.value)"> ครั้ง</span></li>
        </ul>
      </section>
      ${swapQuotaHtml()}
    </div>
    <section class="panel">
      <div class="panel-h"><h2>ข้อมูลและทางลัด</h2></div>
      <ul class="rows">
        <li><span class="rows-l"><b>โครงสร้างตำแหน่งในแต่ละกะ (${cfg.standardHeadcount.supervisor + cfg.standardHeadcount.operator} ตำแหน่งต่อกะ)</b><span class="muted small">หัวหน้ากะ (Shift Supervisor - S) ${cfg.standardHeadcount.supervisor} ตำแหน่ง · พนักงานกะ (Shift Operator) ${cfg.standardHeadcount.operator} ตำแหน่ง (Boardman ดูแลระบบ DCS / Field Operator ดูแลเครื่องจักร)</span></span></li>
        <li><span class="rows-l"><b>วันหยุดนักขัตฤกษ์ · ปี ${state.currentYear}</b><span class="muted small">${hol.length ? `ตั้งค่าไว้ ${hol.length} วัน` : 'ยังไม่มีวันที่ตั้งค่าไว้'}</span></span><button class="btn sm" data-click="switchView('annual-schedule')">จัดการตารางรายปี</button></li>
        <li><span class="rows-l"><b>พนักงานและทีม</b><span class="muted small">จัดการรายชื่อและทีมกะ</span></span><button class="btn sm" data-click="switchView('people')">เปิดหน้าจัดการ</button></li>
      </ul>
    </section>`;
}
export function updateManagerShiftTime(code, value) {
  if (state.actor?.remotePilot) return;
  state.managerConfig.shiftTimes[code] = value;
  addLog(`แก้ไขช่วงเวลากะ ${code} เป็น ${value}`);
  notify('all', `เปลี่ยนเวลากะ ${code}`, `เวลาใหม่: ${value}`);
  showToast(`อัปเดตช่วงเวลากะ ${code} เรียบร้อยแล้ว`);
  saveLocal();
}
export function updateManagerRule(key, rawValue) {
  if (state.actor?.remotePilot) return;
  const value = parseInt(rawValue, 10);
  if (Number.isNaN(value) || value <= 0) { showToast('กรุณาระบุตัวเลขที่มากกว่า 0', 'alert'); rerender(); return; }
  state.managerConfig[key] = value;
  const what = key === 'maxConsecutiveWorkDays' ? 'วันทำงานติดต่อกันสูงสุด' : 'คำขอสลับ/เปลี่ยนกะต่อเดือน';
  addLog(`แก้ไขค่า${what} เป็น ${value}`);
  notify('all', 'เปลี่ยนกฎการยื่นคำขอ', `${what}: ${value}`);
  showToast('บันทึกค่าคอนฟิกเรียบร้อยแล้ว');
  changed();
}
