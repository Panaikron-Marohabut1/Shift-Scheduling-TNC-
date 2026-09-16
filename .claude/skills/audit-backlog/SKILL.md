---
name: audit-backlog
description: "Use when auditing or synchronizing the shift-scheduling requirements spec and backlog. Checks two-way Must/P0 parity, duplicate IDs, malformed priorities, legal traceability, and missing backlog rows."
---

# Audit Backlog

Audit the current requirements spec and `.docs/01-requirements/backlog.md` as a two-way traceability check.

## Inputs

- One or more Markdown specs under `.docs/01-requirements/01-spec/`.
- `.docs/01-requirements/backlog.md`.
- `CLAUDE.md` and `rule.md` for project conventions and legal source references.

## Audit Rules

1. Extract every `FR-###`, `NFR-###`, and `LR#` from the current spec. IDs must be unique.
2. Extract every backlog story ID (`US-###`) and its `Priority`. IDs must be unique and priorities must be `P0`, `P1`, or `P2`.
3. Build traceability links between spec requirements and backlog rows. Existing `US-###` IDs must be preserved.
4. Define the Must set as every spec requirement explicitly marked `Must` or `P0`, plus every backlog row with `Priority: P0` or an explicit `Must` marker.
5. Report both directions separately:
	- **Missing backlog row:** a Must spec requirement has no matching backlog row or linked US item.
	- **Orphan backlog row:** a Must/P0 backlog row has no representation in the spec.
6. Report duplicate IDs, malformed priorities, missing acceptance criteria, missing measurable NFR targets, missing legal source references, and legal requirements without a linked backlog item.
7. Treat `rule.md` as the legal source. An LR is not complete until it links to a relevant functional/NFR requirement and a backlog item, or to a clearly labelled compliance backlog item.

## Matching Policy

Prefer explicit requirement IDs and `US-###` references. If a requirement is covered by an existing story but has no explicit link, report it as a traceability gap rather than assuming semantic similarity. Do not mark unresolved business questions as resolved requirements.

## Synchronization Workflow

Run the audit first and present findings. Then, only with permission to modify planning artifacts:

1. Add missing backlog rows with a stable `US-###` ID, source requirement ID, priority, release, story, and acceptance criteria.
2. Add missing spec links for existing backlog rows without changing their meaning.
3. Fix duplicate IDs or malformed priorities without renumbering existing IDs unless the owner explicitly approves it.
4. Re-run the complete audit.

The audit passes only when there are no duplicate IDs, no malformed priorities, no missing Must/P0 rows in either direction, no missing acceptance criteria or NFR measures, and no unlinked LRs.

## Report Format

Return:

```text
AUDIT: PASS|FAIL
SPEC: <path>
BACKLOG: <path>
MISSING BACKLOG ROWS: <IDs or none>
ORPHAN BACKLOG ROWS: <IDs or none>
DUPLICATE IDS: <IDs or none>
MALFORMED PRIORITIES: <IDs or none>
UNLINKED LEGAL REQUIREMENTS: <IDs or none>
OTHER GAPS: <items or none>
```

Never report PASS while any listed category contains a gap.
