# Role Statement — Alisa Pansomkid (6631503049)

**Role:** QA / Test

## 1. What I owned

As QA / Test lead, I owned the test plan and the integration and end-to-end testing, and I prepared the test accounts and data before every test. I also drew the system diagrams and the high-level architecture.

## 2. What I did

I wrote the TNC Shift Schedule test plan: 8 unit, 7 integration, 3 E2E cases and 7 UAT scenarios, with exit criteria and before/after measures. I ran the integration and E2E tests on 2 November 2026 on the demo version: 9 of 10 passed, including the core workflow cases IT-03, E2E-01, E2E-02, and E2E-03, while IT-01 failed because the demo cannot sign in with a company account. The plan checks each business rule three times — as a unit test, through the system, and with real users in UAT07 — so a rule cannot pass in code but fail for users. Earlier, I drew the use case, activity, system context, and architecture diagrams, and later refined the scheduling UI and responsive layouts.

## 3. What I learned

I learned that a test result is only valid for the environment it ran in. We ran our integration tests on the demo version. They proved that the swap workflow, the approval rules, and the audit trail work, but they could not prove company-account login, because the demo has no company sign-in. IT-01 failed for that reason. A test plan has to state its environment and its limits as clearly as its test cases, or a reader will assume more was proven than really was.

I also learned to record a failure honestly instead of hiding it. It was tempting to mark IT-01 as not applicable, but writing it down as a failure, with the reason and an issue log entry, gives the team a clear task: rerun it when company sign-in is ready. Our exit criteria still passed at 94 percent, so the honest result did not hurt us.

Finally, I learned that tests need maintenance like code. Our automated browser test stopped working when the login page replaced the old demo account picker. Nothing was wrong with the system; the test was out of date. Next time I would update the tests in the same change that updates the screens they check.

## 4. Evidence

| Contribution | Link |
| --- | --- |
| Test plan | [7806b49](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/7806b492), [68a9bab](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/68a9bab9) |
| Diagrams (use case, activity, system context) | [f5cbba7](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/f5cbba70) |
| High-level architecture | [aec3fe8](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/aec3fe8f) |
| Scheduling UI and responsive layouts | [3a2c8ed](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/3a2c8edf) |
| Integration, E2E, and test data owner | [Test plan §6.2](../../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |

## 5. AI disclosure

| AI tool | What I used it for | How I checked the output |
| --- | --- | --- |
| Codex | Drafting test cases for the test plan ([Test plan §7](../../Test_plan/TNC%20Shift%20Schedule_test-plan.md)) | Checked and adjusted the drafts against the shift swap workflow |
