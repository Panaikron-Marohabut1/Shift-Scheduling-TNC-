# Comparison Table — Before vs After

> Before = the current Excel + phone process. After = the new system, measured in UAT sessions with 10 real users (U01–U10) on 3 November 2026.
> Each row links to its evidence: a UAT result, a test case, or the test scope.

## Task measurements (from the test plan, §5.2)

| Item | Before | After | Change | Measured with | Evidence |
| --- | --- | --- | --- | --- | --- |
| M-01 View shift schedule | 1.25 min | 1.0 min | −0.25 min (−20%) | Self-reported approximate time on the UAT sheet, 8 employees (U01–U08); median | [UAT results §4](../Test_plan/2026-11-03-uat-results.md#4-before--after-task-times-m-01-to-m-04) |
| M-02 Submit shift swap request | 5.0 min | 3.0 min | −2.0 min (−40%) | Self-reported approximate time on the UAT sheet, 8 employees (U01–U08); median | [UAT results §4](../Test_plan/2026-11-03-uat-results.md#4-before--after-task-times-m-01-to-m-04) |
| M-03 Check request status | 3.5 min (n = 6; 2 others answered in days of waiting: 1–3 and 2–3 days) | 2.0 min | −1.5 min (−43%) | Self-reported approximate time on the UAT sheet, 8 employees (U01–U08); median | [UAT results §4](../Test_plan/2026-11-03-uat-results.md#4-before--after-task-times-m-01-to-m-04) |
| M-04 Verify approved shift swap | 2.0 min | 1.0 min | −1.0 min (−50%) | Self-reported approximate time on the UAT sheet, 8 employees (U01–U08); median | [UAT results §4](../Test_plan/2026-11-03-uat-results.md#4-before--after-task-times-m-01-to-m-04) |
| Usability (SUS, 0–100) | Not measured for the Excel process | 71.0 (n = 10) | — | Standard 10-item SUS questionnaire, all 10 participants | [UAT results §5](../Test_plan/2026-11-03-uat-results.md#5-usability) |

## MUST (P0) stories

All 42 P0 stories from [backlog.md](../01-requirements/backlog.md). Stories covered by an M-task link to that row; stories proven only by a test case show the case that passed. Testing on 2–3 November 2026 covered the shift swap workflow only, so the other stories were not measured.

| Item | Before | After | Change | Measured with | Evidence |
| --- | --- | --- | --- | --- | --- |
| US-001 — User Login | Not measured | IT-01 failed: the demo version cannot sign in with a company account | — | Test case | [UAT results §2](../Test_plan/2026-11-03-uat-results.md), [ISS-05](../Test_plan/issue-log.md) |
| US-002 — Role-Based Access Control | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-004 — Data Visibility by Role | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-005 — Employee Profile | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-006 — Shift Team Management | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-007 — Position and Skill Management | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-008 — Monthly Schedule Grid | Not measured | E2E-01 passed (monthly schedule view) | — | Test case | [UAT results §2](../Test_plan/2026-11-03-uat-results.md) |
| US-009 — Create Schedule | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-010 — Edit Schedule | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-011 — Delete / Cancel Schedule | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-012 — My Shift | 1.25 min | 1.0 min | −0.25 min (−20%) | Same as M-01 | See M-01; [UAT results](../Test_plan/2026-11-03-uat-results.md) |
| US-014 — Shift Code Management | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-015 — Maximum Consecutive Working Days | Not measured | Enforced: UT-03, UT-04, IT-07, UAT07 passed | — | Test cases | [UAT results §2](../Test_plan/2026-11-03-uat-results.md) |
| US-016 — Position / Skill Validation | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-017 — Schedule Change Time Restriction | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-018 — Minimum Advance Processing Time | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-019 — Team Coverage Validation | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-020 — Submit Shift Change Request | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-021 — View Shift Change Request Status | 3.5 min | 2.0 min | −1.5 min (−43%) | Same as M-03 | See M-03; [UAT results](../Test_plan/2026-11-03-uat-results.md) |
| US-022 — Submit Shift Swap Request | 5.0 min | 3.0 min | −2.0 min (−40%) | Same as M-02 | See M-02; [UAT results](../Test_plan/2026-11-03-uat-results.md) |
| US-023 — Maximum Shift Swaps per Month | Not measured | Enforced: IT-06, UAT07 passed; ease 4.13/5 | — | Test cases + ease rating | [UAT results §2, §5.2](../Test_plan/2026-11-03-uat-results.md) |
| US-024 — Cross-Team / Cross-Shift Approval | Not measured | IT-03, E2E-02 passed | — | Test cases | [UAT results §2](../Test_plan/2026-11-03-uat-results.md) |
| US-025 — Swap Skill Validation | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-026 — Submit Day-Off Change Request | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-027 — Leave Type Selection | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-028 — Planned Leave Workflow | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-029 — Emergency Sick Leave | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-030 — Replacement / OT Employee Validation | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-031 — Pending Request Inbox | Not measured | UAT04 passed; ease 4.5/5 (n = 2) | — | UAT + ease rating | [UAT results §5.2](../Test_plan/2026-11-03-uat-results.md) |
| US-032 — Approve Request | Not measured | UAT05 passed; ease 4.5/5 (n = 2) | — | UAT + ease rating | [UAT results §5.2](../Test_plan/2026-11-03-uat-results.md) |
| US-033 — Reject Request | Not measured | E2E-03 passed | — | Test case | [UAT results §2](../Test_plan/2026-11-03-uat-results.md) |
| US-034 — Multi-Level Approval | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-035 — Real-Time Schedule Update | 2.0 min to verify | 1.0 min to verify | −1.0 min (−50%) | Same as M-04 | See M-04; [UAT results](../Test_plan/2026-11-03-uat-results.md) |
| US-036 — Schedule Change Notification | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-039 — Single Source of Truth | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-040 — HR Schedule View | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-041 — Export Schedule Data | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-042 — HR Export Format | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-043 — OT Data Separation | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-046 — Read-Only Driver Access | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-050 — Mobile My Shift | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| US-051 — Mobile Request Submission | Not measured | Not measured | — | Outside the UAT scope, which covered the shift swap workflow only | [Test plan §1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |

## AI row

| Item | Before | After | Change | Measured with | Evidence |
| --- | --- | --- | --- | --- | --- |
| AI feature | No AI feature | No AI feature | — | Code check of all branches on 2026-11-17 | [ai-logic.md](ai-logic.md) |
