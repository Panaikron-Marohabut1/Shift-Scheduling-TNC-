---
target: Shift Employee / กะของฉัน
total_score: 19
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Panor\\Desktop\\Project\\Shift-Scheduling-TNC-\\shift\\app.js"
target_fingerprint: "sha256:fd6277b432976aa5132f247c0754b9e68b896f7e6a3c9d041de542b0192e46df"
target_path: "C:\\Users\\Panor\\Desktop\\Project\\Shift-Scheduling-TNC-\\shift\\app.js"
timestamp: 2026-09-22T23-52-01Z
slug: shift-app-js
---
Method: dual-agent (A: d92aa388 · B: 8c0bb603; detector rerun in foreground after B’s execution was permission-blocked)

## UX/UI critique — “กะของฉัน” for Shift Employee

Reviewed the screenshot shared by the user and the Shift Employee view in `renderOperatorView()` plus its request flows. This is a critique only; no prototype changes were made.

### Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Shows current shift, quota, and request statuses, but rejection looks like pending and post-submit feedback does not reassure about next steps. |
| 2 | Match System / Real World | 1/4 | Workers must interpret codes such as `V / B / S / H`, `MTh`, and jargon like “±7 วัน” and “2 ฝ่าย”. |
| 3 | User Control and Freedom | 1/4 | A day-card can open a consequential swap flow on tap; there is no clear way to withdraw a pending request. |
| 4 | Consistency and Standards | 2/4 | Status wording varies, and rejected requests use the same amber styling as pending requests. |
| 5 | Error Prevention | 3/4 | Validation and request limits are enforced, but day-off rules appear at submission and a swap partner is pre-selected. |
| 6 | Recognition Rather Than Recall | 2/4 | The roster is glanceable, but codes are not explained on this page; users must recall dates in some request forms. |
| 7 | Flexibility and Efficiency | 2/4 | Several entry points exist, but no clear fast path for the most common task and duplicate paths may confuse new users. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Strong dark hero, but small labels and equally prominent request buttons compete for attention. |
| 9 | Error Diagnosis and Recovery | 2/4 | Some inline rule checks help, but errors can be short-lived toasts with no actionable recovery. |
| 10 | Help and Documentation | 1/4 | No shift-code legend, approval explanation, or contextual guidance on the “กะของฉัน” page. |
| **Total** |  | **19/40** | **Poor — major UX improvements needed before frontline use.** |

### Design specificity verdict

**The page feels like a factory shift product, but it is still shaped more for a demo than for a worker on shift.** The Thai-first interface, current-shift hero, seven-day roster, request quota, and approval chain show real domain context. But technical shift codes, developer test controls, the role switcher, and supervisor-oriented notifications leak the prototype scaffolding into the employee experience.

The screenshot’s strongest element is the prominent shift card. The seven compact day cards and request panel are visible, but several small labels and codes will be harder to read quickly, especially on a phone.

### Cognitive load

**High: 5 of 8 checklist items fail.**

- **Fails — Chunking:** seven separate day cards and four peer request actions are presented at once.
- **Pass — Grouping:** cards separate the roster, request center, and request status.
- **Pass — Visual hierarchy:** the current shift hero is the most prominent element.
- **Fails — One decision at a time:** checking a shift and initiating several different request types compete on one screen.
- **Fails — Minimal choices:** the request flow can expose 18–21 colleague choices; some forms offer 5–20 shift codes.
- **Fails — Working memory:** users must remember what codes mean and whether a colleague/date combination is eligible.
- **Fails — Progressive disclosure:** English labels, code names, request rules, and small-print guidance appear before they are needed.

### What’s working

1. **The hero answers “what is my shift today?”** Date, shift, employee code, and supervisor are grouped together in a high-contrast card. (app.js:1728–1795)
2. **The quota is shown before the user starts a request.** “สิทธิ์เหลือ X/2 ครั้ง” helps avoid wasted effort, and the limit is enforced in the flow. (app.js:1828–1836)
3. **The seven-day strip is oriented around upcoming shifts**, rather than making the worker navigate a full calendar first. (app.js:1752–1766)

### Priority issues

**[P1] Day-cards are accidental request triggers** — each day card, including off/leave days, opens a swap modal on click; the modal pre-selects a colleague the worker did not choose. (app.js:1801–1814)
**Why it matters:** the main reading surface doubles as a consequential action, raising accidental-submission risk.
**Fix:** make day cards informational; use a clearly labeled “ขอสลับกะ” action and start the colleague field with “เลือกเพื่อนร่วมงาน”.

**[P1] The post-submit destination exposes developer test controls** — “Interactive Test Cases Sandbox”, spec IDs, and simulation buttons appear above the employee’s own requests. (app.js:1373–1445)
**Why it matters:** after a high-stakes submission, the employee lands in a test-looking interface rather than receiving confirmation.
**Fix:** hide the sandbox outside development and show a confirmation that names the next approver and the current request status.

**[P1] Forecast shifts can look like confirmed shifts** — `hasData` is computed in the employee view but not used to label forecast roster days as unconfirmed. (app.js:1728–1731)
**Why it matters:** workers may rely on a projected roster as if it were officially published.
**Fix:** show a clear “ตารางคาดการณ์ — ยังไม่ประกาศอย่างเป็นทางการ” banner and distinguish projected days from confirmed days.

**[P2] Swap partner selection is a large, privacy-sensitive blind list** — the picker can show many colleagues and includes phone numbers, but not their shift on the selected date. (app.js:2715–2723)
**Why it matters:** the worker must guess who is compatible, while phone numbers are exposed in a flow that does not need them.
**Fix:** remove phone numbers, filter to eligible partners, and show their relevant shift/date before selection.

**[P2] Critical guidance is too small and too technical** — day labels are 9px, request sublabels are 10px, and key shift codes are unexplained on this page. (app.js:1807–1810, 1830–1864)
**Why it matters:** a worker checking the page quickly or on a phone can miss the meaning or restrictions.
**Fix:** use Thai-first labels, raise functional text size to at least 14px, and keep codes secondary with a visible legend.

**Suggested commands:** `/impeccable clarify` for plain-language labels and codes; `/impeccable harden` for accidental actions and reliable states; `/impeccable adapt` for small screens; `/impeccable polish` as the final pass.

### Persona red flags

- **First-week worker, low literacy, using a phone:** the day-card tap opens a request flow unexpectedly; “ต่างทีม” eligibility is easy to miss in small text; shift codes and English parentheticals add translation effort. The screenshot is desktop-width; the source indicates the request panel moves below the hero at narrower widths, so mobile visibility should be checked.
- **Busy employee checking tomorrow’s shift:** the second day card requires decoding a small `N` badge and 9px label. The hero’s “วันที่ 0 / 7 วัน” can also be mistaken for a date rather than a consecutive-work counter. (app.js:1788–1795)

### Detector evidence

The bundled detector was run on `shift/`. It reported **19 findings: 18 warnings and 1 advisory**. Running it directly on `shift/app.js` returned **0 findings**; the directory scan findings were in shared CSS/shell styles and were not all specific to this page. No browser overlay was injected: browser automation/injection is not exposed here, so the supplied screenshot and source were the visual evidence.

- **`shift/app.css` — 4:** `overused-font` (line 103); `layout-transition` (367, 2116); `side-tab` (1528).
- **`shift/index.html` — 15:** `low-contrast` (three findings, line 0 from static style analysis); `undersized-ui-text` (two findings: 10px “บทบาท:” and “2 รายการใหม่”); `tiny-text` (six findings, 10–11px); `gpt-thin-border-wide-shadow` (one advisory); `overused-font`; `side-tab`; `dark-glow`. The line-0 entries are aggregate analysis rather than precise source locations.

Manual source review additionally found an unfocusable `div` used as an interactive day-card, decorative SVGs without hidden semantics, and rejected requests styled as pending. These were **manual observations, not detector results**. (app.js:1807–1810, 1876–1883)

### Minor observations

- “วันหยุด (Off) (O)” repeats the same idea as Thai, English, and a code.
- The seven-day strip does not roll into the next month when the current month ends.
- “วันนี้” uses a demo date, which may not match the real date used elsewhere in the prototype.
- The global notification examples include supervisor approval wording that may not fit an employee.
- Rejected requests use an amber pending-style pill.
- The simple employee view has no month navigation; older/future views require entering the full schedule grid.

### Questions to consider

1. If the day strip’s main job is to answer “what shift am I working?”, should tapping a day ever start a request directly?
2. Should the request flow show only people who are eligible for the chosen date, instead of asking the worker to understand the swap rules?
3. What should the page treat as the source of truth when it has only forecast data: show it as a forecast, or hide it until the schedule is published?
