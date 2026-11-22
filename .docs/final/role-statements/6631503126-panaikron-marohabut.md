# Role Statement — Panaikron Marohabut (6631503126)

**Role:** AI Lead

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
| Codex (`codex/*` branches) | Building the alpha demo and the shared Supabase demo | Reviewed each pull request before merging it into main, and ran the API tests and `pnpm check` |

## 6. Reflection

### 6.1 Lessons learned: How did building the app with AI affect software engineering?

While working on ShiftFlow, I practiced using AI tools like Codex, Claude, and Windsurf. I also got hands-on experience with PostgreSQL through Supabase. I worked on different parts of the project, from talking with my team about what employees and shift supervisors needed to do in the app to testing whether the schedule updated correctly after a shift swap was approved.

One thing that got "better" : was how quickly I could build a screen for my teammates to try. Once we could click through it together, it was easier to see what was confusing and what needed to change. One thing that got "worse" : was that I sometimes trusted AI output too quickly. For example, AI misread some numbers on our handwritten test sheets, so the team checked them against the original scans. That taught me to leave time to check the results, especially when the work involves employee data or access permissions.

### 6.2 Where do I stand in the software industry today, in the AI era?

I still see myself as a "junior software developer". Working on ShiftFlow showed me that I can explain how the system I built works and identify what needs to be tested before people use it. I want to strengthen my programming fundamentals and get more confident working through the logic when I face a new or more complex problem.

### 6.3 What is my plan for next year and the next five years?

*Next year* : I want to keep working in software field and explore roles in project management, business analysis, data analysis, or consulting. I enjoy talking with people to understand their problems and helping the team decide where to start. I’d like to get some practical experience and see which kind of work suits me best.

*In five year* : I’d like to be someone my team can trust to oversee a project, from talking with users and planning with developers to delivering the work. My experience building software will help me understand what users need and what the development team needs to deliver it.