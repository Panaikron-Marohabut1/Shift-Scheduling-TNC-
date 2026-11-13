# Milestone 5 — ทดสอบสลับกะร่วมกันผ่าน Supabase

ทีมใช้โค้ด ShiftFlow ชุดเดียวกันจาก GitHub แต่ละคนเปิดเว็บบน localhost ของตัวเอง ส่วนบัญชี ตารางกะ คำขอสลับกะ การอนุมัติ และโควตาใช้ Supabase project เดิม `mmesiubkvxmsklmgsepd` ร่วมกัน รอบนี้ใช้ข้อมูลเดโม่และทดสอบการสลับกะ

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

## ติดตั้งและตั้งค่า

1. จากรากโปรเจกต์ ติดตั้ง dependencies และเตรียมฟอนต์เว็บ คนที่ Pull มาใหม่รันชุดเดียวกันได้

   ```powershell
   pnpm deps
   node scripts/copy-fonts.mjs
   ```

2. สร้างไฟล์ `.env.supabase.local` ที่รากโปรเจกต์ อยู่ระดับเดียวกับ `package.json` ใช้ค่าเชื่อมต่อของบัญชี Backend ที่ผู้ดูแลส่งให้ผ่านช่องทางส่วนตัว

   ```dotenv
   SUPABASE_CONNECTION_READY=true
   DATABASE_URL=<connection-string-of-tnc_backend_dev>
   DATABASE_CA_CERT=config/certs/supabase-prod-ca-2021.crt
   ```

3. สร้างไฟล์ `apps/auth/.env.local` โดยใช้ publishable key จาก Supabase project เดียวกัน

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://mmesiubkvxmsklmgsepd.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   TRUSTED_APP_ORIGINS=http://localhost:3000
   DEV_ALLOWED_EMAIL_DOMAINS=thainitrate.com,example.com
   ```

ถ้า Pull จากเครื่องที่เคยตั้งค่า Pilot แล้ว ให้ใช้ไฟล์เดิมได้เมื่อค่าตรงกับรอบนี้ ไฟล์ทั้งสองอยู่นอก Git จึงต้องสร้างเองหลัง Clone ตรวจชื่อไฟล์ว่าไม่มี `.txt` ต่อท้าย ขอ `DATABASE_URL` และบัญชีทดสอบจากผู้ประสานงานทางช่องทางส่วนตัว

## เปิดแอปทุกครั้ง

```powershell
pnpm dev:supabase
```

เปิด [ตรวจสถานะ API](http://localhost:3000/api/health) ควรได้ `status: ok` และ `mode: SHARED_DEMO` จากนั้นเปิด [ShiftFlow](http://localhost:3000) และเข้าด้วยบัญชีทดสอบตามบทบาท เปิด Terminal ค้างไว้ขณะทดสอบ ฐานกลางเตรียมไว้แล้ว จึงข้าม `pnpm setup`, `pnpm db:migrate` และ `pnpm db:seed` ได้

## ซ้อมจากสองเครื่องขึ้นไป

1. พนักงาน A และ B เปิดตารางเดือนเดียวกัน ตรวจว่าเห็นกะเริ่มต้นตรงกัน เลือกวันที่ยังยื่นได้และคู่สลับต่างทีมตามผลตรวจกฎ
2. พนักงาน A ส่งคำขอ หัวหน้ากะ A และ B ตรวจคำขอหมายเลขเดียวกันและกดอนุมัติได้ทั้งสองลำดับ ตารางจะอัปเดตหลังครบสองฝ่าย และใช้โควตาของ A หนึ่งครั้ง
3. ให้พนักงานทั้งคู่โหลดตารางใหม่แล้วเทียบผล ลองทั้งแบบวันเดียวและคนละวัน หากจะทดสอบคืนตาราง ให้ยกเลิกก่อนช่วงงานแรกเริ่มและใช้รายการที่ยังไม่มีการเปลี่ยนกะต่อ
4. ให้หัวหน้ากะลองยื่นเองอีกหนึ่งรอบ แล้วให้ Manager เปิดคิวและอนุมัติ
5. เก็บผลจากผู้ทดสอบเป็นบทบาท หมายเลขคำขอ ขั้นตอนที่กด และสิ่งที่คาดว่าจะเห็น

ใช้เมนูสลับกะในรอบนี้ ฟอร์มลา OT ย้ายวันหยุด และงาน Admin/จัดการพนักงานของเดโม่ในเครื่องอยู่นอกขอบเขตการทดสอบร่วมกัน หากต้องการเปิดระบบผ่าน HTTPS ในอนาคต มีชุดตั้งค่าโฮสต์แยกไว้ภายใต้ `deploy/`

สำหรับรายละเอียดการเชื่อมต่อเดิม ดู [บันทึกการเชื่อม Supabase](2026-11-01-supabase-migration.md)
