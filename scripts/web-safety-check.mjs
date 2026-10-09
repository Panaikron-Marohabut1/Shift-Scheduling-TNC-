// ตรวจความปลอดภัยของโค้ดหน้าเว็บ (apps/web) — รันด้วย: node scripts/web-safety-check.mjs
// กฎ (ดูคำอธิบายใน apps/web/README.md หัวข้อ "กฎความปลอดภัย"):
//  1. ใส่ HTML ลงหน้าเว็บ (innerHTML) ได้เฉพาะไฟล์ที่กำหนด ห้ามใช้ outerHTML / insertAdjacentHTML / document.write
//  2. ห้าม eval, new Function, setTimeout/setInterval แบบข้อความ
//  3. ห้าม onclick="..." / style="..." / javascript: ในหน้าเว็บ (ระบบหลังบ้านตั้ง CSP ไว้ ใช้ไม่ได้อยู่แล้ว)
//  4. ค่าในคำสั่งของปุ่ม data-click="..." ต้องผ่าน js() หรือเป็นตัวเลข
//  5. ข้อความจากผู้ใช้/ฐานข้อมูล (ชื่อ เหตุผล เบอร์โทร ฯลฯ) ที่ใส่ใน HTML ต้องผ่าน esc()
//  6. ห้ามโหลดไฟล์จากเว็บไซต์ภายนอก
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, 'apps/web');
const files = [];
const walk = dir => readdirSync(dir).forEach(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) { if (name !== 'fonts' && name !== 'assets') walk(p); } else if (/\.(js|html)$/.test(name)) files.push(p);
});
walk(web);

// ไฟล์ที่อนุญาตให้ใส่ HTML ลงหน้าเว็บ (ทุกไฟล์อื่นต้องสร้าง HTML ผ่านฟังก์ชันที่คืนข้อความ แล้วส่งให้ไฟล์เหล่านี้)
const HTML_SINKS = new Set(['src/app/render.js', 'src/app/main.js', 'src/shared/modal.js', 'src/shared/toast.js']);
// ฟังก์ชันที่ escape ให้แล้ว หรือคืน HTML ที่ปลอดภัย
const SAFE_CALL = /^(sel|esc|js|icon|swatch|codeLabel|opt|telOf|cellText|checksList|statusChips|monthNav|pageHead|kindButtons|changesTable|approversList|dateField|reasonField|retroField|toastIcon)\(/;
// ชื่อข้อมูลที่มาจากผู้ใช้หรือฐานข้อมูล
const DATA_FIELD = /\.(name|reason|person|targetPerson|targetRole|note|phone|message|msg|rejectReason|position|title|submittedAt|date|detail|actor|text|label|hint|rule)\b/;
// ตัวแปรตัวเลขที่ใส่ในคำสั่งของปุ่มได้โดยไม่ต้องผ่าน js()
const NUMERIC = /^[\w.]*?(\b(d|d0|day|y|m|i|mi|n|k|x|year|month|index|delta|dayNum)|getFullYear\(\)|getMonth\(\)|getDate\(\))(\s*[-+]\s*\d+)?(\s*\|\|\s*0)?$|^-?\d+$/;

const problems = [];
const report = (file, text, at, msg) => problems.push(`${relative(root, file)}:${text.slice(0, at).split('\n').length}  ${msg}`);

// หา ${...} ในเทมเพลต พร้อมข้อความ 200 ตัวอักษรก่อนหน้า (เพื่อดูว่าอยู่ใน attribute ไหน)
function interpolations(text) {
  const out = [];
  for (let i = text.indexOf('${'); i !== -1; i = text.indexOf('${', i + 2)) {
    let depth = 1, j = i + 2;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    out.push({ at: i, expr: text.slice(i + 2, j - 1).trim(), before: text.slice(Math.max(0, i - 200), i) });
  }
  return out;
}

// แทนเทมเพลต `...` (รวมที่ซ้อนกัน) ด้วย '' — ใช้ตรวจเฉพาะส่วนที่เป็นโค้ดของนิพจน์
function stripTemplates(src) {
  let out = '', i = 0;
  const skipTemplate = start => { // คืนตำแหน่งหลัง ` ปิด
    let j = start + 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '$' && src[j + 1] === '{') {
        let depth = 1; j += 2;
        while (j < src.length && depth) {
          if (src[j] === '`') { j = skipTemplate(j); continue; }
          if (src[j] === '{') depth++; else if (src[j] === '}') depth--;
          j++;
        }
        continue;
      }
      j++;
    }
    return j + 1;
  };
  while (i < src.length) {
    if (src[i] === '`') { out += "''"; i = skipTemplate(i); } else out += src[i++];
  }
  return out;
}

for (const file of files) {
  const rel = relative(web, file).replace(/\\/g, '/');
  const text = readFileSync(file, 'utf8');
  const code = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

  for (const m of code.matchAll(/\.innerHTML\s*=(?!=)/g)) if (!HTML_SINKS.has(rel)) report(file, code, m.index, 'ใส่ HTML ด้วย innerHTML นอกไฟล์ที่อนุญาต — ให้คืนข้อความ HTML แล้วให้ renderApp()/openModal() เป็นคนใส่');
  for (const m of code.matchAll(/\b(outerHTML|insertAdjacentHTML|document\.write)\b/g)) report(file, code, m.index, `ห้ามใช้ ${m[1]}`);
  for (const m of code.matchAll(/\beval\s*\(|\bnew\s+Function\b|\bset(Timeout|Interval)\s*\(\s*['"`]/g)) report(file, code, m.index, 'ห้ามรันโค้ดจากข้อความ (eval / new Function / setTimeout แบบข้อความ)');
  for (const m of code.matchAll(/\son[a-z]+=["']/g)) report(file, code, m.index, 'ห้ามใช้ onclick="..." — ใช้ data-click="ชื่อคำสั่ง(...)" แทน');
  for (const m of code.matchAll(/\sstyle=["']/g)) report(file, code, m.index, 'ห้ามใช้ style="..." — เพิ่มคลาสใน styles/*.css แทน');
  for (const m of code.matchAll(/javascript:/gi)) report(file, code, m.index, 'ห้ามใช้ลิงก์ javascript:');
  for (const m of code.matchAll(/(src|href)\s*=\s*["']?https?:\/\//g)) report(file, code, m.index, 'ห้ามโหลดไฟล์จากเว็บไซต์ภายนอก');

  if (!file.endsWith('.js')) continue;
  for (const { at, expr, before } of interpolations(code)) {
    // อยู่ในคำสั่งของปุ่ม data-click="ชื่อ(...)" หรือไม่
    const attr = /data-(click|change|input|keyup|submit)="[^"]*$/.exec(before);
    if (attr) {
      if (!/^js\(/.test(expr) && !NUMERIC.test(expr) && !/^(submit)$/.test(expr)) report(file, code, at, `ค่าในคำสั่งของปุ่มต้องผ่าน js(): \${${expr}}`);
      continue;
    }
    if (SAFE_CALL.test(expr)) continue;
    if (/^[`'"]/.test(expr)) continue; // ข้อความคงที่
    // นิพจน์ที่มีชื่อข้อมูลจากผู้ใช้/ฐานข้อมูล ต้องอยู่ใน esc(...)
    // เทมเพลตซ้อนข้างในถูกตรวจแยกอยู่แล้ว จึงตัดออก แล้วตัดส่วนที่อยู่ใน esc()/js() ฯลฯ
    let bare = stripTemplates(expr);
    bare = bare.replace(/\b(esc|js|telOf|opt|swatch|codeLabel|sel)\((?:[^()]|\([^()]*\))*\)/g, '');
    // ใช้เป็นเงื่อนไข (x ? ... : ...) หรือเปรียบเทียบ ไม่ได้แสดงค่า
    bare = bare.replace(/^[^?]*\?/, '').replace(/[\w.]+\s*(===|!==|==|!=)\s*[^\s)&|]+/g, '');
    if (DATA_FIELD.test(bare) && !/\.(length|map|filter|join|some|every|includes|startsWith)\b/.test(bare.replace(DATA_FIELD, ''))) {
      const segment = before.slice(before.lastIndexOf('`') + 1);
      const inHtml = /<\/?[a-z][^>]*>?/i.test(segment);
      if (inHtml) report(file, code, at, `ข้อมูลจากผู้ใช้/ฐานข้อมูลต้องผ่าน esc(): \${${expr}}`);
    }
  }
}

if (problems.length) {
  console.error(`พบ ${problems.length} จุดที่ต้องแก้ด้านความปลอดภัยของหน้าเว็บ:\n` + problems.map(p => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`ตรวจความปลอดภัยหน้าเว็บผ่าน (${files.length} ไฟล์)`);
