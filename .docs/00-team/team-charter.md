# Team Charter — ODestiny

**Project:** Shift Schedule Management System (TNC)
**Course:** Software Engineering Case Study
**Repository:** <https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC->

## 1. Purpose

We are building a centralized shift scheduling system for TNC's 24/7 Production Department. It replaces the Excel roster and phone coordination with one approved schedule, in-app swap requests, a two-supervisor approval flow, and rules that the system enforces. Source: [proposal.md](../01-requirements/proposal.md).

The team succeeds when real users can view their schedule, request and approve a swap, and trust the result, faster than with Excel and phone calls, while staying within the legal baseline in [rule.md](../01-requirements/rule.md).

## 2. Members and roles

| Member | Student ID | Role | Owns |
| --- | --- | --- | --- |
| Charuwan Kasaempan | 6631503007 | Tech Lead | Legal and project documents (rule.md, proposal); running UAT sessions with real users |
| Juladit Teekawiwat | 6631503008 | Product Owner | Requirements, product backlog and scope (MoSCoW, Won't list); backlog audit; login service; unit testing |
| Parichat Sriagsorn | 6631503028 | Designer | Feature list, user journey, and the ShiftFlow web interface in `apps/web` |
| Alisa Pansomkid | 6631503049 | QA / Test | Test plan; integration and end-to-end testing; test accounts and data; system diagrams |
| Panaikron Marohabut | 6631503126 | AI Lead | How the team uses AI agents; GitHub repository; prototype and demo releases |

Ownership comes from each member's work in the repository and the test plan's owner table (§6.2). Owners lead their area; everyone may contribute to any area.

## 3. Team rules

### 3.1 Communication

- Day-to-day communication happens in the team's **LINE group**.
- A decision made in LINE that changes scope, requirements, or the design is copied into the repository (the backlog, a spec, or a commit message) so it is not lost in chat.

### 3.2 Meetings

- The team meets **once a week online** to review progress and plan the next week.

### 3.3 Decisions

- Decisions are made by **consensus**: the team discusses until every member can accept the decision.
- If the team cannot reach consensus, the question goes to the course advisor.
- Business, legal, or personal-data questions that the team cannot answer from the sources are recorded as open questions and asked of the project owner, never guessed ([AGENTS.md](../../AGENTS.md), Clarification Policy).

### 3.4 Code and documents

- Every change reaches `main` through a **pull request**, so there is a record of what changed and why.
- A pull request does not need a review; the author may merge once the checks pass: `pnpm check`, the API tests, and `pnpm audit:backlog`.
- No secrets in Git: `.env` files, passwords, and API keys stay out of the repository; only `.env.example` with placeholder values is committed.

### 3.5 Working with real users and personal data

- Test participants are recorded by code only (U01, U02, …), never by name.
- Paper forms and scans that show personal details stay outside the repository.
- Personal-data handling follows [rule.md](../01-requirements/rule.md) (PDPA, Computer Crime Act, Electronic Transactions Act).

### 3.6 Using AI

- AI tools may draft requirements, code, test cases, and documents. A team member reviews every AI output before it is merged.
- AI agents follow the project rules in [AGENTS.md](../../AGENTS.md) and must ask instead of guessing on business, legal, or personal-data decisions.
- Each member discloses their own AI use in their [role statement](../final/role-statements/).

## 4. Tools

| Purpose | Tool |
| --- | --- |
| Chat | LINE group |
| Meetings | Weekly online call |
| Code, documents, reviews | GitHub repository and pull requests |
| Requirements and backlog | [backlog.md](../01-requirements/backlog.md), checked by `pnpm audit:backlog` |
| AI assistance | Claude Code, Codex, GitHub Copilot ([ai-logic.md §5](../final/ai-logic.md)) |
