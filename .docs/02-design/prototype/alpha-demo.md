# Shift schedule TNC — Alpha Demo implementation

วันที่ 6 ตุลาคม 2026 อ้างอิงแผน implementation ที่ผู้ใช้อนุมัติ, schema DBML ที่ผู้ใช้ให้, ต้นแบบ `prototypes/legacy-static/app.js`, `prototypes/legacy-static/index.html`, `prototypes/legacy-static/app.css` (เดิมอยู่ `shift/`), baseline `.docs/01-requirements/rule.md` และ spec/backlog ปัจจุบัน เอกสารนี้บันทึกขอบเขต prototype ไม่แก้หรือถือว่าข้อกำหนดบริษัทได้รับการยืนยันแล้ว

อัปเดต 7 ตุลาคม 2026 ตามคำยืนยันผู้ใช้: เปิดสลับข้ามทีมครบ A–D เพิ่มเฉพาะ Supervisor C/D เป็น 9 บัญชี บัญชีพนักงานยังมี A/B และคงกฎตรวจความปลอดภัยเดิม ขอบเขตนี้แทนข้อจำกัด A/B ของเดโมก่อนหน้า ไม่ใช่การยืนยันกฎบริษัทเพิ่มเติม

## Purpose, fields, access, retention and approvals

Purpose คือพิสูจน์ workflow สลับกะข้ามทีมและ persistence โดยใช้ข้อมูลสมมติเท่านั้น Fields: test account ID, employee ID/code/name, role/team, fixture position, assignment ID/work date/shift/status/version, request snapshots/status/version, decision/reason/time, session token hash/expiry และ audit/notification records ไม่มีชื่อจริง เบอร์โทร อีเมลจริง หรือรายละเอียดลาป่วย

ขอบเขตที่ผู้ใช้ยืนยันเพิ่มเติม: หน้าเข้าเดโมมี 9 บัญชี (Manager, Supervisor A/B/C/D, Employee A/B, HR, External) พนักงาน หัวหน้า และ Manager อ่านตาราง A–D เพื่อการวางแผนกะ HR อ่านเฉพาะตารางที่เผยแพร่แล้ว Manager อ่านคำขอรวมเพื่อติดตามเท่านั้น พนักงานอ่านคำขอที่ตนยื่น หัวหน้าตัดสินเฉพาะคำขอที่ได้รับมอบหมายและถึงขั้นปัจจุบัน พนักงาน A/B เลือกคู่สลับจากทีมอื่นใน A–D ได้ เงื่อนไขตำแหน่งตรงกัน รหัสกะต่างกัน รวม M/N/O กะไม่ซ้อน และไม่เกิน 6 วันทำงานต่อเนื่องยังคงเดิม คู่สลับเปิดเผยเฉพาะข้อมูล scheduling ไม่มี employee contact fields ใน response

Manager/External ใช้ชื่อแสดงบัญชีสมมติและ user ID โดยไม่ผูกเป็นพนักงานกะ บัญชี Supervisor C/D เปิด session ด้วย user ID เดิม ส่วนบัญชีพนักงาน C/D ยังไม่เปิดเลือกใช้และหลักฐานเดิมยังอยู่ External ใช้โครงหน้ารถรับส่งที่ไม่มีรายชื่อหรือจุดรับส่ง และไม่มีสิทธิ์อ่าน API ข้อมูลพนักงาน ตาราง คำขอ หรือ audit ภายใน หน้าแก้ไขพนักงาน ตารางรายปี ตั้งค่า Export/Leave/OT และรับทราบรถรับส่งยังปิดการดำเนินการ ไม่สร้างข้อมูลหรือผลสำเร็จจำลอง ค่าที่บริษัทยังไม่ยืนยันแสดงรอยืนยัน

Session อายุ 12 ชั่วโมง Audit baseline ตั้งได้ไม่น้อยกว่า 90 วัน Runtime role เพิ่มและอ่าน audit ได้ แต่แก้ ลบ หรือ truncate ไม่ได้ ไม่มี cleanup logs อัตโนมัติ Fixture ใหม่สร้างฐานข้อมูลใหม่เก็บฐานเดิมไว้ ผู้ดูแลระดับ owner ยังต้องปกป้องเครื่องและไฟล์ ไม่อ้างว่า trigger ป้องกัน DBA เปลี่ยน schema ได้ การเก็บจริง backup และ legal holds ต้องยืนยันก่อนเปิดข้อมูลบริษัท

Audit เก็บ UTC และ actor ID สำหรับเริ่ม/จบ session, เปิดตารางพร้อมขอบเขต/เวอร์ชัน, authorization denial ที่ระบุ actor ได้, ยื่นคำขอ, ตัดสิน และใช้ผลกับตาราง การอนุมัติใช้หัวหน้าผู้ขอเป็นขั้นแรก หัวหน้าอีกทีมเป็นขั้นสองตาม fixture และคำอนุมัติของผู้ใช้สำหรับเดโม ข้อมูลจริงต้องผ่าน gate ใน `rule.md` และคำยืนยันบริษัท

คำยืนยันผู้ใช้วันที่ 7 ตุลาคม 2026 (ตัวเลือก A): ทุกบัญชีภายในที่อ่านตารางนั้นได้เห็นชื่อและทีมคู่สลับ เพื่อระบุที่มาของกะและประสานงานจากตาราง ใช้ข้อมูลสมมติในเดโมเท่านั้น HR ยังคงอ่านเฉพาะตารางเผยแพร่ ส่วน External ไม่มีสิทธิ์ ข้อมูลที่เพิ่มมี request ID, เวลาใช้ผล, รหัสกะเดิม/ที่รับมา และ employee ID/ชื่อ/ทีมของคู่สลับ ไม่เปิดเผยเหตุผลคำขอ รายละเอียด audit หรือขยายสิทธิ์อ่านคำขอ ใช้หลักฐาน `SCHEDULE_SWAP_APPLIED` เดิมที่อนุมัติครบสองขั้น และคงการเก็บ audit อย่างน้อย 90 วัน การเปิดรายละเอียดอาศัยขอบเขตการอ่านตารางที่บันทึก audit เดิม ไม่มีการอนุมัติหรือเปลี่ยนข้อมูลจากการดูรายละเอียด

คำยืนยันผู้ใช้วันที่ 7 ตุลาคม 2026 สำหรับการยกเลิก (ตัวเลือก A): พนักงานผู้ยื่นถอนคำขอสลับกะที่ส่งผิดได้เฉพาะ `PENDING` และยังไม่มีหัวหน้าบันทึกคำตัดสิน การเปิดรายละเอียดหรือเปิดหน้าตรวจไม่ตัดสิทธิ์นี้ เมื่อหัวหน้าคนแรกยืนยันอนุมัติหรือปฏิเสธแล้ว ยกเลิกไม่ได้ จุดประสงค์คือแก้การเลือกวันที่หรือคู่สลับผิดก่อนมีคำตัดสิน ไม่แก้หรือลบคำอนุมัติเดิม ไม่ขยายไป Leave/OT ที่ยังไม่เปิดใช้งาน

ข้อมูลขั้นต่ำของคำสั่งยกเลิกคือ request ID, expected request version และ idempotency key ใช้ actor จาก session เท่านั้น ไม่ขอเหตุผลหรือข้อมูลส่วนบุคคลเพิ่ม เปลี่ยนคำขอเป็น `CANCELLED` และเพิ่มเวอร์ชัน โดยเก็บ snapshot และรายการขั้นอนุมัติเดิมไว้ ตารางและเวอร์ชัน assignment ไม่เปลี่ยน ผู้ยื่นและผู้ที่มีสิทธิ์อ่านคำขอเดิมอ่านสถานะได้ สิทธิ์ยกเลิกมีเฉพาะพนักงานผู้ยื่น ไม่มีสิทธิ์ยกเลิกแทนสำหรับหัวหน้า Manager HR External หรือคู่สลับ

บันทึก `REQUEST_CANCELLED` ด้วย actor ID, เวลา UTC, request ID, วันที่/assignment IDs ที่เกี่ยวข้อง และสถานะ/เวอร์ชันก่อน–หลังใน protected audit เดิมอย่างน้อย 90 วัน แสดงการยกเลิกในประวัติส่วนตัวของผู้กระทำ เก็บหลักฐานการยื่นเดิมไว้ แจ้งหัวหน้าขั้นแรกผ่านการแจ้งเตือนภายในแอปที่มีอยู่แล้วด้วยข้อความสถานะขั้นต่ำ คำขอ เวอร์ชัน audit แจ้งเตือน และ operation receipt อยู่ใน transaction เดียวกับ request row lock เช่นเดียวกับการอนุมัติ หากยกเลิกกับคำตัดสินส่งพร้อมกันจะสำเร็จเพียงรายการเดียว อีกฝ่ายได้รับ conflict และต้องโหลดสถานะล่าสุด คำขอที่ยกเลิกแล้วไม่กันการยื่นคำขอใหม่สำหรับกะเดิม

## Implementation structure

`apps/api/src/` แยก auth, employees, schedules, requests, validation, audit, notifications, integrations และ database ใช้ NestJS + TypeScript และ parameterized SQL ผ่าน `pg` Migration อยู่ `apps/api/migrations/` Synthetic seed อยู่ `apps/api/seeds/` ไม่ทำงานเมื่อเปิด server

`apps/web/src/` แยก app navigation/UI state, API client, session, schedule, swap, requests, history, manager, HR, external และ shared DOM utilities สร้าง element/text nodes ไม่ใช้ employee strings เป็น HTML ฟอนต์คัดลอกจาก dependencies ตอน setup/build และใช้ในเครื่อง Backend ให้ frontend และ API จาก origin เดียว

Schema คง entities จาก DBML: USER, ROLE, EMPLOYEE, TEAM, SHIFT_TYPE, SCHEDULE, SHIFT_ASSIGNMENT, REQUEST, CHANGE_REQUEST, APPROVAL, NOTIFICATION, AUDIT_LOG, HOLIDAY ใช้ plural lower-case ใน SQL เพิ่ม identity source, nullable Azure ID เฉพาะ DEMO, versions, snapshots, approval stage/version, session และ operation receipt Foreign keys/unique constraints ผูกความสัมพันธ์และป้องกันคำตัดสินซ้ำ

อนุมัติล็อก request ตามด้วย advisory locks ของ employee ตาม ID และ assignment rows ตาม ID การตรวจรอบวันที่รวมข้ามเดือน อนุมัติสุดท้ายตรวจ assignment versions อีกครั้งก่อนเปลี่ยนทั้งสอง assignments, schedule version, request, approvals, audit และ notifications ใน transaction เดียว การอ่านตารางใช้ consistent transaction snapshot สำหรับ assignments และ schedule version

คำสั่งสร้าง/ตัดสิน/ยกเลิกต้องมี `Idempotency-Key` ผูก user และ input hash ส่ง input เดิมด้วย key เดิมได้ผลเดิม ใช้ key ซ้ำกับ input ต่างกันหรือ expected version เก่าตอบ 409 กรณี schedule stale ต้องเริ่มคำขอใหม่ การปฏิเสธต้องมีเหตุผลและไม่เปลี่ยนตาราง Migration `004_request_cancellation.sql` เพิ่มสถานะคำขอโดยไม่ลบหรือปรับข้อมูลเดิม Backend ตรวจว่ารัน migration นี้แล้วก่อนเปิดใช้งาน

## API

ทุก endpoint อยู่ใต้ `/api`; mutation ตรวจ Host/Origin และ protected endpoints ตรวจ session/role:

- `GET /demo/accounts`, `POST /demo/session`, `GET /me`, `POST /auth/logout`
- `GET /employees`, `GET /schedules?month=YYYY-MM`
- `GET /swap/candidates?assignmentId=...`, `POST /swap/validate`
- `POST /requests`, `GET /requests`, `POST /requests/:requestId/decisions`, `POST /requests/:requestId/cancel`
- `GET /audit`, `GET /notifications`, `GET /health`

Swap input: `assignmentId`, `targetAssignmentId`, `assignmentVersion`, `targetVersion` Decision input: `decision` (`APPROVE`/`REJECT`), `expectedVersion`, `reason` Cancel input: `expectedVersion` โดยตรวจผู้ยื่นและคำตัดสินจากฐานข้อมูล ไม่มี API ให้ client เปลี่ยน role หรือสถานะ approved เอง Request response มี `canCancel` ที่คำนวณจากสิทธิ์และสถานะปัจจุบัน

Manager อ่าน roster จาก assignments ของ `/schedules` ไม่ขยายสิทธิ์ `/employees` Request response มี `demoSupported` สำหรับขอบเขต A–D และ `approvalRouteConfirmed` เมื่อมีขั้นอนุมัติ 1/2 ครบ คำขอเก่าที่ snapshot ไม่มี team code ใช้ team IDs ที่มีอยู่โดยไม่เขียน snapshot ใหม่ คำขอที่ขั้นอนุมัติไม่ครบไม่สามารถตัดสินหรือใช้ผลกับตารางได้ HR และ External อ่านหรือตัดสินคำขอไม่ได้ Manager อ่านได้แต่ตัดสินไม่ได้ Audit ยังคงขอบเขตรายการที่ actor เกี่ยวข้อง ไม่ขยายเป็น global audit สำหรับ Manager/HR

## Restored prototype screens

ใช้โครง เมนู สี navy/mint ฟอนต์ และองค์ประกอบจาก Prototype เดิม โดยเก็บไฟล์เดิมครบ ไม่คัดลอก state จำลองหรือบุคคลเดิมมาใช้:

- Manager: ติดตามคำขอรวม, พนักงานและทีมพร้อมค้นหา/กรอง, ตารางรายปีครบ 12 เดือน, ตั้งค่าช่วงเวลากะและทางลัด เพิ่ม/แก้/ย้ายทีม เปลี่ยนรอบกะและจัดการวันหยุดยังปิด
- Supervisor A/B/C/D: ตารางกะ, ภาพรวมกำลังพลจากวันจริงใน fixture, คิวคำขอที่รับผิดชอบ, ประวัติ การนับกำลังคนไม่ตัดสินว่าผ่านเกณฑ์บริษัท
- Employee A/B: กะของตนและ 7 วันถัดไป, ตารางทุกทีม, คำขอ, ประวัติ เลือกส่งคำขอจาก assignments ของตนเท่านั้น
- HR: ตารางที่เผยแพร่แล้ว, ข้อมูลรายเดือนและ Export Center สำหรับตาราง/ลา/OT, ตรวจสอบ OT และประวัติที่ตนมีสิทธิ์ดู ปุ่มส่งออกและตรวจ OT ยังปิด
- External: หน้ารถรับส่งแบบมือถือ มีวันที่ พื้นที่รายชื่อ ทีม บทบาท จุดรับส่ง เวลานัดหมาย และการรับทราบ แต่ยังไม่มีข้อมูลและไม่เรียก API ภายใน

ตารางเดือนเป็นตารางเดียว แบ่งหัวทีม A–D มีตัวกรองทุกทีม/A/B/C/D หัวสัปดาห์ 1–7, 8–14 จนสิ้นเดือน สี M/N/O วันเสาร์–อาทิตย์ และคอลัมน์ชื่อคงที่ ตัวกรองเป็น UI state คงเมื่อเปลี่ยนเดือนและกลับเป็นทุกทีมเมื่อเปลี่ยนบัญชี ตารางรายปีอ่านแต่ละเดือนจาก API เดือนที่ไม่มีข้อมูลแสดง “ยังไม่มีข้อมูล” ตัวเลขรวมทุกคนในทีมเป็นหน่วยคน-วัน ค่าระบบบริษัทที่ไม่ยืนยันใช้ “— / รอยืนยัน”

Migration `002_demo_profiles.sql` เพิ่ม nullable employee identity สำหรับ Manager/External และ demo profile/order ส่วน `003_four_team_demo.sql` ขยาย constraint ของ demo order เป็น 1–9 โดยไม่แก้ migration เก่า Seed เปิด Supervisor C/D ที่มีอยู่เดิมใน transaction แบบทำซ้ำได้โดยรักษา IDs และ order ของ 7 บัญชีเดิม ไม่ลบ schedule/request/audit และไม่เปิดบัญชีพนักงาน C/D ต้องรัน migrate แล้ว seed เพื่ออัปเกรดฐานเดโมเดิม ไม่รีเซ็ตตอนเปิด server

## Verification and practical limits

ตัวเลือกเดือนใช้ชื่อภาษาไทยและปี พ.ศ. แยกปุ่มเลือกเดือนจากกลุ่มปุ่มเลื่อนเดือน และ popup ที่ใช้คีย์บอร์ดได้ ตารางเน้นคอลัมน์วันที่ปัจจุบันตาม Asia/Bangkok ด้วยหัววันที่สีเขียว ป้าย “วันนี้” และพื้นหลังคอลัมน์สีอ่อนทุกทีม ไม่มีไฮไลต์ในเดือนอื่น ฟอร์มสลับกะอยู่กึ่งกลางพื้นที่เนื้อหา โดยหัวข้อและฟอร์มใช้ความกว้างเดียวกัน เลือกวันที่ของตนและคู่สลับในหน้าเดียว คู่สลับใช้ Dropdown ค้นหาด้วยชื่อ รหัสพนักงาน หรือทีมได้ รายชื่อเลื่อนภายในและรองรับคีย์บอร์ด แสดงเวลาและกะก่อน/หลังสลับก่อนส่ง การเปลี่ยนวันล้างคู่สลับที่เลือกไว้ ต้องเลือกใหม่ก่อนส่ง ไม่แสดงเวอร์ชันตาราง คำอธิบายการทดลองในหัวทีม หรือป้าย Alpha Demo ใน sidebar

หน้าคำขอของฉันใช้การ์ดตาม Prototype แสดงคู่สลับ กะที่ขอ สถานะ และขั้นตอนอนุมัติ มีปุ่มดูรายละเอียดของกะทั้งสองคน คำขอที่อนุมัติหรือปฏิเสธยังอยู่ในรายการ หน้าประวัติของฉันของพนักงานใช้ `/api/audit?view=personal` แสดงรายการสั้นเฉพาะการกระทำจากบัญชีตน เรียงจากล่าสุดและกรองก่อนจำกัดจำนวนผลลัพธ์ ไม่รวมผลอนุมัติที่หัวหน้าทำ การเปิดตาราง หรือเข้า/ออกบัญชี หน้าประวัติ Supervisor/HR ใช้ `/api/audit?view=activity` ภายใต้สิทธิ์เดิม ส่วน `/api/audit` ยังเก็บและอ่านหลักฐานเชิงเทคนิคตามสิทธิ์เดิม ไม่มี migration การลบประวัติ หรือการเปลี่ยนการเก็บ logs

ช่องกะที่เกิดจากการสลับมีขอบและสัญลักษณ์สีม่วง โดยยังคงสี M/N/O เดิม Desktop ดูสรุปเมื่อชี้เมาส์หรือใช้คีย์บอร์ด มือถือใช้แตะ ตามคำปรับล่าสุดของผู้ใช้ กล่องแสดงเฉพาะชื่อคู่สลับ ทีม และกะเดิม → กะใหม่ ไม่มีวันที่ เวลา สถานะอนุมัติ หรือปุ่มส่งคำขอ กดกะของตนในปฏิทิน 7 วันหรือตารางเดือนเพื่อเปิดฟอร์มวันที่นั้นได้ รวมกะที่สลับแล้ว โดยใช้กะและเวอร์ชันปัจจุบัน เครื่องหมายสีม่วงเป็นปุ่มดูสรุปแยกจากปุ่มกะ ไม่ซ้อนปุ่มไว้ภายในกัน กะของคนอื่นเปิดได้เฉพาะสรุป ปุ่มส่งคำขอหลักยังใช้ได้ แสดงเฉพาะหลักฐานที่เวอร์ชัน วันที่ และกะตรงกับ assignment ปัจจุบัน เมื่อสลับซ้ำจะแสดงที่มาล่าสุดของช่องนั้น หลักฐานเก่ายังอยู่ คำขอรออนุมัติ อนุมัติครั้งแรก หรือถูกปฏิเสธไม่มีเครื่องหมาย การเปลี่ยนเดือนหรือกรองทีมไม่เปลี่ยนที่มาของข้อมูล ไม่ต้องเพิ่ม migration หรือ seed สำหรับเครื่องหมายนี้

`pnpm test` มี 30 automated tests ครอบคลุม request/first approval หลัง restart, canonical date หลังเปิดเดือนอื่น, atomic swap, rollback เมื่อ inject failure, role/scope/order rejection, rejection reason, duplicate/replayed/concurrent decisions, stale versions, cross-month/year consecutive days รวมคู่สลับ C, protected audit/90-day baseline, 9 profiles, อัปเกรดฐานแบบ 7 บัญชีเดิมและรัน migration/seed ซ้ำโดยเก็บข้อมูล, A–D read scope/HR published filter, External isolation, candidate scope ครบทุกทีม, ตำแหน่ง/กะ/ownership validation, B → A, A → D และ B → C approval order, ไม่ให้ใช้ขั้นอนุมัติเดียว และคำขอเก่าที่ snapshot ยังไม่มี team code โดยไม่แก้ payload เพิ่มการตรวจที่มากะสำหรับทุกบัญชีที่อ่านตารางได้ การสลับซ้ำ restart ข้อมูลกะที่เปลี่ยนไป และการคงหลักฐานเดิม Tests ใช้ฐานข้อมูลเฉพาะ suite

`scripts/browser-check.mjs` ใช้ Playwright ที่ติดตั้งไว้กับ Chromium ตรวจ desktop/mobile, session แยก, A → B และ B → A, ยื่นคำขอ Refresh อนุมัติสองขั้น และดูประวัติ `scripts/four-team-browser-check.mjs` เพิ่ม A → D บน desktop และ B → C บนมือถือ ยืนยันว่าตารางเปลี่ยนหลังอนุมัติครบและหลักฐานไม่ซ้ำ `scripts/role-browser-check.mjs` ตรวจ 9 บัญชีทุกบทบาท เมนู หน้าที่เตรียมไว้ ตัวกรอง/ค้นหา ตารางรายปี ปุ่มที่ปิด ตารางแบ่งทีม และ External ไม่โหลดข้อมูลภายใน เก็บภาพใน `.local/ui-check/` ซึ่งไม่เข้า Git ใช้ฐานข้อมูลแยกสำหรับรอบตรวจรับ ไม่สร้างคำขอทดสอบทับเดโมปัจจุบัน กำหนด `PLAYWRIGHT_PACKAGE` เป็นตำแหน่ง package และ `BROWSER_EXECUTABLE` เป็น executable ได้

รัน `pnpm test:browser` จาก root หลังเตรียม Playwright/Chromium และ PostgreSQL คำสั่งใช้ `apps/api/test/browser.ts` สร้างฐานข้อมูล `tnc_browser_*` ชั่วคราว ใช้ origin `localhost:3021` แล้วปิดและลบเฉพาะฐานของ suite ไม่เขียน `.env` หรือแก้ฐานเดโมปัจจุบัน อย่ารัน workflow script โดยตรงกับข้อมูลเดโมที่ต้องการเก็บ

`scripts/swap-markers-browser-check.mjs` ตรวจสรุปที่แสดงเฉพาะคู่สลับและกะเดิม/ใหม่ หัวหน้าทีมที่ไม่เกี่ยวข้องและ HR อ่านได้ตามตาราง hover/คีย์บอร์ด/แตะ การปิดเมื่อเลื่อนตาราง การเปลี่ยนเดือน/กรองทีม การเปิดฟอร์มจากกะของตนที่สลับแล้วผ่านปฏิทินทั้งสองแบบด้วยเมาส์ คีย์บอร์ด และสัมผัส โดยใช้วันที่และกะปัจจุบัน มีปุ่มข้อมูลแยกและไม่ซ้อนปุ่มภายในกัน ตรวจชื่อยาวที่มีข้อความคล้าย HTML โดยไม่สร้างคำขอจากการดูรายละเอียดหรือเปิดฟอร์ม

การตรวจอัตโนมัติไม่แทน hands-off test โดยคนนอกทีม: ยังต้องให้คนจริงลองบน desktop และมือถือโดยไม่ช่วยคลิก พร้อมซ้อมเวลา 4 นาที ไม่ได้รัน load test ขนาด NFR และยังไม่พิสูจน์การเก็บครบ 90 วันตามเวลาจริง ไม่มีการรับรองว่า production, SSO, Power Apps, staffing หรือกฎบริษัทพร้อมแล้ว

เพิ่มการทดสอบยกเลิกคำขอ 6 ข้อใน API suite: persistence/restart/migration/seed ซ้ำโดยเก็บหลักฐาน, actor/origin/version/input, การปิดสิทธิ์หลังคำตัดสินแรก, หน้าหัวหน้าที่เปิดไว้ก่อนยกเลิกและคำสั่งซ้ำ, cancellation/approval race สำหรับ A → D และ B → C และ rollback เมื่อแจ้งเตือนล้มเหลว Browser suite เพิ่ม `scripts/cancellation-browser-check.mjs` สำหรับ desktop/mobile การเปิด Review แล้วพนักงานยังยกเลิกได้ กลับโดยไม่ส่งคำสั่ง saving state/ป้องกันกดซ้ำ retry ด้วย key เดิมหลัง network error Refresh/ประวัติ ยื่นใหม่ และ conflict บนหน้าฝั่งพนักงานหรือหัวหน้าที่ข้อมูลเก่า ใช้ฐานเฉพาะ suite เช่นเดียวกับ workflow เดิม

ข้อกำหนดและ backlog ไม่ได้รับการแก้ในงานนี้ ตรวจ parity แยกจากผลทดสอบแอป เพื่อไม่ทำให้การผ่าน prototype ถูกตีความว่า backlog ทุกฟีเจอร์เสร็จแล้ว
