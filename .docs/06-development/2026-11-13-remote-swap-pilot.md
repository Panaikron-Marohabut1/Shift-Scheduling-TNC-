# Milestone 5 — ทดสอบสลับกะร่วมกันผ่าน Supabase

ทีมใช้โค้ด ShiftFlow ชุดเดียวกันจาก GitHub และเปิดเว็บบน `localhost:3000` ของตัวเอง เลือกคำสั่งตามสิ่งที่จะทดสอบ

## เลือกโหมดก่อนเปิดแอป

- **`pnpm dev:supabase` สำหรับทีมทดสอบสลับกะร่วมกัน** พนักงาน หัวหน้ากะ และ Manager ใช้ตารางกะ คำขอ การอนุมัติ และโควตาจาก Supabase โปรเจกต์เดิม `mmesiubkvxmsklmgsepd` เครื่องของผู้ทดสอบจึงเห็นผลตรงกันหลังโหลดข้อมูลใหม่
- **`pnpm dev` สำหรับลอง Admin และจัดการพนักงานในเครื่อง** ใช้ PostgreSQL ของเครื่องนั้นสำหรับกำหนดบทบาท ดูบัญชีผู้ใช้ เปลี่ยนตำแหน่ง และย้ายทีม ส่วนฟอร์มเดโม่ลา OT และย้ายวันหยุดเก็บข้อมูลในเบราว์เซอร์ของเครื่องที่กรอก ทั้งสองโหมดยืนยันตัวตนผ่าน Supabase Auth

ทั้งสองโหมดใช้พอร์ตเดียวกัน หากจะสลับโหมด ให้หยุดคำสั่งเดิมด้วย `Ctrl+C` ก่อน เมื่อเปิดแล้วดูค่า `mode` ที่ [หน้าตรวจสถานะ API](http://localhost:3000/api/health) ค่า `SHARED_DEMO` คือฐานกลาง และ `DEMO` คือเดโม่ในเครื่องตามการตั้งค่าด้านล่าง

## เลือกวิธีรับโค้ด

ใช้ Git, Node.js 24 และ pnpm `11.25.0` ตรวจเวอร์ชันด้วย `node -v` และ `pnpm -v` ก่อนเริ่ม

### ยังไม่มีโปรเจกต์ในเครื่อง ให้ Clone

เปิด PowerShell ในโฟลเดอร์ที่จะเก็บโปรเจกต์ แล้วรัน

```powershell
git clone --branch codex/milestones-1-3 https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-.git
cd Shift-Scheduling-TNC-
```

### มีโปรเจกต์ในเครื่องแล้ว ให้ Pull

หยุดแอปด้วย `Ctrl+C` แล้วเปิด PowerShell ในโฟลเดอร์โปรเจกต์ รัน `git status --short` ก่อน หากมีไฟล์ที่แก้ไว้ ให้เก็บงานของตัวเองก่อนสลับ branch หรือ Pull

```powershell
git fetch origin
git switch codex/milestones-1-3
git pull --ff-only origin codex/milestones-1-3
git rev-parse --short HEAD
```

เทียบ commit ที่แสดงกับรหัสที่ผู้ประสานงานส่งมา หาก Pull แจ้งว่า fast-forward ไม่ได้ ให้ส่งข้อความ error ให้ผู้ประสานงานก่อนดำเนินการต่อ

## ติดตั้งสำหรับทั้งสองโหมด

จากรากโปรเจกต์ ติดตั้ง dependencies และเตรียมฟอนต์เว็บ คนที่ Pull มาใหม่รันชุดเดียวกันได้

```powershell
pnpm deps
node scripts/copy-fonts.mjs
```

สร้างไฟล์ `apps/auth/.env.local` สำหรับ Login ด้วย publishable key จาก Supabase โปรเจกต์เดิม

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mmesiubkvxmsklmgsepd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
TRUSTED_APP_ORIGINS=http://localhost:3000
DEV_ALLOWED_EMAIL_DOMAINS=thainitrate.com,example.com
```

หลัง Clone ให้สร้างไฟล์เองและตรวจว่าไม่มี `.txt` ต่อท้าย หลัง Pull ใช้ไฟล์เดิมได้เมื่อค่าตรงกับรอบนี้

## โหมดฐานกลางสำหรับทีม

สร้าง `.env.supabase.local` ไว้ข้าง `package.json` ขอ `DATABASE_URL` ของบัญชี Backend และรหัสบัญชีเดโม่จากผู้ประสานงานผ่านช่องทางส่วนตัว เก็บไฟล์ไว้นอก Git

```dotenv
SUPABASE_CONNECTION_READY=true
DATABASE_URL=<connection-string-of-tnc_backend_dev>
DATABASE_CA_CERT=config/certs/supabase-prod-ca-2021.crt
```

```powershell
pnpm dev:supabase
```

เปิด [ตรวจสถานะ API](http://localhost:3000/api/health) ควรได้ `status: ok` และ `mode: SHARED_DEMO` จากนั้นเปิด [ShiftFlow](http://localhost:3000) และเข้าด้วยบัญชีทดสอบตามบทบาท เปิด Terminal ค้างไว้ขณะทดสอบ ฐานกลางเตรียมไว้แล้ว จึงข้าม `pnpm setup`, `pnpm db:migrate` และ `pnpm db:seed` ได้

## โหมดในเครื่องสำหรับลอง Admin

บน Windows รันจากรากโปรเจกต์ หากเคยตั้ง PostgreSQL ในเครื่องแล้ว ให้ข้าม `pnpm setup` ได้

```powershell
pnpm setup
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm link-user
```

ดู `user_id` ของแถว `admin-demo` จากผลคำสั่งสุดท้าย หากแถวนั้นยังไม่ผูกบัญชี ให้ขอ UID ของ `admin.demo@example.com` จากผู้ดูแล แล้วแทน `APP_USER_ID` และ `SUPABASE_AUTH_UID` ด้วยค่าจริงของเครื่องและบัญชีนี้ก่อนรัน

```powershell
pnpm link-user APP_USER_ID SUPABASE_AUTH_UID
pnpm dev
```

เปิด [ShiftFlow](http://localhost:3000) ด้วยบัญชี Admin เดโม่ แล้วเข้าเมนู **กำหนดบทบาท** หรือ **บัญชีผู้ใช้** ถ้า Admin ล็อกอินแล้วเห็นข้อความว่าบัญชียังไม่ได้ผูก ให้ตรวจ `mode` และแถว `admin-demo` ในฐานของเครื่องนั้นก่อน ดูขั้นตอนผูกบัญชีรอสิทธิ์และทดลอง Manager เพิ่มเติมใน [README](../../README.md#ทดลอง-admin-และ-manager-ใน-milestone-4)

## โจทย์ทดสอบฐานกลางจากสองเครื่องขึ้นไป

1. พนักงาน A และ B เปิดตารางเดือนเดียวกัน ตรวจว่าเห็นกะเริ่มต้นตรงกัน เลือกวันที่ยังยื่นได้และคู่สลับต่างทีมตามผลตรวจกฎ
2. พนักงาน A ส่งคำขอ หัวหน้ากะ A และ B ตรวจคำขอหมายเลขเดียวกันและกดอนุมัติได้ทั้งสองลำดับ ตารางจะอัปเดตหลังครบสองฝ่าย และใช้โควตาของ A หนึ่งครั้ง
3. ให้พนักงานทั้งคู่โหลดตารางใหม่แล้วเทียบผล ลองทั้งแบบวันเดียวและคนละวัน หากจะทดสอบคืนตาราง ให้ยกเลิกก่อนช่วงงานแรกเริ่มและใช้รายการที่ยังไม่มีการเปลี่ยนกะต่อ
4. ให้หัวหน้ากะลองยื่นเองอีกหนึ่งรอบ แล้วให้ Manager เปิดคิวและอนุมัติ
5. เก็บผลจากผู้ทดสอบเป็นบทบาท หมายเลขคำขอ ขั้นตอนที่กด และสิ่งที่คาดว่าจะเห็น

สำหรับรายละเอียดการเชื่อมต่อเดิม ดู [บันทึกการเชื่อม Supabase](2026-11-01-supabase-migration.md)
