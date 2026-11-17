# Issue Log — TNC Shift Schedule

> Issues found during testing on 2–3 November 2026. Source: [2026-11-03-uat-results.md](2026-11-03-uat-results.md).
> 24 of 25 test cases passed. IT-01 failed (ISS-05); the other entries come from UAT feedback.
>
> **Severity** follows the test plan: *Critical* = prevents a swap request from being submitted or approved, or leads to an incorrect schedule. The other levels are proposed by the transcriber and must be confirmed by the team.

| ID | Found in | Description | Severity (proposed) | Status | Fix commit | Retest |
| --- | --- | --- | --- | --- | --- | --- |
| ISS-01 | UAT-S09 (U05, UAT01) | Participant noted a problem with colours in the schedule view. Exact wording is unclear on the scan ⚠ — transcribe before acting. | Low | Open | — | Not retested |
| ISS-02 | UAT-S09 (U05, UAT02) | Submitting a swap request took longer in the new system (5 min) than the old phone method (2 min); the participant rated the task 3/5. | Low | Open | — | Not retested |
| ISS-03 | UAT-S14 (U07) | Feature request: show the employee's leave balances by type (annual, sick, personal, other), with totals and days used in the year. Not in the current scope; needs a backlog decision and a check against the sick-leave minimisation rule in [rule.md](../01-requirements/rule.md). | Enhancement | Open | — | — |
| ISS-04 | UAT-S04 (U02, UAT07) | Handwritten note beside UAT07 (swap restrictions). The clearer follow-up scan shows it records the system blocking the request because the swap rights were already used, which is the expected behaviour, so it is not a defect. | None | Closed (not a defect) | — | — |
| ISS-05 | IT-01 (2 Nov 2026) | Company-account login failed: testing used the demo version, which cannot sign in with a company account. The tester used a demo account, so company-account login is not yet verified. Not critical by the plan’s definition (it does not stop a swap request from being submitted or approved). | Medium (proposed) | Open | — | Rerun IT-01 when company sign-in is available |

Known logic issues F01–F09, found before UAT, are listed in the [release check of 1 November 2026](../06-development/2026-11-01-release-check.md). They were not triggered by the UAT scenarios and are not repeated here.

## How to update an entry

When an issue is fixed, fill in **Fix commit** with the commit hash, rerun the related test case or UAT scenario, and set **Retest** to `Passed on <date>` or `Failed on <date>`.
