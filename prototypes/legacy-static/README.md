# Legacy static prototype

เก็บต้นแบบเดิมของโปรเจคก่อนทำ Alpha Demo ที่ใช้ PostgreSQL ย้ายจาก `shift/` วันที่ 6 ตุลาคม 2026 โดยคงเนื้อหาไฟล์แอปทั้งหมด ไม่ใช้เป็น entry point ของแอปปัจจุบัน

- `index.html`, `app.js`, `app.css` — หน้าจอและพฤติกรรมเดิม
- `.vscode/settings.json` — ค่า Live Server ของต้นแบบเดิม
- `docs/ui-design-spec.md` — เอกสารเดิมจาก `.docs/02-design/prototype/index.md`
- `reviews/2026-09-22-shift-app-critique.md` — รายงานตรวจเดิมจาก `.impeccable/critique/`

เปิด `index.html` หรือใช้ Live Server จากโฟลเดอร์นี้สำหรับดูต้นแบบ ข้อมูลและการจำลองในต้นแบบไม่ได้บันทึกผ่าน Backend ปัจจุบัน ไฟล์เดิมอาจมีข้อมูลตัวอย่างที่ยังไม่ได้ยืนยัน จึงไม่ใช้เป็น seed หรือข้อมูลพนักงานจริง

เอกสารและรายงานเก่าเก็บชื่อ ShiftFlow และ path `shift/` ตามเวลาที่จัดทำ เพื่อรักษาหลักฐานเดิม ปัจจุบันชื่อผลิตภัณฑ์คือ **Shift schedule TNC** และแอปที่ใช้เดโมจริงอยู่ `apps/api/` กับ `apps/web/`
