# Case Study — Shift Schedule Management System (TNC)

| Item | Value |
| --- | --- |
| Live URL | Not deployed. The system runs on localhost with demo data only ([release check](../06-development/2026-11-01-release-check.md)); setup steps are in the [README](../../README.md). |
| Repository | <https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-> |
| Team (ODestiny) | Charuwan Kasaempan (Tech Lead), Juladit Teekawiwat (Product Owner), Parichat Sriagsorn (Designer), Alisa Pansomkid (QA / Test), Panaikron Marohabut (AI Lead) — see [role-statements/](role-statements/) |

---

## 1. Problem

### 1.1 Context

The Production Department runs 24/7 with four rotating shift teams (Shift A–D). Shift schedules are kept in Microsoft Excel and prepared monthly. Every change — a swap, leave, or overtime — means editing the file by hand, having a Supervisor review it, and sending the new version out again. Requests and confirmations happen by phone. Employees, Supervisors, HR, and contracted van drivers can end up working from different versions of the schedule, and drivers cannot open the internal file at all. Source: [proposal.md §1–2](../01-requirements/proposal.md).

This matters because each shift must stay fully staffed, and labour rules such as the six-consecutive-day limit must hold after every change.

### 1.2 Who is affected

| Role | Main pain | Evidence |
| --- | --- | --- |
| Shift Operator | Has to phone a colleague and then the Supervisor to swap a shift, and phone again to learn whether it was approved. Two UAT participants described the old status check as 1–3 days of waiting. | [proposal.md §2.3](../01-requirements/proposal.md); [UAT results §4](../Test_plan/2026-11-03-uat-results.md) |
| Shift Supervisor | Edits and re-checks the Excel file by hand for every change, with a risk of data-entry errors and several versions of the same schedule. | [proposal.md §2.1](../01-requirements/proposal.md) |
| HR | Excel does not give structured data for OT, shift allowance, or payroll calculation. | [proposal.md §2.5](../01-requirements/proposal.md) |
| External User (Contractor / Van Driver) | Cannot open the internal Excel file, so does not get the latest daily schedule directly. | [proposal.md §2.4](../01-requirements/proposal.md) |

### 1.3 Evidence of the problem

The pains above come from the project proposal and the team's stakeholder interviews. The interview records are kept in the team's Google Drive folder, linked from [interview-evidence.md](../05-log/interview-evidence.md); the repository holds the link only, not transcripts. UAT on 3 November 2026 confirmed the communication pain from real users: before/after times for the old phone-and-Excel method are in the [UAT results](../Test_plan/2026-11-03-uat-results.md).

---

## 2. Process

### 2.1 Discover

The team turned the proposal and interviews into a dated requirement specification and a MoSCoW product backlog with 42 Must (P0) stories, checked for two-way parity by an automated audit (`pnpm audit:backlog`). A legal baseline covering PDPA, the Computer Crime Act, and the Electronic Transactions Act sets the rules every feature must follow.

- [2026-09-02-01-requirement-spec.md](../01-requirements/2026-09-02-01-requirement-spec.md)
- [backlog.md](../01-requirements/backlog.md)
- [rule.md](../01-requirements/rule.md)

### 2.2 Build

| Part | Technology | Location |
| --- | --- | --- |
| Web frontend | Vanilla JavaScript modules | `apps/web/` |
| API backend | NestJS + TypeScript | `apps/api/` |
| Database | PostgreSQL (portable local instance) | `apps/api/migrations/` |
| Login | Next.js + Supabase Auth, with Microsoft 365 sign-in | `apps/auth/` |

Source: [project-structure.md](../06-development/project-structure.md). Diagrams (use case, activity, system context, architecture): [.docs/02-design/diagrams/](../02-design/diagrams/).

Key design decisions:

- **Two-supervisor approval.** A cross-team swap is approved only when both shift supervisors approve, in either order; one rejection rejects the request. The schedule changes only after full approval, so a pending request never alters the roster ([test plan §1.1](../Test_plan/TNC%20Shift%20Schedule_test-plan.md)).
- **Rules enforced by the system, not by people.** The two-swaps-per-month limit and the six-consecutive-day limit are checked when a request is submitted, so an invalid request is never created (IT-06, IT-07).
- **Audit trail for every approved change**, to meet the attribution and log-retention baseline in [rule.md](../01-requirements/rule.md) (IT-05).
- **Central login service.** Authentication is a separate app so other TNC applications can share it; the browser never sends user IDs or roles.

### 2.3 Test

Plan: [TNC Shift Schedule test plan](../Test_plan/TNC%20Shift%20Schedule_test-plan.md), covering unit, integration, E2E, and UAT levels.

Automated results as of 2026-11-01 ([release check](../06-development/2026-11-01-release-check.md)):

- API unit and integration tests: 32/32 passed.
- `pnpm check` and `pnpm audit:backlog`: passed.
- `pnpm test:browser`: **failing**. It still expects the old demo account-picker page, which Login replaced.

Manual test execution ([UAT results](../Test_plan/2026-11-03-uat-results.md)):

- 2 November 2026: 18 unit, integration, and E2E cases, all passed.
- 3 November 2026: UAT with 10 real users — 8 employees (U01–U08) and 2 shift supervisors (U09–U10), 20 sessions. All 7 UAT scenarios passed.
- Issues raised by participants are tracked in the [issue log](../Test_plan/issue-log.md).

### 2.4 How the team used AI

AI was used as a development tool; the product itself has no AI feature ([ai-logic.md](ai-logic.md)). The team used AI coding agents (Claude Code and Codex) to draft requirement specs from interview notes, audit spec–backlog parity, critique and refine the UI, scaffold code, and draft test cases. Every AI output was reviewed by a team member, and project rules in [AGENTS.md](../../AGENTS.md) forbid the agents from guessing business, legal, or personal-data decisions.

---

## 3. Outcome

### 3.1 Results

Median times reported by 8 employees. Full table: [comparison-table.md](comparison-table.md).

| Metric | Before (Excel + phone) | After (new system) |
| --- | --- | --- |
| Submit a shift swap request (M-02) | 5.0 min | 3.0 min |
| Check request status (M-03) | 3.5 min; 2 employees reported 1–3 days of waiting | 2.0 min |
| Verify an approved swap (M-04) | 2.0 min | 1.0 min |
| Usability (modified 9-item SUS) | — | 71.9 / 100 |

These times are self-reported estimates, and the SUS form was missing item 10; see the limitations in the [UAT results](../Test_plan/2026-11-03-uat-results.md#6-limitations-of-this-evidence).

### 3.2 What works now

- Employees can view their own and their team's monthly schedule, submit a cross-team shift swap, and follow its status in the app instead of by phone.
- Supervisors see pending requests and approve or reject them; the schedule updates only after both required approvals.
- The monthly swap limit and the six-consecutive-day limit block invalid requests before they are created.
- Approved changes are recorded in the audit trail.
- Users sign in through the central login service (Supabase Auth, with Microsoft 365).

All of the above passed in testing on 2–3 November 2026.

### 3.3 Limitations

Known as of 2026-11-01 ([release check](../06-development/2026-11-01-release-check.md)):

- Nine frontend logic issues, F01–F09, are confirmed and not yet fixed. Examples: the ±7-day window breaks across month boundaries, and a swap with a return day can produce 7 consecutive working days.
- Several new request types, including a swap with a return day, are stored in browser localStorage, not PostgreSQL, so they are not shared between devices.
- The system runs on localhost with demo data only.
- Microsoft sign-in, MFA and logout have not been tested end to end with real accounts.
- Open dependency advisories remain in the API (`body-parser`, `multer`, `qs`).

Found during UAT ([issue log](../Test_plan/issue-log.md)):

- One employee found submitting a swap slower in the new system (5 min) than by phone (2 min).
- One employee asked for leave balances (annual, sick, personal) in the app; this is outside the current scope.
- The evidence itself has limits: task times were estimated by participants, errors per task were not recorded, and SUS item 10 was missing from the form.

### 3.4 Next steps

1. Fix logic issues F01–F09 and move every request type from localStorage to PostgreSQL.
2. Update `pnpm test:browser` to the current Login flow so the full workflow is covered automatically.
3. Deploy to a hosted test environment and publish a live URL.
4. Re-run usability with the full 10-item SUS and observer timings, so results can be compared with the SUS benchmark.
5. Decide on the leave-balance request (ISS-03) against the sick-leave minimisation rule in [rule.md](../01-requirements/rule.md).
