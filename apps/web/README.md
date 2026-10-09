# apps/web — หน้าเว็บ ShiftFlow

หน้าเว็บ Vanilla JavaScript (ES modules) ไม่มีขั้นตอน build ระบบหลังบ้าน (`apps/api`) เป็นผู้ให้บริการไฟล์ในโฟลเดอร์นี้ที่ `http://localhost:3000` หน้าตาและกฎทั้งหมดตรงกับต้นแบบ ShiftFlow (เวอร์ชันทดลองบน Vercel)

ไฟล์แยกตามหน้าที่ ไฟล์ละเรื่อง เพื่อให้หลายคนแก้พร้อมกันได้โดยไม่ชนกัน หัวไฟล์ทุกไฟล์มีคำอธิบายว่าไฟล์นั้นทำอะไร

## จะแก้เรื่องนี้ ไปที่ไฟล์ไหน

| อยากแก้ | ไฟล์ |
|---|---|
| สี ฟอนต์ ปุ่ม ช่องกรอก | `styles/base.css` |
| เมนูซ้าย แถบบน/ล่างบนมือถือ | `styles/layout.css`, `src/app/shell.js` |
| ตารางกะรายเดือน / รายวัน | `styles/schedule.css`, `src/features/schedule/month-grid.js`, `day-view.js`, `page.js` |
| กดช่องกะในตาราง | `src/features/schedule/cell.js` |
| หน้ากะของฉัน (ปฏิทิน) | `styles/my-shift.css`, `src/features/schedule/my-shift.js` |
| แบบฟอร์มคำขอประเภทใดประเภทหนึ่ง | `src/features/requests/types/<ประเภท>.js` (swap, change, leave, dayoff, ot, holiday) |
| กฎตรวจคำขอ (6 วันติด, ดึกต่อเช้า, OT, สิทธิ์ต่อเดือน, ±7 วัน) | `src/shared/scheduling/rules.js` |
| ลำดับผู้อนุมัติ / ใครอนุมัติขั้นไหนได้ | `src/shared/scheduling/rules.js` → `buildApprovalChain`, `src/features/requests/permissions.js`, `form-parts.js` → `routeApprovers` |
| ตารางคำขอและปุ่มอนุมัติ | `styles/requests.css`, `src/features/requests/list.js`, `decisions.js` |
| หน้าผู้จัดการ | `styles/pages.css`, `src/features/manager/people.js`, `annual.js`, `settings.js` |
| หน้าฝ่ายบุคคล / ไฟล์ CSV | `src/features/hr/view.js` |
| หน้าคนขับรถ | `src/features/external/view.js` |
| หน้าเข้าสู่ระบบ | `styles/login.css`, `src/features/session/view.js` |
| ต่อ API ใหม่ | `src/app/data.js` (โหลด/ส่งข้อมูล) และจุดที่มีคำว่า `LOCAL` |

## โครงสร้างไฟล์

```
apps/web/
├── index.html                 หน้าเดียวของแอป (#app, #modalRoot, #toastRoot) และลำดับไฟล์ CSS
├── styles/                    ไฟล์หลังทับไฟล์ก่อน ลำดับตาม index.html
│   ├── base.css               ฟอนต์ สี ตัวแปร ปุ่ม ช่องกรอก สถานะ รหัสกะ ตารางข้อมูล ข้อความแจ้ง
│   ├── layout.css             เมนูซ้าย แถบบน/ล่างบนมือถือ หัวหน้า กล่อง ตัวเลือกเดือน
│   ├── schedule.css           ตารางกะรายเดือน รายวัน วันหยุด ช่องที่เปลี่ยนกะ
│   ├── my-shift.css           กะของฉัน
│   ├── requests.css           หน้าต่างย่อย แบบฟอร์มคำขอ ผลตรวจกฎ ขั้นอนุมัติ ตารางคำขอ
│   ├── pages.css              ภาพรวมกำลังพล ผู้จัดการ ฝ่ายบุคคล คนขับรถ
│   └── login.css              หน้าเข้าสู่ระบบ
└── src/
    ├── api/client.js          เรียก /api/... พร้อม timeout และแจ้งเมื่อหมดเวลาเข้าสู่ระบบ
    ├── app/                   แกนของแอป
    │   ├── main.js            จุดเริ่ม: เปิดเว็บ ผูกส่วนต่าง ๆ เข้าด้วยกัน รีเฟรชทุก 30 วินาที
    │   ├── state.js           สถานะของหน้าเว็บ รหัสกะ และข้อมูลเดโมในเบราว์เซอร์
    │   ├── data.js            โหลด/แปลงข้อมูลจาก API และคำสั่งที่ส่งไป API
    │   ├── profiles.js        บทบาท ชื่อเข้าสู่ระบบ และเมนูของแต่ละบทบาท
    │   ├── session.js         เข้าสู่ระบบ / ออกจากระบบ
    │   ├── shell.js           เมนูซ้าย แถบบน/ล่าง ตัวเลขแจ้งเตือน
    │   ├── routes.js          เลือกหน้าตามบทบาทและเมนู
    │   ├── render.js          วาดหน้าจอใหม่
    │   └── actions.js         คำสั่งของปุ่มทั้งหมด (ลงทะเบียนที่นี่ที่เดียว)
    ├── shared/                ใช้ร่วมกันทุกหน้า
    │   ├── dom.js             $(), esc(), js()
    │   ├── events.js          ตัวจัดการปุ่ม data-click / data-change / ...
    │   ├── modal.js           หน้าต่างย่อย
    │   ├── toast.js           ข้อความแจ้งผล
    │   ├── icons.js           ไอคอน
    │   ├── translate.js       แปลงข้อความอังกฤษบางคำเป็นไทย
    │   ├── ui.js              หัวหน้า และเบอร์โทร
    │   └── scheduling/        ข้อมูลและกฎของตารางกะ
    │       ├── dates.js       วันที่ ชื่อเดือนไทย
    │       ├── employees.js   พนักงาน บทบาท ผู้ใช้ที่เข้าสู่ระบบ
    │       ├── roster.js      รหัสกะของแต่ละคนแต่ละวัน ค่าคาดการณ์ ล็อกเดือน
    │       ├── annual.js      ตารางรายปี วันหยุดนักขัตฤกษ์ ประกาศใช้
    │       └── rules.js       กฎตรวจคำขอ สิทธิ์ต่อเดือน ลำดับผู้อนุมัติ
    └── features/              แต่ละหน้า
        ├── schedule/          page, month-grid, day-view, month-nav, codes, days, cell, my-shift, overview
        ├── requests/          new-request, form, form-parts, submit, list, detail, decisions, permissions
        │   └── types/         swap, change, leave, dayoff, ot, holiday (ฟอร์ม + ส่งคำขอ ของแต่ละประเภท)
        ├── manager/           people, annual, settings, refresh
        ├── history/view.js    ประวัติการเปลี่ยนแปลง
        ├── hr/view.js         ข้อมูลและส่งออก CSV
        ├── external/view.js   ตารางรับส่งพนักงาน (คนขับรถ)
        └── session/view.js    หน้าเข้าสู่ระบบ
```

## กฎความปลอดภัย (ทุกคนในทีมต้องทำตาม)

ตรวจอัตโนมัติด้วย `pnpm check:web` (รวมอยู่ใน `pnpm check` แล้ว) ถ้าผิดกฎจะบอกไฟล์และบรรทัด

1. **ข้อความจากผู้ใช้หรือฐานข้อมูลต้องผ่าน `esc()` ก่อนใส่ใน HTML** เช่น `${esc(emp.name)}` ไม่ใช่ `${emp.name}` (กันคนใส่โค้ดในชื่อหรือเหตุผล แล้วโค้ดนั้นรันในเครื่องคนอื่น)
2. **ค่าในคำสั่งของปุ่มต้องผ่าน `js()`** เช่น `data-click="SF.cell(${js(emp.id)}, ${d})"` (ตัวเลขใส่ตรงได้)
3. **ห้ามใช้ `onclick="..."` และ `style="..."`** ระบบหลังบ้านตั้ง Content-Security-Policy ไว้ ใช้ไม่ได้อยู่แล้ว ให้ใช้ `data-click` และเพิ่มคลาสใน `styles/*.css`
4. **ใส่ HTML ลงหน้าเว็บได้เฉพาะ** `renderApp()` และ `openModal()` ไฟล์อื่นให้คืนข้อความ HTML ออกไป
5. **ห้ามใช้** `eval`, `new Function`, `outerHTML`, `insertAdjacentHTML`, `document.write` และห้ามโหลดไฟล์จากเว็บไซต์ภายนอก
6. **คำสั่งที่ปุ่มเรียกได้ต้องลงทะเบียนใน `src/app/actions.js`** ชื่อที่ไม่ได้ลงทะเบียนจะกดไม่ได้
7. ชื่อหน้าต่าง (`openModal(title, ...)`) และข้อความแจ้ง (`showToast(...)`) เป็นข้อความธรรมดา ระบบ esc ให้เอง ไม่ต้องใส่ HTML
8. ไฟล์ CSV ที่ส่งออก ป้องกันข้อความที่ขึ้นต้นด้วย `= + - @` ไม่ให้ Excel ตีความเป็นสูตรแล้ว (`features/hr/view.js`)

## ต่อฐานข้อมูลแล้ว

| ส่วน | API |
|---|---|
| เข้าสู่ระบบ / ออกจากระบบ | `GET /api/demo/accounts`, `POST /api/demo/session`, `POST /api/auth/logout` |
| พนักงานและตารางกะรายเดือน | `GET /api/schedules?month=YYYY-MM` |
| ยื่นสลับกะ (พนักงานแลกกะวันเดียวกัน กับเดือนที่มีข้อมูลจริง) | `POST /api/requests` |
| รายการคำขอสลับกะ | `GET /api/requests` |
| อนุมัติ / ไม่อนุมัติ / ยกเลิก | `POST /api/requests/:id/decisions`, `POST /api/requests/:id/cancel` |
| ประวัติ | `GET /api/audit?view=personal\|activity` |

## ยังเก็บในเบราว์เซอร์ (รอ API)

ทุกการเปลี่ยนตารางกะ (รวมหัวหน้ากะ) ต้องยื่นคำขอและได้รับอนุมัติ หน้าเว็บไม่มีปุ่มแก้ช่องกะโดยตรง

ข้อมูลส่วนนี้เก็บใน `localStorage` (คีย์ `shiftflow.web.demo.v1`) แต่ละเครื่องเห็นของตัวเอง ล้างได้จากเมนูผู้ใช้ "ล้างข้อมูลทดลองในเครื่องนี้" ทุกจุดมีคำว่า `LOCAL` ในโค้ด

| ส่วน | ไฟล์ / ฟังก์ชันที่ต้องเปลี่ยนเมื่อมี API | API ที่ต้องเพิ่มที่ระบบหลังบ้าน (ข้อเสนอ) |
|---|---|---|
| ขอลา, ลา + OT คุมกะแทน | `requests/types/leave.js` → `submitLeaveRequest`, `types/swap.js` → `submitColleagueSwapRequest` (โหมด leaveOT) | ประเภทคำขอ LEAVE / LEAVE_COVER ใน `POST /api/requests` |
| ขอทำ OT | `types/ot.js` → `submitOTRequest`, `types/change.js` (กรณีเลือกกะ OT) | ประเภทคำขอ OT + ขั้นอนุมัติผู้จัดการ |
| เปลี่ยนวันหยุด | `types/dayoff.js` → `submitDayOffChangeRequest` | ประเภทคำขอ DAY_OFF_CHANGE |
| เปลี่ยนกะของตัวเอง | `types/change.js` → `submitOperatorShiftRequest` | ประเภทคำขอ SHIFT_CHANGE |
| ใช้สิทธิ์วันหยุดนักขัตฤกษ์ | `types/holiday.js` → `submitPublicHolidayChoice` | ประเภทคำขอ HOLIDAY |
| หัวหน้ากะสลับกะกัน, พนักงานทีม C/D | `types/swap.js` → `submitColleagueSwapRequest` | เปิดสิทธิ์ใน `POST /api/requests` |
| บันทึกคำขอเดโมทุกประเภท | `requests/submit.js` → `saveLocalRequest` (จุดเดียว) | — |
| อนุมัติคำขอเดโม | `requests/decisions.js` → `approveRequest`, `confirmRejectRequest`, `withdrawRequest` | ใช้ endpoint เดิมเมื่อคำขอเหล่านี้อยู่ในฐานข้อมูล |
| ตารางรายปี: ลำดับกะ, วันหยุด | `manager/annual.js` → `updateAnnualTeamFamily`, `addAnnualHoliday`, `removeAnnualHoliday` | ตาราง annual_config, holidays + API |
| อนุมัติและประกาศใช้ทั้งปี | `manager/annual.js` → `publishYear`, `unpublishYear` | `POST /api/schedules/:year/publish` (ระบบมีสถานะ PUBLISHED รายเดือนแล้ว) |
| เพิ่ม/แก้ข้อมูลพนักงาน | `manager/people.js` → `saveEmployeeProfile` | `POST/PATCH /api/employees` |
| ตั้งค่าเวลากะและกฎ | `manager/settings.js` → `updateManagerShiftTime`, `updateManagerRule` | `GET/PATCH /api/settings` |
| คนขับรถ: รายชื่อจุดรับส่ง, รับทราบ | `external/view.js` → `driverHtml`, `acknowledgeDriverSchedule` | `GET /api/transport`, `POST /api/transport/ack` |
| ส่งออก CSV | `hr/view.js` | สร้างในเบราว์เซอร์ได้อยู่แล้ว ถ้าต้องการไฟล์จากเซิร์ฟเวอร์ให้เพิ่ม `GET /api/exports/...` |
| รหัสผ่านทดลอง 1234 | `session/view.js` → `signIn` | ระบบล็อกอินของบริษัท (Authentication) |

เดือนที่ยังไม่มีตารางในฐานข้อมูลแสดงเป็น "ตารางคาดการณ์" ตามรอบ 2 วันสลับ 2 วันของเดือนแรกที่มีข้อมูลจริง (`shared/scheduling/roster.js` → `getShiftCodeForDate`)
