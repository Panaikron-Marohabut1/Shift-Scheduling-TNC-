# Role Statement — Panaikron Marohabut (6631503126)

**Role:** AI Lead

> **To complete:** fill in the lines marked ✍ in the AI disclosure, and check that sections 1–3 match what you did and learned. Everything else is drawn from the repository and the test plan.

## 1. What I owned

As AI Lead, I owned how the team used AI agents to build the system, and I own the GitHub repository. I set up the project structure, merged half of the team's 20 pull requests, and led the move from the static prototype to a working alpha.

## 2. What I did

I built the shift schedule prototype and evolved it as the rules became clear: cross-team swaps only, view-only access for managers, and the two-supervisor approval flow. I delivered the PostgreSQL alpha demo (PR #16), then organised the login app and simplified local startup so the whole system runs with one command. Later I showed the swap-rule checks in the interface, prepared a shared Supabase demo with a tester handbook, and completed the shared leave and OT workflows. AI agent work went on separate `codex/*` branches and reached main only through pull requests.

## 3. What I learned

I learned that AI agents speed up building but do not remove the need for human judgement. With Codex and Claude Code, we could build an alpha demo, a database, and a login service much faster than we could have alone. But speed made it easy to accept changes without fully reading them. Keeping agent work on separate branches and merging it only through pull requests made every change reviewable and gave us a clear history of what the AI did.

I also learned that an AI agent will fill gaps with guesses unless it is told not to. Our project rules in AGENTS.md tell agents to ask instead of guessing on business, legal, or personal-data decisions. That rule mattered: swap limits, approval order, and data retention are company decisions, and they had to be confirmed by people, not invented by the AI.

Finally, I learned that AI output must be checked against the real evidence. When AI helped transcribe our handwritten UAT sheets, some numbers were misread, and the team corrected them against the scans. Next time I would build that checking step into every AI task from the start, instead of treating it as a final review.

## 4. Evidence

| Contribution | Link |
| --- | --- |
| Project structure | [483fa8e](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/483fa8ea) |
| Two-supervisor approval flow | [c122bf8](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/c122bf88) |
| PostgreSQL alpha demo | [8db04c3](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/8db04c31), [PR #16](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/pull/16) |
| Login app organised, one-command startup | [82a4b14](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/82a4b147) |
| Swap-rule checks shown in the UI | [d180b90](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/d180b903) |
| Shared Supabase demo and tester handbook | [12e46d1](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/12e46d10) |
| Shared leave and OT workflows | [9af342f](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/9af342f4) |

## 5. AI disclosure

| AI tool | What I used it for | How I checked the output |
| --- | --- | --- |
| Codex (`codex/*` branches) | Building the alpha demo and the shared Supabase demo | ✍ How you reviewed it (for example: PR review, API tests, `pnpm check`) |
