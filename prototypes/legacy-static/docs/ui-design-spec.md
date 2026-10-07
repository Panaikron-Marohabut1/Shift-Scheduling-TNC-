# ShiftFlow — UI Design Spec (Prototype → Production)

**Status:** Primary source of truth for the UI prototype. Derived from, and superseding, `shift/index.html` (v0 demo). Requirements authority: `.docs/01-requirements/proposal.md` and `.docs/01-requirements/backlog.md`.

**Intent:** This is a **refinement, not a redesign**. The incumbent visual identity (navy/mint palette, Inter, card-based layout, sidebar shell, Thai-language UI) is preserved. This document improves information hierarchy, page structure, user flow, spacing, state coverage, and production readiness. It adds no new product scope: only the screens that exist in the current prototype are specified; stub nav pages (People / Reports / Settings) and authentication are listed under Deferred.

**Visitor mode:** Operate. Every surface exists to complete a task fast and correctly. Scanability, status clarity, and validation feedback outrank expression.

---

## 1. Product context (condensed, confirmed)

- ShiftFlow replaces Excel + phone-based scheduling for the Production Department (24/7 operation).
- Roles: **Shift Supervisor** (author/approve), **Shift Operator** (view/request), **HR** (view/export approved data), **Contractor / Van Driver** (read-only daily transport view).
- Approved schedule is the single source of truth; all changes flow through validation + approval.
- UI language: **Thai** (primary), English technical terms allowed where standard (OT, CSV, Gate).

### Authoritative shift codes (backlog §3 — replaces prototype's D/N/M/O set)

| Code | Meaning (UI label) | Time | Visual family |
|---|---|---|---|
| M | กะเช้า/กลางวัน (Normal) | 07:30–19:30 | Amber |
| MT | กะเช้า/กลางวัน + OT | 07:30–19:30 + OT | Amber + OT marker |
| N | กะกลางคืน (Normal) | 19:30–07:30 | Indigo |
| NT | กะกลางคืน + OT | 19:30–07:30 + OT | Indigo + OT marker |
| D | เวลาปกติ (Hours 08:00–17:00) | 08:00–17:00 | Blue |
| O / blank | วันหยุด | — | Neutral |
| V | ลาพักร้อน | Leave | Slate, lettered |
| B | ลากิจ | Leave | Slate, lettered |
| S | ลาป่วย | Leave | Slate, lettered (alert tint when emergency) |
| H | วันหยุดนักขัตฤกษ์ | Holiday | Warm neutral |

OT variants render as their base color with a right-edge **OT stripe** (3px) — never as a separate hue. Leave codes de-emphasize (muted) so working shifts carry the visual weight.

---

## 2. Design principles

1. **Status before decoration.** Any schedule cell, request, or export must answer "what state is this in?" in under a second.
2. **Validate where you act.** Business-rule results appear at the point of action (cell editor, request form, approval card), not in a separate report.
3. **The grid is sacred.** The monthly schedule grid is the product's core; nothing may compromise its density, legibility, or navigation.
4. **Role-shaped surfaces.** Each role sees only what its job needs. The shell adapts per role; it does not show disabled doors.
5. **Every request tells its story.** Pending → decided, with reason, approvers, and effect on the schedule always visible.
6. **Dense but breathable.** 8pt rhythm, generous grouping inside cards, compact inside table cells.

---

## 3. Information architecture & app shell

### 3.1 Navigation model (per role)

The current demo shows one supervisor nav for everyone, and non-supervisor roles have a single flat view. The improved IA:

| Surface | Supervisor | Operator | HR | Driver |
|---|---|---|---|---|
| ภาพรวม (Overview) | ✓ primary | — | — | — |
| ตารางกะ (Schedule, month grid) | ✓ | ✓ (read-only, own team) | ✓ (approved only) | — |
| คำขอ (Requests) | ✓ approval queue | ✓ คำขอของฉัน (mine + new) | — | — |
| วันนี้ (Today / transport) | — | — | — | ✓ only surface |
| ข้อมูลและส่งออก (Data & Export) | — | — | ✓ primary | — |
| พนักงาน / รายงาน / ตั้งค่า | Deferred (§10) | — | — | — |

- Operator and Views get **tab-style nav in the sidebar** (ภาพกะของฉัน / ตารางกะทีม / คำขอของฉัน) instead of today's one-off view.
- Driver sees **no sidebar at all**: a minimal read-only page with header (logo, date, freshness) — reduces cognitive surface for external users.
- The role `<select>` in the topbar is a **demo affordance only** (prototype); in production, role comes from authentication. Spec marks it *demo-only, remove post-auth*.

### 3.2 App shell

- **Sidebar (278px):** brand, grouped nav (labels per role), workspace-health card (Supervisor only — coverage summary), user profile chip at bottom.
- **Topbar (88px / 70px mobile):** breadcrumb (section in Thai, not English view ids), page title (greeting on Overview only, view name elsewhere), global search (people/team), notification bell **with unread badge and dropdown list** (new — the current icon button is inert), profile avatar.
- **Mobile (<760px):** sidebar becomes overlay drawer (existing behavior kept); add a backdrop scrim to close and an accessible close control. Search collapses to an icon that expands the field; today it disappears entirely.
- Page header: eyebrow = current date (Buddhist calendar, e.g. วันศุกร์ที่ 4 กันยายน 2569), title, one-line purpose, contextual actions right.

---

## 4. Design foundations (codified from the incumbent CSS, extended)

### Tokens

- **Color:** `--navy #102A43` (shell), `--navy-2 #123B53` (primary action), `--mint #65D6C2` (accent/success), `--bg #F5F7FB`, `--ink #173B55`, `--muted #8297A4`, `--line #E0E8EE`, `--orange #E38B6D` (attention).
- **Shift palette:** M `#FFF1D9/#AC7725`, N `#E9E7FB/#6555A7`, D `#E4F4FB/#267493`, O/off `#F0F3F5/#8297A4`, leave `#EEF1F4/#5A6E7B` (slate), emergency S adds left tick `#C95E5E`.
- **Status:** approved `#168573` on `#E6F7F3`; pending `#AC7725` on `#FFF7E8`; rejected `#C95E5E` on `#FFF0F0`; draft `#5A6E7B` dashed border; info `#547087`.
- **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40. Cards pad 24 (16 mobile); section gap 24 (16 mobile).
- **Radius:** 8 (cell), 11 (buttons/inputs), 13 (brand mark), 17–20 (cards/modal).
- **Type (Inter):** page title 28–34/-0.055; panel title 15; body 13; table 10–11; labels 10–11 caps +0.16em tracking; numbers 24–27/-0.06.
- **Elevation:** one ambient shadow `--shadow: 0 8px 25px rgba(25,60,81,.05)`; raised only for modal/toast.
- **Breakpoints:** 1100 (grids collapse 4→2, side panels stack), 760 (mobile shell, all grids 1-col).

### Table grammar (applies to every data table)

Sticky header on scroll; sticky first column when horizontally scrollable; header 9–10px caps, letterspaced; row divider `#EDF1F4`; today column tinted; weekend columns `#FFF8F7` with warm weekday labels. Minimum cell hit area 44×44 on touch breakpoints.

---

## 5. View specs — Supervisor

### 5.1 ภาพรวม (Overview)

**Job:** In 30 seconds — staffing health today, what needs my decision, and what changed.

Layout (desktop): metric strip (4) → 2-col row [This week's schedule (1.55fr) | Items needing review (0.78fr)] → 2-col row [Coverage by team (1.35fr) | Recent activity (0.65fr)].

**Improvements over current:**

1. **Metric strip** — keep 4 cards (on duty today, pending requests, schedule coverage, issues to check). Each becomes **click-through**: pending → Requests queue; issues → Schedule filtered to violations. Add one-line context beneath value (already present); add delta only where meaningful (coverage). Remove the decorative icon color rotation: icons now signal family (people / approval / coverage / alert), tinted consistently.
2. **This week's schedule panel** — 7-day extract of the month grid with **today highlighted** and pending-request markers (amber dot) on affected cells. Header keeps "กำลังใช้งาน" badge but adds **schedule version** (e.g. `เวอร์ชันล่าสุดที่อนุมัติแล้ว · v2026-09-04 08:42`). CTA "ดูตารางกะทั้งหมด ›" → Schedule view. Legend stays in footer with **all backlog codes** (M, MT, N, NT, D, O, V, B, S, H) in a 2-row legend.
3. **รายการที่ต้องตรวจสอบ** — requests panel upgraded from flat rows to **triage cards**: avatar+name, request type chip (สลับกะ / เปลี่ยนวันหยุด / ลา / เปลี่ยนกะ), target date, and a **validation status icon** (✓ ผ่านการตรวจสอบ / ⚠ ต้องชี้แจง / ✗ ผิดเงื่อนไข) computed at submit time (§8). Cross-shift swaps show a `ข้ามกะ · ต้องอนุมัติ 2 ฝ่าย` chip. Approve ✓ / Reject ✗ buttons remain inline; **reject requires a reason modal** (US-033) — currently a one-click hard reject. Overflow CTA → Requests view.
4. **Coverage by team** — bars get threshold semantics: ≥95% mint, 80–94% amber, <80% red. Value labels stay `n / plan`. (Current demo's one green-for-all hides risk.)
5. **Recent activity** — becomes an **audit feed** (who / what / when), sourced from schedule history (US-012, E12), with "ดูประวัติทั้งหมด ›" linking to the Schedule view history panel.

**Empty states:** no pending requests → positive empty card "ไม่มีคำขอค้างตรวจสอบ" (not a blank panel); <4 metrics feed → hide empty metric, don't zero-fill.

### 5.2 ตารางกะ (Schedule, month grid)

**Job:** See and edit the whole month's roster safely.

Structure: panel head (title + month pager `[‹] ก.ย. 2569 [›]` + toolbar) → note strip (version/freshness) → grid (30 day columns × employee rows, sticky first column, totals column) → footer legend.

**Toolbar (new):** team filter chips (ทั้งหมด / Assembly A / Packaging / QC / Maintenance), shift-code filter chips, and a **view switch** (ตาราง / รายบุคคล). Draft/published state chip when edits pending (`ฉบับร่าง 3 รายการ · รอยืนยัน`).

**Grid improvements:**

- **Today column highlight** (mint left border on column header + tinted cells).
- **Validation markers in-cell:** violating cells show a corner notch — amber (warning: coverage risk, skill mismatch, pending approval) / red outline (blocked: >6 consecutive days, outside change window). Hover/focus tooltip names the rule violated. Nothing blocks *viewing*; blocks apply at save/submit.
- **Row summary columns** at right: วันทำงาน, วันหยุด, ชม.ทำงาน, OT ชม. (replaces the current bare "รวม" hours).
- **Totals row at bottom:** per-day headcount on shift (M/N/D) vs required coverage, red when understaffed (US-019).
- **Cell interaction:** click cell → shift editor modal (5.2.1). For operators/HR the same cell is read-only with a detail popover (who else on that shift).

**5.2.1 Shift editor modal (replaces current create-only modal):** fields พนักงาน (searchable), วันที่, ประเภทกะ (all codes incl. leave), หมายเหตุ; below the form a **live validation panel** listing rule checks with pass/warn/fail icons: (1) ≤6 วันติดต่อกัน, (2) ครอบคลุมตำแหน่ง, (3) ทักษะ/ตำแหน่งตรงกัน, (4) อยู่ในช่วงเวลาที่อนุญาต (±7 วัน — *business owner to confirm exact semantics*), (5) submitted ≥1 day ahead or flagged emergency. Failing hard rules disable the submit button with reason inline; warnings allow submit with confirmation note. Successful save → cell updates as draft → toast. Delete flow (US-011): from the same modal, destructive action with confirm + audit entry; never silent.

**History:** right-side collapsible "ประวัติการเปลี่ยนแปลง" list per visible month (who/when/what, old→new values) — scope-light implementation of E12 inside this view (audit is required by proposal §10.5).

### 5.3 คำขอ (Requests queue)

**Job:** Clear the approval queue correctly and fast.

Structure: filter tabs (ทั้งหมด / สลับกะ / เปลี่ยนวันหยุด / ลา / เปลี่ยนกะ) + status filter (รอดำเนินการ / อนุมัติแล้ว / ไม่อนุมัติ) + sort (oldest first default) → request list.

**Request card (expandable row):** collapsed = today's triage card. Expanded shows: full detail (both parties for swaps with their current vs proposed grids), **validation result list** (same 5-rule panel as 5.2.1, evaluated at decision time — US-032 requires final validation before approval), swap-quota check (`สลับกะเดือนนี้ 1/2 ครั้ง`, US-023), and for cross-shift swaps an **approval progress stepper**: `หัวหน้ากะ A ✓ → หัวหน้ากะ B ⏳` (US-024/US-034). Actions: อนุมัติ (with optional note), ไม่อนุมัติ (**reason required**, modal with textarea), ขอข้อมูลเพิ่มเติม (optional comment back to requester).

**States:** empty queue (positive message), filtered-empty ("ไม่มีคำขอประเภทนี้"), and a notice when a request's underlying schedule has changed since submission ("ตารางเปลี่ยนหลังคำขอนี้ถูกส่ง — ตรวจสอบอีกครั้ง").

---

## 6. View specs — Shift Operator (กะของฉัน)

**Job:** Know my next shift in one glance; request changes without calling anyone.

Structure: today's shift banner → my next 7 days → actions (request flows) → my request status + history.

**Improvements:**

1. **Today banner** — keep the hero (กะ + time + report point). Add for MT/NT: `รวม OT ส่งต่อ` line; add **rest-days counter** context where relevant (`ทำงานติดต่อกัน 4/6 วัน`).
2. **Next 7 days** — becomes an interactive strip: each day a compact card (date / code / hours / status chip: ได้รับมอบหมาย / รออนุมัติ / วันหยุด). Today highlighted. Requests initiated directly from a day card via its overflow menu (สลับกะ / เปลี่ยนวันหยุด / ลา) — clearer flow than generic buttons.
3. **Request swap flow (3-step modal):**
   - Step 1: เลือกกะของฉัน (prefilled from origin day card).
   - Step 2: เลือกเพื่อนร่วมงาน/กะเป้าหมาย — colleague picker **prefiltered to eligible employees** (skill/position match, own-schedule conflict-free), with ineligible entries shown disabled + reason ("ทักษะไม่ตรง", "กะชนกัน").
   - Step 3: ตรวจสอบ — validation preview (5 rules) + swap quota (`เหลือสิทธิ์สลับ 2/2 ครั้งเดือนนี้`) + reason field → submit → toast + status chip appears on day card.
4. **Day-off change flow:** pick my O day → pick new date → validation (coverage, consecutive days, ±7-day window) → reason → submit. Leave flow (V/B/S) separate: type, date(s), reason; **emergency sick** path allowed without the 1-day-ahead rule, explicitly labeled "ลาป่วยด่วน (บันทึกย้อนหลังได้)" (US-029).
5. **My requests** — replaces the single status card: list with status pill, submitted/decided dates, rejection reason when present (US-021), and a mini progress stepper for cross-shift items.
6. Team schedule tab (read-only month grid, §5.2 grid component reused, own row pinned on top) — per US-013.

---

## 7. View specs — HR (ข้อมูลและส่งออก)

**Job:** Get trustworthy approved data out, fast.

**Improvements:**

1. **Filter bar (new, missing today):** date range (default = current month), team, employee, shift code, status locked to `อนุมัติแล้ว` (visual lock + tooltip: HR sees approved data only, per proposal §5.3). Result count live (`186 รายการ`).
2. **Data table columns:** พนักงาน (ID + name), ทีม, วันที่/ช่วงเวลา, รหัสกะ, ชม.ทำงาน, OT ชม., สถานะ. Sortable columns; row count per current filter.
3. **Export panel:** dataset cards remain (ตารางกะประจำเดือน / OT และเบี้ยกะ), each labeled with what's inside and record count **matching the current filter**; add `ดาวน์โหลดล่าสุด` timestamp + `เปลี่ยนแปลงนับตั้งแต่ส่งออกล่าสุด: n` indicator so HR knows exports go stale (today's static "08:42" implies freshness it never verifies).
4. **OT review queue (new panel):** the "07 OT items" metric currently goes nowhere — becomes a list of MT/NT assignments pending review with approve-to-export action.

**Empty state:** filter yields no rows → message + "ล้างตัวกรอง" action. **Error state:** export failure → inline error on the card with retry, not only a toast.

---

## 8. View specs — Contractor / Van Driver (วันนี้)

**Job:** Drive the right people, from the right gate, using the latest list.

Principles: **read-only, no sidebar, mobile-first** (used on phones at gates).

Structure: header (ShiftFlow logo · วันที่ · **freshness badge** `อัปเดตล่าสุด 08:42 น. · เวอร์ชันที่อนุมัติล่าสุด`) → summary strip (pickup stops / first run / last run) → pickup table → acknowledgment card → access-scope note.

**Improvements:**

1. **Freshness is the hero.** Today's subtle badge becomes a prominent status line with automatic staleness state: fresh (<2h mint), aging (2–8h amber, `ข้อมูลอาจไม่ใช่ล่าสุด`), stale (>8h red banner: pull-to-refresh / contact dispatch number).
2. **Pickup table grouped by shift** (M / N / D sections, then by pickup point), each row: employee, pickup point, shift chip, report time. Print-friendly.
3. **Acknowledgment** (`รับทราบข้อมูล`) — persists per schedule version; once acknowledged, card collapses to `รับทราบแล้ว · 08:51` and reappears if the schedule updates again. (Currently a one-shot toast — the confirmation is lost.)
4. **Access scope note** kept (read-only, approved-only, no edit rights) — legal/PR value for external users.
5. Bilingual consideration: driver copy stays Thai; employee names render as stored (Thai or English) — do not transliterate.

---

## 9. Shared components & state coverage

| Component | Spec |
|---|---|
| Shift cell | 48–62px, radius 8, code letter + Thai micro-label; OT stripe for MT/NT; violation notch (§5.2) |
| Status pill | 5 states: ฉบับร่าง / รอดำเนินการ / อนุมัติแล้ว / ไม่อนุมัติ / รออนุมัติครบ 2 ฝ่าย (multi-approval variant) |
| Validation panel | Checklist rows: icon (✓/⚠/✗), rule name, plain-language reason, affected constraint (date/coverage/skill). Reused in 5.2.1, 5.3, 6.3 |
| Approval stepper | Supervisor A → Supervisor B, per-approval timestamp when done (US-034) |
| Modal | 470px, focus-trapped, Escape/scrim close, destructive actions red + confirm label naming the consequence |
| Toast | Bottom-center, 3s auto-dismiss, verb-first past-tense copy ("อนุมัติแล้ว — อัปเดตตารางกะเรียบร้อย") |
| Empty states | One-line explanation + single CTA when actionable; never a bare blank |
| Loading | Skeleton rows matching table geometry (month grid: 8 skeleton rows); never a blank flash |
| Error | Inline at the component level with ลองอีกครั้ง; global fallback only for total failure |
| Stale data | Freshness timestamps everywhere schedules appear; stale = amber/red state per §8.1 semantics |
| Audit/history | Append-only feed rows: avatar, actor, verb, object, old→new, time; used in Overview, Schedule history panel, HR |

**Accessibility floor:** visible focus rings on all interactive elements; cell colors always paired with the letter code (never color-only); contrast on mint/accent text ≥4.5:1 (darken mint text on light tints); Thai copy at table density never below 10px at 100% zoom; all modals announce via aria; sidebar drawer closes on Escape.

---

## 10. Terminology & copy normalization

Current demo mixes Thai/English freely ("ตารางกะ health", "coverage", "is ready", "waiting for your review"). Production copy rules:

1. UI chrome (nav, buttons, labels) → **Thai**, sentence case, verb-first for actions.
2. Technical nouns stay English where standard: OT, CSV, Gate, Export→ส่งออก.
3. Statuses always Thai: รอดำเนินการ / อนุมัติแล้ว / ไม่อนุมัติ / ฉบับร่าง.
4. Numbers: Arabic numerals; dates Buddhist calendar; times 24h `HH:mm น.`.
5. Directive tone, no exclamation marks, no machine-error jargon in validation messages ("เกิน 6 วันทำงานติดต่อกัน — ต้องมีวันหยุดอย่างน้อย 1 วัน").

---

## 11. Defects in the current prototype fixed by this spec

| # | Defect in `shift/index.html` | Fix |
|---|---|---|
| 1 | Shift codes D/N/M/O contradict backlog (D=day shift vs D=office hours; M=morning) | §1 authoritative code set + legend |
| 2 | Reject is one-click with no reason | §5.3 reason-required modal (US-033) |
| 3 | No validation feedback anywhere; rules exist only in docs | §5.2/§6.3 validation panels at point of action (E04) |
| 4 | Cross-shift dual approval invisible | §5.3 approval stepper (US-024/034) |
| 5 | Swap quota (2/month) not represented | §5.3 + §6.3 quota check (US-023) |
| 6 | Non-supervisor roles get improvised single views with supervisor chrome | §3.1 role-shaped IA |
| 7 | Notification bell is inert | §3.2 notification dropdown with unread badge (E09) |
| 8 | No draft vs approved distinction; edits vanish into toast | §5.2 draft chip + version labels (E09, auditability) |
| 9 | Coverage bars one-color, threshold-blind | §5.1.4 threshold semantics (US-019) |
| 10 | HR has metrics but no filters; export staleness faked | §7 filters + freshness indicators (E10) |
| 11 | Driver acknowledgment not persistent; freshness subtle | §8.1/§8.3 |
| 12 | Mobile: search disappears, drawer lacks scrim/close | §3.2 |
| 13 | Mixed-language copy throughout | §10 normalization |
| 14 | No empty/loading/error/stale states anywhere | §9 state matrix |
| 15 | No schedule history surface | §5.1.5 + §5.2 history panel (E12) |
| 16 | Month pager buttons are dead toasts | §5.2 functional paging (spec'd behavior, mock data may page) |

## 12. Deferred (out of this spec's scope)

- Authentication / login screen (E01) — demo role switcher stands in.
- Stub pages: พนักงาน (People, E02), รายงาน (Reports, E14, P2), ตั้งค่า (Rules config, E04 config surfaces).
- Real data layer, real-time sync, email/LINE notification channels.
- Implementation stays single-file vanilla until a framework decision is made at build time (PRODUCT.md `## Stack` — currently undecided).

---

*Derived: 2026-09-06. Incumbent visual identity preserved from `shift/index.html`; structural authority: this file.*
