# Shift Scheduling TNC - Project Guidance

## Purpose

This repository documents requirements for a centralized shift scheduling system that replaces Excel-based scheduling and manual coordination. The project is currently in the Discover phase. Requirements must be clear enough to validate before implementation begins.

## Source Of Truth

Use these sources in this order:

1. `rule.md` is the legal and compliance baseline. Do not weaken or contradict it.
2. `proposal.md` describes the problem, intended scope, roles, and known business context.
3. `.docs/01-requirements/01-spec/*.md` contains dated requirement decisions and traceability.
4. `.docs/01-requirements/backlog.md` is the planning index for requirement IDs and delivery priority.

When sources conflict, record the conflict as an open question and do not silently choose a value.

## Requirement Conventions

- Functional requirements use stable `FR-###` identifiers and include a user story plus testable acceptance criteria.
- Non-functional requirements use stable `NFR-###` identifiers and measurable targets or verification methods.
- Legal requirements use sequential `LR1`, `LR2`, ... identifiers and link to the applicable section of `rule.md`.
- Must requirements are marked `P0` or `Must` and must have exactly one matching backlog row.
- Every backlog Must/P0 row must be represented in the current spec or explicitly linked to a requirement that supersedes it.
- Preserve existing IDs when synchronizing the backlog. Never duplicate, silently delete, or renumber an existing item.

## Clarification Policy

Never guess about business behavior, personal-data handling, retention, approval authority, authentication, notification channels, staffing, payroll/OT rules, or legal interpretation. If an answer is needed, stop and ask the owner. Present at least three concrete options with the consequence of each option. Until resolved, record the item as an open question and keep the affected requirement conditional.

## Legal Implementation Gate

Before documenting or implementing any feature that collects, changes, approves, exports, or exposes employee data, define its purpose, minimum fields, authorised roles, retention, audit events, and approval requirements. Sensitive sick-leave details must be minimised and restricted. Access and schedule events must be attributable to a real user, and the Computer Crime Act baseline requires protected logs retained for at least 90 days. Electronic approvals must remain attributable and bound to the exact approved version.

## Agent And Skill Workflow

- Use `.claude/agents/requirement-writer.md` for raw pain notes and first-draft requirement specs.
- Use `.claude/skills/audit-backlog/SKILL.md` to check two-way parity between Must/P0 spec requirements and backlog rows before committing.
- Store dated specs under `.docs/01-requirements/01-spec/` and keep source traceability in every spec.
- Do not create application code as part of requirements work.

## Validation And Git

Before committing, run the audit workflow, check Markdown structure, run `git diff --check`, and inspect the final diff. Commits should contain only the requested requirements artifacts. Push the checked-out branch unless the project owner explicitly names another branch.
