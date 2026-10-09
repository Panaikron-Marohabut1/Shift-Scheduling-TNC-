/* ==========================================================================
   เครื่องมือหน้าจอ: สร้าง HTML, ไอคอน, หน้าต่างย่อย, ข้อความแจ้ง, แปลข้อความ และการกดปุ่ม
   --------------------------------------------------------------------------
   ระบบหลังบ้านตั้ง Content-Security-Policy ไม่ให้ใช้ onclick="..." ในหน้าเว็บ
   หน้าจอจึงเขียนปุ่มเป็น data-click="ชื่อคำสั่ง(ค่า)" แล้ว dispatcher ด้านล่างเรียกคำสั่งจาก
   registry ที่ลงทะเบียนไว้ (ไม่มีการ eval โค้ด) — รองรับ data-click / data-change / data-input /
   data-keyup / data-submit และค่าพิเศษ this.value, this.checked, event
   ========================================================================== */

export const $ = (sel, root) => (root || document).querySelector(sel);
export const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const js = v => esc(JSON.stringify(String(v))); // ค่าข้อความสำหรับใส่ในคำสั่งของปุ่ม

/* ---------- ไอคอน ---------- */
const ICON = {
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  schedule: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>',
  requests: '<path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 014 14.5z"/><path d="M8.5 9h7M8.5 12.5h4.5"/>',
  my: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8"/>',
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  summary: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.6a3 3 0 010 5.8M17.5 14.8c1.8.6 3 2.2 3.5 4.7"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  annual: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M7.5 13.5h9M7.5 17h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  driver: '<rect x="4" y="4" width="16" height="12" rx="2.5"/><path d="M4 10.5h16"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/>',
  export: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'
};
export const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.overview}</svg>`;
// ไอคอนในข้อความแจ้ง
const TOAST_ICON = {
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  alert: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
};
const toastIcon = name => `<svg class="icon-sm" viewBox="0 0 24 24">${TOAST_ICON[name] || TOAST_ICON.check}</svg>`;

/* ---------- แปลงข้อความที่แสดงเป็นภาษาไทย (ค่าข้างในคงเดิม) ---------- */
const TH_TEXT = [
  [/Shift Supervisor ([A-D]) \(/g, 'หัวหน้ากะ $1 ('],
  [/Shift Supervisor \(Shift ([A-D])\)/g, 'หัวหน้ากะ Shift $1'],
  [/Shift Employee \(Shift ([A-D])\)/g, 'พนักงานกะ Shift $1'],
  [/Shift Supervisor \(S\)/g, 'หัวหน้ากะ (S)'],
  [/\bShift Supervisors\b/g, 'หัวหน้ากะ'],
  [/\bShift Supervisor\b/g, 'หัวหน้ากะ'],
  [/\bShift Employee\b/g, 'พนักงานกะ'],
  [/\bShift Operators?\b/g, 'พนักงานกะ'],
  [/Manager \(ฝ่ายผลิต\)/g, 'ผู้จัดการฝ่ายผลิต'],
  [/\s*—?\s*External User/g, ' (ผู้ใช้ภายนอก)'],
  [/Multi-step Adjustment: /g, 'ปรับกะหลายขั้น: '],
  [/Adjustment \+ Sick Leave: /g, 'ปรับกะ + ลาป่วย: '],
  [/Adjustment: /g, 'ปรับกะ: '],
  [/Shift Swap: /g, 'สลับกะ: '],
  [/Leave \(Other, Half-day\)/g, 'ลาอื่น ๆ ครึ่งวัน'],
  [/Leave \(Other\)/g, 'ลาอื่น ๆ'],
  [/^Overtime$/g, 'ทำงานล่วงเวลา'],
  [/^Holiday$/g, 'วันหยุดนักขัตฤกษ์'],
  [/\s*\((Morning|Night|Off|Vacation|Sick Leave|Day|Published|Draft|Approval Queue|Shift Schedule|Schedule|Annual Schedule|Settings|Schedule Publishing|Read-only|HR Master Data|Export Center|Leave Records|OT Records|CSV Data Format[^)]*)\)/g, '']
];
function thText(t) { let out = t; TH_TEXT.forEach(([re, to]) => { out = out.replace(re, to); }); return out; }
export function translateTree(root) {
  if (!root || (root.closest && root.closest('.login'))) return;
  if (root.nodeType === 3) { const n = thText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; return; }
  if (root.nodeType !== 1 || root.matches('.login, script, style')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && n.parentElement.closest('.login') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => { const v = thText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  root.querySelectorAll('[title]').forEach(el => { const v = thText(el.title); if (v !== el.title) el.title = v; });
}
const translator = new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(translateTree)));
export function watchTranslate() {
  ['#app', '#modalRoot', '#toastRoot'].forEach(sel => { const el = $(sel); if (el) translator.observe(el, { childList: true, subtree: true }); });
}

/* ---------- หน้าต่างย่อย และข้อความแจ้ง ---------- */
export function openModal(title, bodyHtml, footerHtml) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="overlay" data-click="overlayClose(event)">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
        <header><h2 id="modalTitle">${title}</h2><button class="sq" data-click="closeModal()" aria-label="ปิด">${icon('x')}</button></header>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<footer>${footerHtml}</footer>` : ''}
      </div>
    </div>`;
  translateTree(root);
  const box = $('.modal', root);
  if (box) box.focus({ preventScroll: true });
}
export function closeModal() { const root = $('#modalRoot'); if (root) root.innerHTML = ''; }
export const modalOpen = () => !!($('#modalRoot') && $('#modalRoot').innerHTML);

export function showToast(message, kind = 'check') {
  const container = $('#toastRoot');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${toastIcon(kind)} <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

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
