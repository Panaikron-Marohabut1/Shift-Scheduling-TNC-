/* ==========================================================================
   วันที่และชื่อเดือนภาษาไทย (พ.ศ.) และการอ่านวันที่ภาษาไทยกลับเป็นวันที่
   ========================================================================== */

export const TH_DW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
export const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
export function thaiMonthName(monthIndex, style = 'long') { return new Date(2000, monthIndex, 1).toLocaleDateString('th-TH', { month: style }); }
export const pad2 = n => String(n).padStart(2, '0');
export const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
export const shortDate = (y, m, d) => `${TH_DW[new Date(y, m, d).getDay()]}. ${d} ${thaiMonthName(m, 'short')}`;
export const monthKey = (y, m) => `${y}-${m}`;
const MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// อ่าน "14 สิงหาคม 2569", "16 → 18 สิงหาคม 2569", "12 ส.ค. 2569 (วันแม่)", "13–15 เม.ย. 2569"
export function parseThaiDate(text) {
  const s = String(text || '');
  let m = -1, at = -1;
  MONTH_LONG.forEach((name, i) => { const p = s.indexOf(name); if (p >= 0 && (at < 0 || p < at)) { m = i; at = p; } });
  if (m < 0) MONTH_SHORT.forEach((name, i) => { const p = s.indexOf(name); if (p >= 0 && (at < 0 || p < at)) { m = i; at = p; } });
  if (m < 0) return null;
  const yearMatch = /(\d{4})/.exec(s.slice(at));
  if (!yearMatch) return null;
  let y = Number(yearMatch[1]);
  if (y > 2400) y -= 543;
  const head = s.slice(0, at);
  const range = /(\d{1,2})\s*[–-]\s*(\d{1,2})\s*$/.exec(head.trim());
  let days = [];
  if (range) { for (let d = Number(range[1]); d <= Number(range[2]); d++) days.push(d); } else days = (head.match(/\d{1,2}/g) || []).map(Number);
  return { y, m, days };
}
