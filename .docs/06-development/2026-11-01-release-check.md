# ผลตรวจชุด Login และโครงสร้าง — 1 พฤศจิกายน 2026

## ขอบเขตส่งมอบ

ใช้ Logic ของเพื่อนจาก `origin/main` ที่ `e5962798f05ce974cf6ee917da618c9ab80f02f7` (PR #21) ตามเดิม เจ้าของยืนยันให้คงกฎตารางกะ การลา OT และการอนุมัติไว้ก่อน รอบนี้ปรับเฉพาะ Login การจัดโฟลเดอร์ เครื่องมือเปิดโปรเจกต์ และคู่มือที่เกี่ยวข้อง การส่งมอบนี้ไม่ใช่การรับรองว่าระบบพร้อมใช้งานจริง

- ย้าย `shift/Backend/` เป็น `apps/auth/` พร้อมหน้า Login ภาษาไทย ปุ่มแสดงรหัสผ่าน และสถานะกำลังเข้าสู่ระบบ
- คง Microsoft 365 และ email/password; การผูกบัญชีกับพนักงานอัตโนมัติปิดเป็นค่าเริ่มต้น การตั้งค่าโดเมนสำหรับ Demo ใช้เฉพาะ development
- เปิดทั้งระบบด้วย `pnpm dev`; ติดตั้ง API และ Auth ด้วย `pnpm deps`
- กำหนดพอร์ตและ OAuth callback ให้สอดคล้องกับ `AUTH_URL`; ค่าเริ่มต้นเว็บ/API 3000 และ Login 3001
- แก้การตรวจ CRLF บน Windows และตรวจ ZIP ของ PostgreSQL ก่อนแตกไฟล์
- ไม่เปลี่ยน migration ของฐานข้อมูลแอป ไม่ย้ายข้อมูลขึ้น cloud และไม่เปลี่ยน Role ของบัญชีใด

## หลัง Pull

1. ปิดบริการเดิมก่อนอัปเดต เก็บ `.env` ที่ root ไว้ตามเครื่องของตน
2. หากเคยรัน Auth ที่ตำแหน่งเก่า ให้คัดลอก `shift/Backend/.env.local` มา `apps/auth/.env.local` ไฟล์นี้ไม่ได้ตามมาจาก Git
3. ตั้ง root `PORT=3000`, `APP_ORIGIN=http://localhost:3000`, `AUTH_URL=http://localhost:3001` และ Auth `AUTH_HOST=http://localhost:3001`, `TRUSTED_APP_ORIGINS=http://localhost:3000`, `SHARE_AUTH_COOKIE=false` ใช้ hostname เดียวกันทั้งสองบริการ
4. คง Supabase URL และ publishable key ของโปรเจกต์ที่ตกลงใช้ สำหรับ Demo เพิ่ม `DEV_ALLOWED_EMAIL_DOMAINS=thainitrate.com,example.com` ตาม [คู่มือ Auth](../../apps/auth/README.md)
5. รัน `pnpm deps` แล้ว `pnpm dev` เครื่องใหม่ต้องทำ setup/migrate/seed ตาม [README](../../README.md) ก่อน; เครื่องเดิมไม่มี migration ใหม่จากชุดนี้และไม่ต้อง reset ข้อมูล
6. Microsoft Login ต้องตั้ง Supabase Redirect URLs ให้รองรับ callback ที่ใช้จริง เช่น `http://localhost:3001/**` สำหรับ development อย่าแก้ Site URL ส่วนกลางเพียงเพื่อให้ตรงเครื่องตนเอง
7. บัญชี Supabase กับ Role ในฐานข้อมูลแต่ละเครื่องเป็นคนละส่วน ใช้ `pnpm link-user` ตรวจบัญชีที่ผูกแล้ว บัญชีที่ยังไม่ผูกจะได้ `ACCOUNT_NOT_LINKED`; อย่าเปิด auto-link หรือกำหนด Role แทนผู้มีอำนาจโดยอัตโนมัติ

## ผลตรวจ

- API integration/unit tests: ผ่าน 32/32 ข้อ ใช้ฐานข้อมูลชั่วคราวแยกจากข้อมูลเดโม รวม session/Role, auto-link แบบ opt-in, ลำดับอนุมัติ, การแข่งขันของคำสั่ง, rollback, cancel และหลักฐาน audit
- `pnpm check`: ผ่าน API build, JavaScript syntax, Markdown, whitespace และ web safety 55 ไฟล์
- `pnpm audit:backlog`: PASS สำหรับ spec วันที่ 2026-09-02 และ backlog ปัจจุบัน ไม่ได้ตัดสินคำถามธุรกิจที่ยังค้าง
- Auth lint และ production build: ผ่านหลังอัปเดต Next.js และ eslint-config-next เป็น 16.4.3
- Login smoke test หลังแพตช์: ผ่าน desktop/mobile, ปุ่มแสดง/ซ่อนรหัสผ่าน, ปฏิเสธ redirect ภายนอก/โดเมนที่ไม่อนุญาต, session ที่ไม่ Login ตอบ 401 และ callback ไม่มี code กลับหน้าแจ้งข้อผิดพลาด ใช้พอร์ตแยกและไม่ใช้บัญชีจริง
- `pnpm test:browser`: ไม่ผ่าน โดยรอหน้า “เลือกบัญชีเพื่อเริ่มใช้งาน” ที่ถูกแทนด้วย Login แล้ว ชุดทดสอบนี้ยังไม่ยืนยัน workflow ปัจจุบัน และไม่ได้เปลี่ยนให้ผ่านโดยข้าม assertion
- Microsoft/MFA และ logout กับบัญชีจริงยังไม่ได้ตรวจแบบครบวงจรในรอบนี้

## ปัญหา Logic เดิมที่ยืนยันซ้ำและยังไม่แก้

ตรวจด้วยข้อมูลจำลองในหน่วยความจำ ไม่ได้แก้ตารางจริง ผลเหล่านี้เป็นพฤติกรรม frontend/local demo; API tests ที่ผ่านไม่ครอบคลุมเส้นทางนี้ทั้งหมด

| รหัส | กรณีที่ตรวจพบ |
| --- | --- |
| F01 | กรอบ ±7 วันใช้เลขวันที่เทียบกัน ทำให้ 31 ต.ค. → 1 พ.ย. ถูกมองว่าห่าง 30 วัน |
| F02 | แลกกะพร้อมวันคืนตรวจแต่ละวันแยกกัน ทั้งสองวันผ่าน แต่ผลรวมทำงานติดกัน 7 วันได้ |
| F03 | การนับวันทำงานต่อเนื่องฝั่งหน้าเว็บไม่รวมช่วงปลายเดือนก่อนหน้า |
| F04 | รหัสประกอบ `O/M` ถูกนับต่างจากวันหยุด `O` แม้กะที่มีผลเป็นวันหยุด |
| F05 | ยกเลิก OT เก่าหลังมีคำขอลาใหม่ที่อนุมัติแล้ว อาจคืนกะเดิมทับวันลาใหม่ |
| F06 | ยกเลิกเผยแพร่ตารางรายปีแล้ว การเตรียมข้อมูลตอนเปิดใหม่ทำให้กลับเป็นเผยแพร่ |
| F07 | ย้ายวันหยุดจากวันที่ 7 ไป 8 อาจทำให้วันที่ 1–7 เป็นวันทำงานต่อเนื่อง |
| F08 | ข้อความ OT ระหว่างลาพักร้อนระบุให้ Manager อนุมัติ แต่ลำดับจริงไม่มี Manager — ต้องให้เจ้าของยืนยันนโยบายก่อนแก้ |
| F09 | Reset testcases ล้างคำขอ แต่กะที่เปลี่ยนจากคำขออาจยังค้างอยู่ |

คำขอจากหน้าจอใหม่หลายประเภท รวมถึงแลกกะพร้อมวันคืน ยังบันทึกใน browser/localStorage ไม่ได้แชร์ข้อมูลครบผ่านฐานข้อมูลระหว่างเครื่อง ดู `apps/web/src/features/requests/types/swap.js` และ `apps/web/src/app/state.js` ห้ามตีความว่าคำขอทุกประเภทเก็บใน PostgreSQL แล้ว

## Dependencies และข้อจำกัดการเผยแพร่

การตรวจ production dependencies ก่อนแพตช์พบ Next.js 16.4.0 มี advisory ระดับ critical และ high จึงอัปเดตแพตช์เฉพาะแอป Auth โดยคง Logic ธุรกิจเดิม แหล่งอ้างอิง: [Next.js security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)

หลังอัปเดตเป็น 16.4.3: `npm --prefix apps/auth audit --omit=dev` ไม่พบรายการช่องโหว่ใน production dependencies ณ วันที่ตรวจ แต่ full audit ที่รวมเครื่องมือพัฒนายังรายงาน 17 รายการ (16 moderate, 1 high รวม `zod`) จึงไม่ถือว่า dependencies ทั้งหมดปลอดข้อค้นพบ และไม่ได้ใช้ `audit fix --force` เพื่อบังคับเปลี่ยนเวอร์ชันเครื่องมือ

ฝั่ง API ยังมีรายงาน `body-parser` 2.3.0 (high), `multer` 2.4.0 (high), `qs` 6.16.0 (moderate) จาก `pnpm audit --prod` ยังไม่อัปเดตในรอบ Login นี้ การพบแพ็กเกจในช่วงที่ได้รับผลกระทบไม่ใช่หลักฐานว่าได้ทดลองโจมตีเส้นทางนั้นสำเร็จ

ระบบชุดนี้ยังจำกัด localhost/ข้อมูล Demo ไม่ควรนำผล build หรือ API tests มาอ้างว่าแก้บัคธุรกิจทั้งหมดแล้ว รายการค้างข้างต้นต้องได้รับการจัดการแยกก่อนขยายไปใช้งานจริง

ไฟล์ `.env`, `.env.local`, ฐานข้อมูล `.local/`, dependencies และข้อมูล session ไม่รวมใน Commit
