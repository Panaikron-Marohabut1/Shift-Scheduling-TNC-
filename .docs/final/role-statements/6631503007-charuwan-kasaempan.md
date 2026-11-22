# Role Statement — Charuwan Kasaempan (6631503007)

**Role:** Tech Lead

## 1. What I owned

As Tech Lead, I owned the early legal and project documents and the running of user acceptance testing. I updated rule.md and the proposal so the team's requirements rested on PDPA, the Computer Crime Act, and the Electronic Transactions Act. I merged the redesigned web interface into main (PR #18).

## 2. What I did

I ran the UAT sessions on 3 November 2026. I observed 10 real users — 8 employees and 2 shift supervisors — across 20 sessions, and collected their task times, ease ratings, and SUS answers on paper sheets. All 7 UAT scenarios passed. Participants were identified only by U-codes, so no real names reached the repository. The sessions produced the before/after evidence in the comparison table, including the finding that checking a swap's status used to take days of waiting.

## 3. What I learned

I learned that the evidence from a user test is only as good as the forms and methods used to collect it. Our SUS sheet was missing its tenth question, and nobody noticed until after the sessions. We had to go back to all ten participants with a separate sheet for that one question. We got every answer in the end, but it cost extra time and meant the last item was answered later than the others. A single pilot session with one person would have caught the gap before the real sessions.

I also learned the difference between what a plan says and what actually happens on the day. The test plan described observers timing each task with a stopwatch, but on the sheets participants wrote their own estimates. Both are useful, but they are not the same evidence, and the report has to say which one we have.

Running the sessions also showed me how much care real people's data needs. We recorded everyone by code only, U01 to U10, and kept the scanned sheets out of the repository because the file names held a real name. Writing rule.md earlier made these choices easy, because the PDPA rules were already written down before we needed them. Next time I would plan the evidence and the privacy steps together, before the first session starts.

## 4. Evidence

| Contribution | Link |
| --- | --- |
| Update rule.md and proposal | [aa0a93e](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/aa0a93e2) |
| Proposal revision | [a42a6c2](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/a42a6c20) |
| Merge of the redesigned web interface | [PR #18](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/pull/18) |
| UAT session owner | [Test plan §6.2](../../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |
| UAT results | [2026-11-03-uat-results.md](../../Test_plan/2026-11-03-uat-results.md) |

## 5. AI disclosure

| AI tool | What I used it for | How I checked the output |
| --- | --- | --- |
| Claude | Improving the wording of rule.md and the proposal, and preparing the UAT session sheets | Checked the legal points against the PDPA and Act sections cited in rule.md, and checked the session sheets against the test plan before printing |

## 6. Reflection

### 6.1 Lessons learned: How did building the app with AI affect software engineering?

As Tech Lead, my work was the legal baseline, the proposal, and running UAT with real users. I used Claude to improve the wording of rule.md and the proposal and to help prepare the UAT session sheets.

One thing that got better: documents and test materials were ready much faster. Claude helped me turn the PDPA, Computer Crime Act, and Electronic Transactions Act points into clear rules the team could follow, and it helped lay out session sheets for ten participants. Because rule.md was written early, decisions such as recording users by code only were easy to make later.

One thing that got worse: I trusted a prepared form too quickly. Our SUS sheet was missing its tenth question, and nobody noticed until after the sessions. We had to go back to every participant with an extra sheet. AI made the sheet look finished, but looking finished is not the same as being correct. Quality checks, such as comparing a form against the standard questionnaire, still have to be done by a person.

For teamwork and security, AI did not remove the need to agree on rules. The team still had to decide together how to handle personal data, which scans could go into the repository, and who checks AI output before it is merged.

### 6.2 Where do I stand in the software industry today, in the AI era?

I see my strength in quality and in working with real users. AI can produce code and documents quickly, but it cannot sit with an employee and see where they get confused, or take responsibility for their personal data. I think those human skills become more important, not less, when building gets faster.

### 6.3 What is my plan for next year and the next five years?

Next year: I want to start in a QA or UX research role, where I can plan tests and run sessions with real users.

In five years: I want to lead quality or user research for a product team, making sure what we build with AI is tested, safe, and actually useful.
