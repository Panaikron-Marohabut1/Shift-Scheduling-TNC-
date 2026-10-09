/* ==========================================================================
   การกดปุ่ม (แทน onclick="...")
   --------------------------------------------------------------------------
   ระบบหลังบ้านตั้ง Content-Security-Policy ไม่ให้ใช้ onclick="..." ในหน้าเว็บ
   หน้าจอจึงเขียนปุ่มเป็น data-click="ชื่อคำสั่ง(ค่า)" แล้วไฟล์นี้เรียกคำสั่งจาก registry
   ที่ลงทะเบียนไว้ (ไม่มีการ eval โค้ด) — รองรับ data-click / data-change / data-input /
   data-keyup / data-submit และค่าพิเศษ this.value, this.checked, event
   ========================================================================== */

import { closeModal } from './modal.js';

/* ---------- การกดปุ่ม (แทน onclick="...") ---------- */
const registry = {};
export function register(actions) { Object.assign(registry, actions); }

// แยกค่าในวงเล็บ: "ข้อความ", 'ข้อความ', ตัวเลข, true/false/null, this.value, this.checked, event
function parseArgs(text, el, ev) {
  const out = [];
  let i = 0;
  const s = text.trim();
  while (i < s.length) {
    while (s[i] === ' ' || s[i] === ',') i++;
    if (i >= s.length) break;
    const c = s[i];
    if (c === '"' || c === "'") {
      let j = i + 1, buf = '';
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') { buf += s[j] + s[j + 1]; j += 2; } else buf += s[j++]; }
      out.push(c === '"' ? JSON.parse(`"${buf}"`) : buf.replace(/\\'/g, "'"));
      i = j + 1;
    } else {
      let j = i;
      while (j < s.length && s[j] !== ',') j++;
      const tok = s.slice(i, j).trim();
      if (tok === 'this.value') out.push(el.value);
      else if (tok === 'this.checked') out.push(el.checked);
      else if (tok === 'event') out.push(ev);
      else if (tok === 'this') out.push(el);
      else if (tok === 'true' || tok === 'false') out.push(tok === 'true');
      else if (tok === 'null') out.push(null);
      else if (/^-?\d+(\.\d+)?$/.test(tok)) out.push(Number(tok));
      else out.push(tok);
      i = j;
    }
  }
  return out;
}
function run(expr, el, ev) {
  const m = /^\s*([\w.]+)\s*\(([\s\S]*)\)\s*;?\s*$/.exec(expr || '');
  if (!m) return;
  const fn = registry[m[1]];
  if (typeof fn !== 'function') { console.warn('ไม่พบคำสั่ง', m[1]); return; }
  fn(...parseArgs(m[2], el, ev));
}
function listen(type, attr) {
  document.addEventListener(type, ev => {
    const el = ev.target.closest && ev.target.closest(`[${attr}]`);
    if (!el || el.disabled) return;
    if (type === 'submit') ev.preventDefault();
    run(el.getAttribute(attr), el, ev);
  });
}
listen('click', 'data-click');
listen('change', 'data-change');
listen('input', 'data-input');
listen('keyup', 'data-keyup');
listen('submit', 'data-submit');
register({
  closeModal,
  overlayClose(ev) { if (ev && ev.target === ev.target.closest('.overlay')) closeModal(); },
  noop() {}
});
