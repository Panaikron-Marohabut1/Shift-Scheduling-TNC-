/* ==========================================================================
   แปลงข้อความภาษาอังกฤษบางคำในหน้าจอเป็นภาษาไทย (ค่าในข้อมูลคงเดิม)
   เปลี่ยนเฉพาะข้อความที่แสดง ไม่แตะ HTML
   ========================================================================== */

import { $ } from './dom.js';

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
