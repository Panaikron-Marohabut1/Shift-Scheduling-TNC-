# ShiftFlow · Shift Scheduling TNC

ShiftFlow เป็นเว็บจัดตารางกะฝ่ายผลิตสำหรับทีม A–D ใช้ดูตารางกะ ส่งและอนุมัติคำขอ และตรวจสรุปชั่วโมงตามตาราง เวอร์ชันนี้ใช้ข้อมูลสมมติสำหรับการทดสอบ

- [เปิดเว็บ Demo บน Vercel](https://shiftflow-tnc.vercel.app)
- [คู่มือใช้ฐาน Supabase ร่วมกัน](.docs/06-development/2026-11-13-remote-swap-pilot.md)
- [กฎและ Checklist สำหรับ Manager](.docs/01-requirements/01-spec/2026-11-04-01-business-rules-master.md)

## เริ่มใช้งาน

ใช้ **Node.js 24** และ **pnpm 11.25.0** เปิด Terminal ที่โฟลเดอร์ที่มี `package.json` แล้วติดตั้ง dependencies ครั้งแรก หรือเมื่อ lockfile เปลี่ยน

```powershell
npm.cmd install --global pnpm@11.25.0
pnpm deps
```

ตั้งค่า `apps/auth/.env.local` ตาม [คู่มือ Auth](apps/auth/README.md) โดยใช้ Supabase URL, publishable key และ origin ที่ตรงกับสภาพแวดล้อม บัญชีต้องผ่าน Supabase Auth และมีสิทธิ์ในฐานข้อมูลของ ShiftFlow ด้วย ขอข้อมูลบัญชี Demo และค่าตั้งค่าฐานร่วมจากผู้ดูแลผ่านช่องทางส่วนตัว

### ใช้ข้อมูล Demo ชุดเดียวกับบนเว็บ

เตรียม `.env.supabase.local` ตาม [คู่มือฐาน Supabase ร่วม](.docs/06-development/2026-11-13-remote-swap-pilot.md) โดยใช้บัญชีฐานข้อมูล Backend ที่จำกัดสิทธิ์และ CA ที่คู่มือระบุ จากนั้นรัน

```powershell
pnpm dev:supabase
```

เปิด [ShiftFlow](http://localhost:3000) โดยปกติหน้า Login อยู่ที่ [localhost:3001](http://localhost:3001) และตรวจสถานะ API ได้ที่ [localhost:3000/api/health](http://localhost:3000/api/health) โหมดนี้ใช้ PostgreSQL บน Supabase ร่วมกับเว็บ Demo การยื่นคำขอและการเปลี่ยนตารางจึงมีผลกับผู้ทดสอบคนอื่นหลังโหลดข้อมูลใหม่ ฐานร่วมจัดเตรียมไว้แล้ว ให้ข้ามขั้นตอน migrate และ seed ในเครื่อง

ข้อมูล Demo ร่วม ณ วันที่ 18 พฤศจิกายน 2569 มีตารางประกาศใช้เดือนพฤศจิกายนและธันวาคมทีมละ **7 คน** ประกอบด้วยหัวหน้ากะ 1 คนและพนักงาน 6 คน พนักงานตัวอย่างรหัส A3–A6, B3–B6, C3–C6 และ D3–D6 อยู่ในรายชื่อและตารางกะโดยไม่มีบัญชีเข้าใช้งาน จำนวนนี้เป็นข้อมูลในฐานร่วม ส่วน seed สำหรับฐานในเครื่องมีชุดทดสอบของตัวเอง

### ใช้ PostgreSQL แยกในเครื่อง

บน Windows ใช้คำสั่งต่อไปนี้เพื่อเตรียมฐานใหม่ จากนั้นเปิดเว็บและ Login พร้อมกัน

```powershell
pnpm setup
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm setup` เตรียม PostgreSQL แบบพกพาที่ `127.0.0.1:54329` สร้าง `.env` เมื่อตั้งค่าครั้งแรก และเตรียมฟอนต์ของแอป หากมีฐานในเครื่องแล้ว ให้รัน `pnpm dev` ได้เลย หรือใช้ `pnpm db:migrate` เมื่อมี migration ใหม่ คำสั่งเปิดแอปไม่ migrate, seed หรือล้างข้อมูลอัตโนมัติ และใช้ Supabase Auth สำหรับเข้าสู่ระบบ

ผู้ดูแลฐาน Demo ในเครื่องใช้ `pnpm link-user` เพื่อดูรหัสผู้ใช้ แล้วผูกบัญชีที่เตรียมไว้ด้วย `pnpm link-user APP_USER_ID SUPABASE_AUTH_UID` หากต้องการชุดข้อมูลใหม่จริง ๆ `pnpm demo:fresh` จะสร้างฐานในเครื่องชุดใหม่ เก็บฐานเดิม และสำรอง `.env` ไว้ใน `.local/env-backups/`

ถ้า Windows แจ้ง `listen EACCES` ให้ตรวจพอร์ตที่สงวนไว้ด้วย `netsh interface ipv4 show excludedportrange protocol=tcp` เปลี่ยน `PORT`, `APP_ORIGIN` และ `AUTH_URL` ใน `.env` ให้ตรงกับ `AUTH_HOST` และ `TRUSTED_APP_ORIGINS` ในการตั้งค่า Auth หากใช้ Microsoft 365 ให้ตรวจ callback URL ใน Supabase ด้วย

## ฟีเจอร์ในโค้ดปัจจุบัน

| เรื่อง | การทำงานใน Demo |
| --- | --- |
| ตารางกะ | ดูกะของฉัน ตารางรวมรายวันและรายเดือน รอบทำงานต่อเนื่อง และผลจากคำขอที่อนุมัติแล้ว ตารางย้อนหลังที่ปิดเดือนอ่านได้ตามสิทธิ์ |
| สลับกะ | ตรวจคู่สลับ ตำแหน่ง กะซ้อน ระยะพัก และเพดานทำงานต่อเนื่อง 6 วัน ฝั่งพนักงานใช้เส้นทางอนุมัติจากหัวหน้ากะที่เกี่ยวข้อง ส่วนคำขอสลับของหัวหน้ากะส่งให้ Manager ระบบตรวจเงื่อนไขอีกครั้งก่อนเปลี่ยนตาราง |
| ลาและ OT | ยื่นและติดตามคำขอผ่านระบบกลาง กะเปลี่ยนหลังอนุมัติตามเส้นทางของคำขอ การยกเลิกตรวจตารางปัจจุบันก่อนคืนค่ากะเดิม |
| วันหยุดนักขัตฤกษ์ | ระบบจัด OT อัตโนมัติให้กะทำงานที่ตรงวันหยุด ถ้าเป็นวัน Off จะหากะทำงานถัดไปในเดือนเดียวกัน หรือย้อนหากะก่อนหน้าหากไม่มีวันถัดไป หนึ่งวันหยุดจัด OT ได้หนึ่งกะต่อคนและไม่ใช้กะซ้ำ พนักงานขอหยุดตรงวันหรือเลือกวันทดแทนภายในช่วง ±7 วันในเดือนเดียวกันได้ เมื่ออนุมัติระบบจึงเปลี่ยนกะและถอน OT ของสิทธิ์นั้น |
| สรุปเดือนและขาดงาน | สรุปชั่วโมงและจำนวนกะ แยกกะปกติ OT ปกติ OT นักขัตฤกษ์ ลา และขาดงาน กะดึกนับตามวันเริ่มกะ Manager บันทึกหรือยกเลิกขาดงานเต็มกะได้ทุกทีมในตารางประกาศใช้ที่ยังไม่ล็อก ระบบเก็บประวัติ 12 เดือน ดู [รายละเอียดสรุปและขาดงาน](.docs/06-development/2026-11-17-shift-summary-and-absence.md) |
| สิทธิ์และแจ้งเตือน | Manager ติดตามคำขอ จัดการทีมและโควตาตามสิทธิ์ HR อ่านและส่งออกตารางปิดเดือนเป็น CSV Admin Demo กำหนดบทบาทเริ่มต้นให้บัญชีที่เข้าเงื่อนไข สถานะอ่านแจ้งเตือนถูกบันทึกต่อบัญชีในฐานข้อมูล |

หน้าสรุปคำนวณจากตารางที่มีผลในระบบ ขอบเขตเชื่อมต่อระบบเงินเดือนและการใช้งานจริงในบริษัทให้ยึดตาม [ข้อกำหนดและกฎของโครงการ](.docs/01-requirements/rule.md) ส่วนงานฝั่งคนขับรถบางขั้นตอนยังเป็นต้นแบบที่เก็บข้อมูลในเบราว์เซอร์ ดู [รายละเอียด Frontend](apps/web/README.md)

ตัวเลือกวันหยุดทดแทนจะแสดงเฉพาะกะทำงานที่เข้าเงื่อนไข เส้นตายของคำขอใช้เวลาที่มาถึงก่อนระหว่าง 00:00 น. ของวันนักขัตฤกษ์ เวลาเริ่มกะที่เลือกหยุด และเวลาเริ่มกะ OT อัตโนมัติ โดยอิงเวลาไทย [กฎเวลาในโค้ด](apps/api/src/requests/holiday-request-policy.ts)

### ลองทดสอบสลับกะ

1. เข้าเป็นพนักงาน Demo แล้วเลือกคู่และวันที่จาก **ตารางกะ** ตรวจผลกฎและโควตาก่อนส่งคำขอ
2. เข้าเป็นหัวหน้ากะตามที่คำขอระบุ เปิด **คิวคำขอตรวจสอบ** และอนุมัติให้ครบตามเส้นทาง
3. กลับเข้าบัญชีพนักงาน ตรวจสถานะใน **คำขอของฉัน** และเทียบกะที่เปลี่ยนในปฏิทิน หากต้องเปิดหลายบัญชีพร้อมกัน ให้ใช้คนละโปรไฟล์ของเบราว์เซอร์

## โครงสร้างและการ Deploy

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| [apps/web](apps/web/) | หน้าเว็บ HTML, CSS และ Vanilla JavaScript |
| [apps/api](apps/api/) | NestJS และ TypeScript สำหรับ API, กฎธุรกิจ และ PostgreSQL |
| [apps/auth](apps/auth/) | Next.js และ Supabase Auth สำหรับเข้าสู่ระบบด้วยอีเมลและ Microsoft 365 |
| [apps/api/migrations](apps/api/migrations/) | การเปลี่ยน schema และกฎฝั่งฐานข้อมูล |
| [scripts](scripts/) | คำสั่งเริ่มบริการ เตรียมฐาน และทดสอบ |
| [.docs](.docs/) | ข้อกำหนด แบบออกแบบ คู่มือพัฒนา และผล UAT |

เว็บ Demo บน Vercel ใช้ branch `shiftflow-shift-management` และ [Dockerfile.vercel](Dockerfile.vercel) โดย [ตัวเริ่มบริการ](deploy/run-hosted.mjs) เปิด API กับ Auth ภายในและให้บริการผ่าน HTTPS origin เดียว ฐานข้อมูลและ Auth ใช้ Supabase ของ Demo ร่วม ส่วน `pnpm dev:supabase` เปิดบริการเดียวกันเพื่อทดสอบผ่าน localhost การตั้งค่าที่มีรหัสผ่านหรือกุญแจอยู่ในไฟล์เฉพาะเครื่องหรือ Environment Variables ของ Vercel

## ตรวจสอบก่อนส่งงาน

```powershell
pnpm check
pnpm db:start
pnpm test
pnpm audit:backlog
```

`pnpm check` build API และตรวจโค้ดหน้าเว็บกับไฟล์ที่เปลี่ยน `pnpm test` รันชุดทดสอบ API และกฎธุรกิจ โดยส่วนที่ต้องใช้ PostgreSQL ใช้ฐานทดสอบแยกในเครื่อง ส่วน `pnpm audit:backlog` ตรวจความสอดคล้องของ requirement และ backlog

สคริปต์ตรวจหน้าจอใน [scripts](scripts/) มีชุดที่รันแยกได้ เช่น `node scripts/calendar-month-rollover-browser-check.mjs`, `node scripts/month-summary-browser-check.mjs` และ `node scripts/logout-redirect-browser-check.mjs` คำสั่งเหล่านี้ต้องมี Playwright และ browser หากติดตั้งไว้นอก repository ให้ตั้ง `PLAYWRIGHT_PACKAGE` และ `BROWSER_EXECUTABLE` ชุด `pnpm test:browser` ยังรวมสคริปต์ที่อ้างหน้าเลือกบัญชี Demo รุ่นเก่า

อ่าน [คู่มือโครงสร้างโครงการ](.docs/06-development/project-structure.md), [แนวทางออกแบบ ShiftFlow](DESIGN.md), [ผล UAT](.docs/Test_plan/2026-11-03-uat-results.md) หรือ [บันทึก Alpha Demo](.docs/02-design/prototype/alpha-demo.md) สำหรับรายละเอียดและบริบทของแต่ละรุ่น
