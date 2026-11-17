# Test Results — TNC Shift Schedule (November 2026)

> **Source:** paper UAT sheets (scanned) and the team's Word test plan `TNC-Shift_schedule_test_plan.docx`.
> Transcribed into this file on 2026-11-17. Participants are identified by code only. The original scans are **not** stored in this repository: they stay in the team's OneDrive / Google Drive folder because the scan file names contain personal names.
>
> ⚠ marks a handwritten value that was hard to read. Check each ⚠ against the original scan before this file is used as final evidence.

## 1. Summary

| Item | Result |
| --- | --- |
| Unit, integration, and E2E cases | 18/18 passed (executed 2 November 2026) |
| UAT scenarios | 7/7 passed (sessions on 3 November 2026) |
| UAT participants | 10 real users: 8 employees (U01–U08), 2 shift supervisors (U09–U10) |
| UAT sessions completed | 20 (2 per participant) |
| Usability (modified 9-item SUS, see §5) | Mean 71.9 (employees 72.2, supervisors 70.8) |
| Median task time, old method → new system | M-01 1.25 → 1.0 min, M-02 5.0 → 3.0 min, M-03 3.5 → 2.0 min, M-04 2.0 → 1.0 min |

Exit criteria from the test plan (§6.3):

| Criterion | Status |
| --- | --- |
| All planned cases executed | Met |
| Core workflow cases IT-03, E2E-01, E2E-02, E2E-03 passed | Met |
| At least 90% of unit, integration, and E2E cases passed | Met (100%) |
| No open critical defect | Met (no defects found by the test cases; see [issue-log.md](issue-log.md)) |
| At least 10 UAT sessions with records | Met (20 sessions) |
| Task results and a SUS score from every participant | Partly met: task times recorded for all 8 employees; SUS item 10 is missing from every form (see §5) |

## 2. Test case results

Executed 2 November 2026. Test data uses 5 November as the swap date. Full case tables with actual results are in the [test plan](TNC%20Shift%20Schedule_test-plan.md), §3.

| Level | Cases | Passed | Failed |
| --- | --- | --- | --- |
| Unit (UT-01 to UT-08) | 8 | 8 | 0 |
| Integration (IT-01 to IT-07) | 7 | 7 | 0 |
| End-to-end (E2E-01 to E2E-03) | 3 | 3 | 0 |
| UAT scenarios (UAT01 to UAT07) | 7 | 7 | 0 |
| **Total** | **25** | **25** | **0** |

## 3. Participants and sessions

All participants are real users from the target roles. The paper sheets for employees were all headed "U01 to U03" and both supervisor sheets were headed "U04", so codes were assigned afterwards in scan order:

| Participant | Role | Source scan (file in team drive) |
| --- | --- | --- |
| U01 | Employee | `17112026scan_rotated.pdf` |
| U02 | Employee | `แบบประเมิน พนักงาน.pdf`, pages 1–4 |
| U03 | Employee | `แบบประเมิน พนักงาน.pdf`, pages 5–8 |
| U04 | Employee | `แบบประเมิน พนักงาน.pdf`, pages 9–12 |
| U05 | Employee | scan `…_202611150454.pdf` |
| U06 | Employee | scan `…_202611150455.pdf` |
| U07 | Employee | scan `…_202611150456.pdf` |
| U08 | Employee | scan `…_202611150457.pdf` |
| U09 | Shift Supervisor | `แบบประเมินหัวหน้ากะ.pdf`, pages 1–3 |
| U10 | Shift Supervisor | `แบบประเมินหัวหน้ากะ.pdf`, pages 4–6 |

### Session log

Session date for all sessions: 3 November 2026 (confirmed by the team). Employees: Session 1 = UAT01, UAT02; Session 2 = UAT03, UAT06, UAT07. Supervisors: Session 1 = UAT04; Session 2 = UAT05 (both supervisor sheets record **approve**).

| Session | Participant | Activity | Completed | Observation / feedback | Issue |
| --- | --- | --- | --- | --- | --- |
| UAT-S01 | U01 | View schedule, submit swap | Yes | — | — |
| UAT-S02 | U01 | Status, schedule after approval, swap limits | Yes | — | — |
| UAT-S03 | U02 | View schedule, submit swap | Yes | — | — |
| UAT-S04 | U02 | Status, schedule after approval, swap limits | Yes | Old method for checking status: "about 1–3 days" waiting for the supervisor. Handwritten note beside UAT07 ⚠ (unclear; transcribe from scan). | [ISS-04](issue-log.md) |
| UAT-S05 | U03 | View schedule, submit swap | Yes | — | — |
| UAT-S06 | U03 | Status, schedule after approval, swap limits | Yes | — | — |
| UAT-S07 | U04 | View schedule, submit swap | Yes | — | — |
| UAT-S08 | U04 | Status, schedule after approval, swap limits | Yes | Old method for checking status: "2–3 days" ⚠ | — |
| UAT-S09 | U05 | View schedule, submit swap | Yes | Problem noted on UAT01 about colours ⚠ (exact wording unclear). Submitting a swap took longer in the new system (5 min) than by phone (2 min). | [ISS-01](issue-log.md), [ISS-02](issue-log.md) |
| UAT-S10 | U05 | Status, schedule after approval, swap limits | Yes | Rated UAT07 (swap limits) 3/5. | — |
| UAT-S11 | U06 | View schedule, submit swap | Yes | — | — |
| UAT-S12 | U06 | Status, schedule after approval, swap limits | Yes | — | — |
| UAT-S13 | U07 | View schedule, submit swap | Yes | — | — |
| UAT-S14 | U07 | Status, schedule after approval, swap limits | Yes | Suggestion: show the employee's leave balances by type (annual, sick, personal, other), with totals and days used in the year. | [ISS-03](issue-log.md) |
| UAT-S15 | U08 | View schedule, submit swap | Yes | — | — |
| UAT-S16 | U08 | Status, schedule after approval, swap limits | Yes | UAT07: system response recorded as "swap quota used up / shift already changed", as expected. | — |
| UAT-S17 | U09 | Review a pending request | Yes | — | — |
| UAT-S18 | U09 | Approve a request | Yes | — | — |
| UAT-S19 | U10 | Review a pending request | Yes | — | — |
| UAT-S20 | U10 | Approve a request | Yes | — | — |

"Completed" comes from the UAT scenario results in the Word test plan (all passed) and from every sheet having a time and an ease score. Errors per task were **not recorded** on the sheets.

## 4. Before / after task times (M-01 to M-04)

**Method:** each employee wrote down the approximate time ("ใช้เวลาประมาณ … นาที") for the old method and for the new system on the UAT sheet. These are **self-reported estimates**, not stopwatch timings by an observer as the test plan describes. Ranges are entered as the midpoint. Answers given in days are excluded from the minute averages and reported separately.

| Task | Participant | Before: old method (min) | After: new system (min) |
| --- | --- | --- | --- |
| M-01 View shift schedule | U01 | 3 | 1 |
| | U02 | 0.5 | 0.5 |
| | U03 | 10 | 2 ⚠ |
| | U04 | 1–2 (1.5) | 0.5 |
| | U05 | 1 | 1 |
| | U06 | 2 | 1 |
| | U07 | 1 | 1 |
| | U08 | 1 | 1 |
| M-02 Submit swap request | U01 | 4 | 2 |
| | U02 | 5 | 4 |
| | U03 | 30 ⚠ | 10 |
| | U04 | 10 | 3 |
| | U05 | 2 | 5 |
| | U06 | 5 | 3 |
| | U07 | 10 | 3 |
| | U08 | 3 | 3 |
| M-03 Check request status | U01 | 2 | 1 |
| | U02 | about 1–3 **days** (excluded) | 1–2 (1.5) |
| | U03 | 25 ⚠ | 4 ⚠ |
| | U04 | 2–3 **days** ⚠ (excluded) | 3 |
| | U05 | 2 | 1 |
| | U06 | 5 | 2 |
| | U07 | 10 | 3 |
| | U08 | 2 | 2 |
| M-04 Verify approved swap | U01 | 2 | 2 |
| | U02 | 2 | 2 |
| | U03 | 27 ⚠ | 5 |
| | U04 | 3 | 0.5 |
| | U05 | 1 | 1 |
| | U06 | 3 | 1 |
| | U07 | 1 | 1 |
| | U08 | 1 | 1 |

### Summary per task

| Task | n before / after | Before median | After median | Change (median) | Before mean | After mean |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | 8 / 8 | 1.25 | 1.0 | −0.25 min (−20%) | 2.50 | 1.00 |
| M-02 | 8 / 8 | 5.0 | 3.0 | −2.0 min (−40%) | 8.63 | 4.13 |
| M-03 | 6 / 8 | 3.5 | 2.0 | −1.5 min (−43%) | 7.67 | 2.19 |
| M-04 | 8 / 8 | 2.0 | 1.0 | −1.0 min (−50%) | 5.00 | 1.69 |

The median is the headline figure because U03's large values pull the means up. With 8 participants and self-reported times, this comparison is descriptive, not a statistical test. For M-03, two employees described the old method as **days** of waiting for the supervisor's answer, which the minute figures do not capture.

## 5. Usability

### 5.1 Modified 9-item SUS

The SUS forms given to participants contained only items 1–9; **item 10 was missing** ("I needed to learn a lot of things before I could get going with this system"). A standard SUS score cannot be calculated. The team decided to report a modified score:

- Adjusted score per item as in standard SUS (odd items: response − 1; even items: 5 − response).
- Sum of the 9 adjusted scores (maximum 36), rescaled to 0–100 by × 100 / 36.

This score is **not** standard SUS and should not be compared directly with the SUS benchmark of 68.

| Participant | Role | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Adjusted sum (/36) | Score (0–100) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U01 | Employee | 5 | 3 | 3 ⚠ | 3 | 4 | 2 | 5 | 2 ⚠ | 4 | 26 | 72.2 |
| U02 | Employee | 5 | 3 | 4 | 1 | 4 | 3 | 4 | 3 | 5 | 27 | 75.0 |
| U03 | Employee | 5 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 28 | 77.8 |
| U04 | Employee | 5 | 2 | 4 | 4 | 4 | 2 | 4 | 2 | 4 | 26 | 72.2 |
| U05 | Employee | 3 | 4 | 3 | 2 | 3 | 3 | 4 | 4 | 3 | 18 | 50.0 |
| U06 | Employee | 5 | 3 | 4 | 4 | 4 | 2 | 4 | 2 | 4 | 25 | 69.4 |
| U07 | Employee | 5 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 28 | 77.8 |
| U08 | Employee | 5 | 2 | 4 | 2 | 4 | 3 | 5 | 1 | 5 | 30 | 83.3 |
| U09 | Supervisor | 4 | 2 | 4 | 3 | 4 | 2 | 4 | 2 | 4 | 26 | 72.2 |
| U10 | Supervisor | 5 | 3 | 4 | 2 | 4 | 3 | 4 | 3 | 4 | 25 | 69.4 |

| Group | Mean | Median | Range |
| --- | --- | --- | --- |
| Employees (n = 8) | 72.2 | 72.2 | 50.0–83.3 |
| Supervisors (n = 2) | 70.8 | 70.8 | 69.4–72.2 |
| All (n = 10) | 71.9 | 72.2 | 50.0–83.3 |

Item 2 ("I found the system unnecessarily complex") had the lowest mean adjusted score, 2.4 out of 4: 5 of 10 participants answered 3 (neutral) or higher. Item 1 ("I would like to use this system frequently") had the highest, 3.7 out of 4.

### 5.2 Ease rating per task (1 = very hard, 5 = very easy)

| Task | Responses | Mean |
| --- | --- | --- |
| UAT01 View own schedule | 5, 4, 4, 5, 4, 5, 4, 5 | 4.50 |
| UAT02 Submit swap request | 4, 5, 5, 5, 3, 4, 4, 5 | 4.38 |
| UAT03 Check request status | 4, 5, 5, 5, 5, 5, 5, 5 | 4.88 |
| UAT06 Verify schedule after approval | 4, 4, 5, 5, 5, 4, 5, 5 | 4.63 |
| UAT07 Swap restrictions | 5, 4, 4, 4, 3, 4, 4, 5 | 4.13 |
| UAT04 Review pending request (supervisors) | 5, 4 | 4.50 |
| UAT05 Approve request (supervisors) | 5, 4 | 4.50 |

Employee responses are listed in order U01–U08; supervisor responses in order U09–U10.

## 6. Limitations of this evidence

- Task times are self-reported estimates, not observer stopwatch timings, and errors per task were not recorded.
- SUS item 10 is missing, so the usability score is a modified 9-item score.
- Participant codes were assigned after the sessions, from scan order.
- Values marked ⚠ need to be checked against the original scans.
