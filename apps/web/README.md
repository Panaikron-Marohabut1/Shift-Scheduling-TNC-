# apps/web — หน้าเว็บ ShiftFlow

หน้าเว็บ Vanilla JavaScript (ES modules) ไม่มีขั้นตอน build ระบบหลังบ้าน (`apps/api`) เป็นผู้ให้บริการไฟล์ในโฟลเดอร์นี้ที่ `http://localhost:3000` หน้าตาและกฎทั้งหมดตรงกับต้นแบบ ShiftFlow (เวอร์ชันทดลองบน Vercel)

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเดียวของแอป มี `#app`, `#modalRoot`, `#toastRoot` |
| `styles/app.css` | รูปแบบหน้าจอทั้งหมด (ฟอนต์ Sarabun จาก `scripts/copy-fonts.mjs`) |
| `src/api/client.js` | เรียก `/api/...` พร้อม timeout และแจ้ง session หมดอายุ |
| `src/app/main.js` | จุดเริ่ม: โครงหน้าจอ เมนู เข้า-ออกระบบ และคำสั่งของปุ่มทั้งหมด |
| `src/app/state.js` | สถานะของหน้าเว็บ รหัสกะ และการเก็บข้อมูลเดโมในเบราว์เซอร์ |
| `src/app/data.js` | โหลดและแปลงข้อมูลจาก API (ตารางกะ คำขอ ประวัติ) และคำสั่งที่ส่งไป API |
| `src/app/profiles.js` | บทบาท ชื่อที่ใช้เข้าสู่ระบบ และเมนูของแต่ละบทบาท |
| `src/shared/dom.js` | สร้าง HTML ไอคอน หน้าต่างย่อย ข้อความแจ้ง และตัวจัดการปุ่ม (`data-click`) |
| `src/shared/scheduling.js` | กฎตารางกะ: รหัสกะรายวัน ค่าคาดการณ์ กฎตรวจคำขอ ลำดับอนุมัติ วันหยุด |
| `src/features/schedule/` | ตารางกะ (`view.js`), กดช่องกะ (`cell.js`), กะของฉัน (`my-shift.js`), ภาพรวมกำลังพล (`overview.js`) |
| `src/features/requests/` | แบบฟอร์มยื่นคำขอทุกประเภท (`forms.js`), รายการ อนุมัติ ไม่อนุมัติ ยกเลิก (`view.js`) |
| `src/features/history/view.js` | ประวัติการเปลี่ยนแปลง |
| `src/features/manager/view.js` | พนักงานและทีม, ตารางรายปี/ประกาศใช้ทั้งปี, ตั้งค่าระบบ |
| `src/features/hr/view.js` | ข้อมูลและส่งออก CSV |
| `src/features/external/view.js` | ตารางรับส่งพนักงาน (คนขับรถ) |
| `src/features/session/view.js` | หน้าเข้าสู่ระบบ |

ระบบหลังบ้านตั้ง Content-Security-Policy ไม่ให้ใช้ `onclick="..."` หรือ `style="..."` ในหน้าเว็บ ปุ่มจึงเขียนเป็น `data-click="ชื่อคำสั่ง(ค่า)"` และลงทะเบียนคำสั่งใน `src/app/main.js` (ไม่มีการ eval โค้ด)

## ต่อฐานข้อมูลแล้ว

| ส่วน | API |
|---|---|
| เข้าสู่ระบบ / ออกจากระบบ | `GET /api/demo/accounts`, `POST /api/demo/session`, `POST /api/auth/logout` |
| พนักงานและตารางกะรายเดือน | `GET /api/schedules?month=YYYY-MM` |
| ยื่นสลับกะ (พนักงานทีม A/B แลกกะวันเดียวกัน) | `POST /api/requests` |
| รายการคำขอสลับกะ | `GET /api/requests` |
| อนุมัติ / ไม่อนุมัติ / ยกเลิก | `POST /api/requests/:id/decisions`, `POST /api/requests/:id/cancel` |
| ประวัติ | `GET /api/audit?view=personal\|activity` |

## ยังเก็บในเบราว์เซอร์ (รอ API)

ทุกการเปลี่ยนตารางกะ (รวมหัวหน้ากะ) ต้องยื่นคำขอและได้รับอนุมัติ หน้าเว็บไม่มีปุ่มแก้ช่องกะโดยตรง

ข้อมูลส่วนนี้เก็บใน `localStorage` (คีย์ `shiftflow.web.demo.v1`) แต่ละเครื่องเห็นของตัวเอง ล้างได้จากเมนูผู้ใช้ "ล้างข้อมูลทดลองในเครื่องนี้" ทุกจุดมีคำว่า `LOCAL` ในโค้ด

| ส่วน | ไฟล์ / ฟังก์ชันที่ต้องเปลี่ยนเมื่อมี API | API ที่ต้องเพิ่มที่ระบบหลังบ้าน (ข้อเสนอ) |
|---|---|---|
| ขอลา, ลา + OT คุมกะแทน | `features/requests/forms.js` → `submitLeaveRequest`, `submitColleagueSwapRequest` (โหมด leaveOT) | ประเภทคำขอ LEAVE / LEAVE_COVER ใน `POST /api/requests` |
| ขอทำ OT | `forms.js` → `submitOTRequest`, `submitOperatorShiftRequest` | ประเภทคำขอ OT + ขั้นอนุมัติผู้จัดการ |
| เปลี่ยนวันหยุด | `forms.js` → `submitDayOffChangeRequest` | ประเภทคำขอ DAY_OFF_CHANGE |
| เปลี่ยนกะของตัวเอง | `forms.js` → `submitOperatorShiftRequest` | ประเภทคำขอ SHIFT_CHANGE |
| ใช้สิทธิ์วันหยุดนักขัตฤกษ์ | `forms.js` → `submitPublicHolidayChoice` | ประเภทคำขอ HOLIDAY |
| หัวหน้ากะสลับกะกัน, พนักงานทีม C/D | `forms.js` → `submitColleagueSwapRequest` | เปิดสิทธิ์ใน `POST /api/requests` |
| อนุมัติคำขอเดโม | `features/requests/view.js` → `approveRequest`, `confirmRejectRequest`, `withdrawRequest` | ใช้ endpoint เดิมเมื่อคำขอเหล่านี้อยู่ในฐานข้อมูล |
| ตารางรายปี: ลำดับกะ, วันหยุด | `features/manager/view.js` → `updateAnnualTeamFamily`, `addAnnualHoliday`, `removeAnnualHoliday` | ตาราง annual_config, holidays + API |
| อนุมัติและประกาศใช้ทั้งปี | `manager/view.js` → `publishYear`, `unpublishYear` | `POST /api/schedules/:year/publish` (ระบบมีสถานะ PUBLISHED รายเดือนแล้ว) |
| เพิ่ม/แก้ข้อมูลพนักงาน | `manager/view.js` → `saveEmployeeProfile` | `POST/PATCH /api/employees` |
| ตั้งค่าเวลากะและกฎ | `manager/view.js` → `updateManagerShiftTime`, `updateManagerRule` | `GET/PATCH /api/settings` |
| คนขับรถ: รายชื่อจุดรับส่ง, รับทราบ | `features/external/view.js` → `driverHtml`, `acknowledgeDriverSchedule` | `GET /api/transport`, `POST /api/transport/ack` |
| ส่งออก CSV | `features/hr/view.js` | สร้างในเบราว์เซอร์ได้อยู่แล้ว ถ้าต้องการไฟล์จากเซิร์ฟเวอร์ให้เพิ่ม `GET /api/exports/...` |
| รหัสผ่านทดลอง 1234 | `features/session/view.js` → `signIn` | ระบบล็อกอินของบริษัท (Authentication) |

เดือนที่ยังไม่มีตารางในฐานข้อมูลแสดงเป็น "ตารางคาดการณ์" ตามรอบ 2 วันสลับ 2 วันของเดือนแรกที่มีข้อมูลจริง (`shared/scheduling.js` → `getShiftCodeForDate`)
