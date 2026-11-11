# Central swap quota implementation plan

> **For agentic workers:** Use Superpowers executing-plans or subagent-driven-development. Run the new workflow test before implementing the endpoint, then run it against disposable PostgreSQL.

**Goal:** Give the Manager one persisted, company-wide swap quota that starts at two requests per person per month. Changes take effect in the next Bangkok calendar month.

**Architecture:** Store monthly overrides in a backend-only PostgreSQL schema. Use the existing session guard and audit log for the Manager settings API. The Manager screen shows the effective cap and the cap scheduled for next month.

**Spec:** [Business rules SW-04 through SW-07 and Q2](../01-requirements/01-spec/2026-11-04-01-business-rules-master.md).

## Milestone 1A

- [x] Add a workflow test for the default, Manager authorization, invalid input, next-month scheduling, and attributable audit history. The new test initially failed because the API route did not exist.
- [x] Add the quota table and Manager settings API. Serialize edits, check the effective Bangkok month at the write, and reject stale settings revisions so a second Manager cannot overwrite a newer edit from an older screen.
- [x] Add a distinct central swap quota control to the Manager screen. Read its values from the API. Identify the browser-only control while the legacy request flow is still in use.
- [x] Verify current and next month values, a race between two edits, and a stale retry. The local API suite passed all 36 tests, the API built, and the web safety check passed.

The repository-wide check stops at the existing legacy-prototype link in `.docs/02-design/prototype/index.md`. The settings screen still needs an interactive smoke test. Migration 005 was exercised only in a disposable local database.

## Milestone 1B

- [x] Connect the quota check to final approval under the existing per-employee transaction lock for new local pilot requests. Test two requests competing for the last slot and an injected failure that rolls back both the schedule and the quota charge.
- [x] For new local pilot requests, allow timely submissions to be approved after the shift date while the month is open. Verify expiry at 24 hours and closure at Bangkok midnight on the first of the month with a controlled clock.
- [x] Test the overnight example in Q3. The roster date determines whether a new submission is late. The request creation timestamp determines its 24-hour lifetime.
- [x] Test the Q5 cutover in disposable local PostgreSQL. Preserve existing approvals, close pending requests for the locked month, and close pending legacy requests for the new month with an in-app notice to resubmit. Keep the original records without a quota charge.

The pilot is off by default. The workflow suite opts in with `ENABLE_LOCAL_SWAP_POLICY=true` only for new requests in disposable local PostgreSQL. The pilot covers the existing same-day swap route. The app derives expiry and month closure for new requests from timestamps and stores the closure of old requests when the cutover is applied.

## สรุปส่งต่องาน

- **Milestone 1A — ตั้งค่าโควตากลาง** เพิ่ม API และหน้าตั้งค่าของ Manager ค่าเริ่มต้น 2 ครั้งต่อคนต่อเดือน ใช้เพดานเดียวทุกทีม และค่าใหม่เริ่มเดือนถัดไป ทดสอบสิทธิ์การแก้ การบันทึกพร้อมกัน และหน้าจอเก่าที่พยายามเขียนทับ
- **Milestone 1B — อนุมัติและอายุคำขอ** ทดสอบการหัก 1 สิทธิ์จากผู้ยื่นตอนอนุมัติครบ การกดแข่งกันสำหรับสิทธิ์สุดท้าย การย้อนทั้งตารางและโควตาเมื่อบันทึกพลาด การอนุมัติข้ามวันภายใน 24 ชั่วโมง และการปิดคำขอเมื่อตารางเดือนก่อนล็อก
- **Milestone 1B — ซ้อมเปลี่ยนกฎ Q5** เพิ่มเครื่องมือดูรายการก่อนลงมือและโหมดบันทึกที่ใช้เฉพาะฐานทดสอบแยก การปิดคำขอ หลักฐาน และแจ้งให้ยื่นใหม่อยู่ในรายการบันทึกเดียวกัน ถ้าขั้นใดพลาดให้ย้อนทั้งหมด ทดสอบการรันซ้ำ การยื่นใหม่ และการปฏิเสธคำขอรูปแบบเก่าหลังเริ่มกฎใหม่
- **Milestone 2A — สายอนุมัติสำหรับสลับวันเดียว** Backend เดโม่ให้หัวหน้าทั้งสองทีมของพนักงานอนุมัติได้ทั้งสองลำดับและเปลี่ยนตารางเมื่อครบสองฝ่าย คำขอของหัวหน้ากะส่งให้ Manager คนเดียว หน้ารายการและปุ่มของ Manager ใช้สิทธิ์ที่ Backend ส่งมา
- **Milestone 2B — ฟอร์มและคำขอสลับกะวันเดียวหรือสองวัน** ในโหมดทดสอบใช้ฟอร์มเดียว เลือกคู่สลับและวัน แล้วแสดงผลก่อน–หลังจากตารางส่วนกลาง ระบบตรวจตารางของทั้งคู่รวมทุกวันที่กระทบ ตรวจเวอร์ชันของทุกช่องก่อนอนุมัติ และบันทึกทุกช่องพร้อมกันโดยหัก 1 สิทธิ์
- **Milestone 3–4** ยังเหลือการล็อกตารางส่วนกลางสำหรับ HR และสิทธิ์จัดการคนของ Admin

การซ้อม Q5 ให้ดูรายการล่วงหน้าด้วย `pnpm --filter @tnc/api exec tsx src/requests/swap-policy-cutover.ts YYYY-MM OPERATOR_ID` บนฐานทดสอบที่แยกไว้ รายการนี้ใช้เตรียมแจ้งล่วงหน้าด้วยขั้นตอนของผู้ดูแล ส่วนข้อความในแอปเกิดตอนปิดคำขอจริง โหมด `--apply` ใช้หลังขึ้นเดือนที่เลือกตามเวลาไทยเท่านั้น ให้หยุด API ที่เขียนฐานทดสอบก่อนถึงรอยต่อเดือนและเปิดอีกครั้งหลังบันทึกสำเร็จโดยเปิดกฎใหม่ หลักฐานของการซ้อมระบุบัญชีฐานข้อมูลที่รันคำสั่งและรหัส Manager เดโม่ที่ระบุในคำสั่ง

รอบวันที่ 10 พฤศจิกายน 2569 ใช้เฉพาะข้อมูลสังเคราะห์ใน PostgreSQL เครื่องนี้ ยังไม่ได้รัน migration บน Supabase แจ้งผู้ใช้จริง หรือทดสอบหน้าจอแบบกดใช้งานในเบราว์เซอร์

Milestone 2A ผ่าน API ทั้ง 41 รายการ รวมการอนุมัติพร้อมกัน การปฏิเสธคู่สลับผิดประเภท และกรณีไม่มี Manager ให้มอบหมาย ในเดโม่จะสร้างคำขอของหัวหน้ากะเมื่อระบุ Manager ที่ใช้งานอยู่ได้คนเดียวเท่านั้น การกำหนดผู้รับผิดชอบเมื่อมี Manager หลายคนและผู้อนุมัติแทนยังรอตาม Q4 คำขอเดิมที่ไม่ได้อยู่ในโหมดเดโม่ใช้ลำดับเดิม

Milestone 2B ทดสอบบน Chromium ด้วยบัญชีสังเคราะห์แยกกัน ครอบคลุมพนักงานยื่นสองวันและหัวหน้ากะยื่นวันเดียวให้ Manager อนุมัติ ชุดทดสอบ API ครอบคลุมตารางที่เปลี่ยนวันที่สองระหว่างรอ การย้ายทีมของคู่สลับหลังมีผู้อนุมัติคนแรก และกรณีแต่ละวันผ่านแต่รวมกันทำงานติด 7 วัน เมื่อหัวหน้าสองคนเปิดคำขอเดียวกันก่อนอนุมัติ หลักฐานเก็บเวอร์ชันที่แต่ละคนเปิดตรวจ

รันซ้ำได้โดยตั้ง `CENTRAL_SWAP_BROWSER_CHECK=true` แล้วรัน `pnpm test` ในสภาพแวดล้อมทดสอบในเครื่อง หากติดตั้ง Playwright และ Chromium ไว้นอกโปรเจคให้ระบุ `PLAYWRIGHT_PACKAGE` และ `BROWSER_EXECUTABLE` ชุดทดสอบสร้างฐาน PostgreSQL แยกและใช้บัญชีสังเคราะห์ กฎเวลาพักเพิ่มเติมและการบังคับรูปแบบ 2 วันทำงาน / 2 วันหยุดยังรอคำตอบในหมวด 7 ของเอกสารหลัก โหมดนี้ยังปิดไว้ตามค่าเริ่มต้นและยังไม่ได้เปิดบน Supabase

ตรวจรวม Milestone 1–3 รอบส่งมอบวันที่ 10 พฤศจิกายน 2569 ผ่าน 44 เทสต์ รวมการยกเลิกที่รอเขียนจนเกิน 24 ชั่วโมง การอนุมัติสองลำดับ เหตุผลและเวลาที่ไม่อนุมัติ การตั้งโควตาเดือนถัดไปจากหน้า Manager และ CSV ของ HR บน Chromium โหมดทดลองกำหนดให้ใช้ฐานในเครื่องแยกทั้งสามงาน ดูหัวข้อทดลอง Milestone 1–3 ใน [README](../../README.md)

### แก้ความหมายของการสลับกะคนละวัน

- [Business Rules หมวด 5 ตัวอย่าง B](../01-requirements/01-spec/2026-11-04-01-business-rules-master.md) ให้คู่สลับรับกะของผู้ยื่นในวันหนึ่ง และให้ผู้ยื่นรับกะของคู่สลับอีกวันหนึ่ง โดยผู้รับกะหยุดอยู่เดิมทั้งสองวัน ตรวจผลรวมก่อนเปลี่ยนตารางสี่ช่องพร้อมกันในคำขอเดียว
- หน้าฟอร์มและ Backend ตรวจทิศทางเดียวกัน คำขอแบบเดิมที่ยังรอและมีคนมีกะอยู่แล้วในวันที่จะรับกะ จะแจ้งให้ปิดคำขอแล้วเลือกวันที่ใหม่ ผู้มีสิทธิ์ยังปิดรายการเดิมตามขั้นตอนปกติได้ และประวัติที่อนุมัติไปแล้วคงตามผลเดิม
- ฐาน pilot ที่สร้างใหม่มีตัวอย่างทั้งสลับภายในวันเดียวและทำแทนกันคนละวัน ฐานที่สร้างก่อนหน้านี้ใช้ตารางสมมติเดิม
