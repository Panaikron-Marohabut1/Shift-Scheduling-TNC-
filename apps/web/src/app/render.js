/* ==========================================================================
   วาดหน้าจอใหม่ทั้งหน้า (คงตำแหน่งเคอร์เซอร์และการเลื่อน) และโหลดตารางของปีที่กำลังดู
   ========================================================================== */

import { loadYear } from './data.js';
import { viewHtml } from './routes.js';
import { navBadges, shellHtml } from './shell.js';
import { saveLocal, state, view } from './state.js';
import { $ } from '../shared/dom.js';
import { translateTree } from '../shared/translate.js';
import { loginHtml } from '../features/session/view.js';

let appReady = false;
export function markReady() { appReady = true; }

// คงเคอร์เซอร์และตำแหน่งเลื่อนไว้เมื่อวาดหน้าจอใหม่ (เช่น พิมพ์ในช่องค้นหา)
function capture() {
  const a = document.activeElement;
  const scroll = {};
  document.querySelectorAll('[data-scroll]').forEach(el => { scroll[el.dataset.scroll] = [el.scrollLeft, el.scrollTop]; });
  return { focus: a && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null, scroll };
}
function restore(k) {
  Object.keys(k.scroll).forEach(name => { const el = document.querySelector(`[data-scroll="${name}"]`); if (el) { el.scrollLeft = k.scroll[name][0]; el.scrollTop = k.scroll[name][1]; } });
  if (k.focus) {
    const el = document.getElementById(k.focus.id);
    if (el && el.closest('#app')) { el.focus({ preventScroll: true }); try { if (k.focus.s != null) el.setSelectionRange(k.focus.s, k.focus.e); } catch { /* ช่องที่ไม่รองรับ */ } }
  }
}

// โหลดตารางของปีที่กำลังดูถ้ายังไม่มี แล้ววาดใหม่
export const pendingYears = {};
function ensureYears() {
  if (state.actor && state.actor.role === 'EXTERNAL') return; // ผู้ใช้ภายนอกไม่โหลดตารางพนักงาน
  [state.currentYear, state.annualScheduleYear].forEach(y => {
    if (pendingYears[y] !== undefined) return;
    pendingYears[y] = loadYear(y).then(() => { if (view.signed) renderApp(); }).catch(() => { delete pendingYears[y]; });
  });
}

export function renderApp() {
  const app = $('#app');
  if (!app || !appReady) return;
  if (!view.signed) { app.innerHTML = loginHtml(); return; }
  if (view.loading) { app.innerHTML = '<p class="boot">กำลังโหลดข้อมูล…</p>'; return; }
  ensureYears();
  navBadges();
  const k = capture();
  app.innerHTML = shellHtml(viewHtml());
  translateTree(app);
  restore(k);
  saveLocal();
}
