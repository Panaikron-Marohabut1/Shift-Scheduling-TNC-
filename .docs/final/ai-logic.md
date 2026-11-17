# AI Logic

## 1. Where

**The Shift Schedule Management System has no AI feature.** Every decision in the product — swap-limit checks, the six-consecutive-day check, the two-supervisor approval, and the schedule update — is made by deterministic rules in code (`apps/api/src/validation/`, `apps/web/src/shared/scheduling/rules.js`), covered by unit and integration tests.

Checked on 2026-11-17: no AI or LLM library or API call exists in the application code (`apps/*/src`) on any branch of the repository.

The team chose rules over AI on purpose: swap limits, working-day limits, and approvals are legal and payroll-relevant decisions that must be exact, explainable, and attributable to a real user ([rule.md](../01-requirements/rule.md)).

## 2. How

Not applicable — there is no AI component in the product.

## 3. Prove

Not applicable for the product. The rule-based checks that would otherwise need an AI evaluation are proven by test cases instead: UT-01 to UT-04, IT-06, IT-07, and UAT07 all passed ([UAT results §2](../Test_plan/2026-11-03-uat-results.md)).

## 4. Measure

Not applicable. The AI row in [comparison-table.md](comparison-table.md) records this.

## 5. AI used during development (not in the product)

| Where | What AI did | How the team checked it | Source |
| --- | --- | --- | --- |
| Requirements | `requirement-writer` agent turns raw interview notes into draft specs with user stories, NFRs, and legal requirements | Owner review; the agent must ask instead of guessing; `audit-backlog` checks spec–backlog parity before commits | [AGENTS.md](../../AGENTS.md), `scripts/audit-backlog.mjs` |
| UI design | `impeccable` skill critiques and refines the interface | Team review of each change; [design critique](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/blob/main/prototypes/legacy-static/reviews/2026-09-22-shift-app-critique.md) kept as a record | [project-structure.md](../06-development/project-structure.md) |
| Code | Codex and Claude Code agent sessions scaffolded and changed application code (`codex/*` branches, "Agent host session" commits); GitHub Copilot agent opened one fix branch | Pull requests merged by team members; API tests, `pnpm check`, and web safety checks run before release | Git history; [release check](../06-development/2026-11-01-release-check.md) |
| Test plan | Drafted test cases for all test levels and the UAT scenarios | The team checked and adjusted them against the shift swap workflow | [Test plan §7](../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| Final documents | Claude Code transcribed the paper UAT sheets and drafted these final documents from repository evidence | Values hard to read were marked ⚠ for the team to check against the original scans | [UAT results](../Test_plan/2026-11-03-uat-results.md) |

Each member's own AI use is disclosed in their [role statement](role-statements/).
