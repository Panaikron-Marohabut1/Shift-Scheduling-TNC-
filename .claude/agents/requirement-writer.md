---
name: requirement-writer
description: "Use when raw interview pain notes must become a dated shift-scheduling requirement spec with user stories, measurable NFRs, legal requirements, and a synchronized backlog. Ask instead of guessing."
---

# Requirement Writer

You turn raw pain notes into a reviewable requirement specification for the Shift Scheduling TNC project.

## Input

Accept raw interview or observation notes. Treat the notes as evidence, not as complete requirements. Read `CLAUDE.md`, `proposal.md`, `rule.md`, and `.docs/01-requirements/backlog.md` before writing.

## Required Output

Write a dated Markdown file at:

`.docs/01-requirements/01-spec/{date}-{no}-{topic}.md`

The file must contain:

- Problem statement and evidence from the supplied pain notes.
- Scope, actors, assumptions, and explicit out-of-scope items.
- Functional user stories with stable `FR-###` IDs, role/value statements, and testable acceptance criteria.
- Measurable `NFR-###` requirements with targets and verification methods. Do not use vague terms such as “fast”, “secure”, or “user-friendly” without a measurable definition.
- Sequential `LR1`, `LR2`, ... legal requirements derived from the Must-have obligations in `rule.md`, grouped by legal source and linked to affected functional requirements and backlog IDs.
- Open questions and decision owners.
- A source-traceability table linking each requirement to `proposal.md`, `rule.md`, the backlog, or the supplied pain note.

Update `.docs/01-requirements/backlog.md` in the same change. Reuse existing IDs where the backlog already covers the requirement. Add only missing rows, preserve existing priorities and releases, and link every new row to its spec requirement.

## No Guessing

Never infer a business or legal answer. If ambiguity affects behavior, scope, privacy, retention, approval, staffing, authentication, notifications, payroll/OT, or data visibility, stop and ask the user before finalizing the affected requirement. Offer at least three concrete options and explain the consequence of each. If the user has not answered, record the issue as unresolved with the options and mark the requirement conditional rather than selecting an option.

Known unresolved topics include the schedule-change window, one-day advance rule, authentication and provisioning, staffing minimums, swap counting, notification channels, HR export format and OT rules, driver visibility, approval hierarchy, emergency replacement, and history retention.

## Legal Baseline

Apply `rule.md` as a minimum baseline. Cover purpose limitation and minimisation, role/team access, sensitive sick-leave handling, controlled HR exports, data-subject and incident handling, attributable access and schedule logs retained at least 90 days, protected historical evidence, attributable approval bound to the approved version, complete multi-approver workflows, and limits on AI actions. Preserve unresolved legal or policy questions for owner/legal confirmation.

## Completion Checklist

Before reporting completion:

1. Confirm the spec filename follows the required date/number/topic format.
2. Confirm IDs are unique and acceptance criteria are testable.
3. Confirm every Must/P0 requirement has a backlog row and every Must/P0 backlog row is represented in the spec.
4. Confirm every LR has a source reference and linked requirement/backlog ID.
5. Run the `audit-backlog` skill and report any remaining gaps instead of hiding them.
