# Role Statement — Juladit Teekawiwat (6631503008)

**Role:** Product Owner

## 1. What I owned

As Product Owner, I owned the requirements and the product backlog. I set up the requirements workflow and the automated backlog audit, kept the proposal and legal baseline up to date, and added the Won't list so the team agreed on scope. I also built the login side of the system and owned unit testing of the business rules.

## 2. What I did

I created the requirement-writer workflow and the audit that checks every Must (P0) story has exactly one backlog row and a spec link, so scope could not drift silently. I connected the prototype to a central login backend on Supabase with config-driven CORS, then to the new frontend, and added Microsoft 365 sign-in. Authentication lives in its own service, so the browser never sends user IDs or roles and other TNC apps can reuse the login. All 8 unit cases passed on 2 November 2026.

## 3. What I learned

I learned that deciding what not to build is as important as deciding what to build. With 42 Must stories in the backlog, there was always pressure to add more. Writing a Won't list gave the team a clear answer when a new idea came up, and the automated backlog audit made sure no Must story was silently dropped or duplicated as the spec changed.

I also learned that a Product Owner should not guess. Many questions, such as how swap quotas are counted or who approves overtime, are business decisions that belong to the company, not to us. Recording them as open questions and asking the owner took longer, but it stopped us from building rules that would later be wrong.

The biggest lesson came from login. Our plan assumed testers would sign in with a company account, but the demo version could only use demo accounts, so IT-01 failed. The swap workflow itself was fine; the problem was a dependency on something outside our control that we had not confirmed early enough. Next time I would list every outside dependency, such as company accounts, data sources, and test environments, at the start of the project and check each one before the test plan depends on it.

## 4. Evidence

| Contribution | Link |
| --- | --- |
| Requirements workflow and legal backlog audit | [fdfc66c](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/fdfc66c7) |
| Proposal update | [8ab326c](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/8ab326cb) |
| Won't list in the backlog | [9631ff8](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/9631ff85) |
| Prototype connected to the auth backend with CORS | [101d8b2](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/101d8b26) |
| Login connected to the new frontend | [2639310](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/26393103) |
| Microsoft 365 sign-in | [9c741e3](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/9c741e3b) |
| Unit testing owner | [Test plan §6.2](../../Test_plan/TNC%20Shift%20Schedule_test-plan.md) |

Some of these commits carry another member's e-mail address because of the local Git configuration; the team confirmed they are my work.

## 5. AI disclosure

| AI tool | What I used it for | How I checked the output |
| --- | --- | --- |
| Claude (Claude Code; 21 "Agent host session" commits) | Drafting the requirements workflow, the backlog audit, and the login integration | Read every change before committing, and ran `pnpm audit:backlog` and the API tests |
| Claude Code | Transcribing the UAT sheets and drafting the final documents | Checked values against the scans; the team confirmed the hard-to-read ones |

## 6. Reflection

### 6.1 Lessons learned: How did building the app with AI affect software engineering?

As Product Owner, I used Claude and Claude Code most for requirements and for the login service. AI changed how fast we could move from an idea to a written requirement or working code, but it did not change who has to decide what is right.

One thing that got better: requirements. A requirement-writer agent turned rough interview notes into draft user stories, and the backlog audit checked that every Must story had exactly one backlog row and a spec link. Before, keeping 42 Must stories in sync by hand would have been slow and error-prone. Now a broken link fails the check before it reaches main.

One thing that got worse: it became easy to trust output too quickly. AI wrote login code that worked on the demo, and we only found out during testing that company-account sign-in could not be checked at all, so IT-01 failed. When AI helped transcribe our UAT sheets, some handwritten numbers were also misread, and the team had to correct them against the scans. AI saves time, but every result still needs a person who checks it against the real source.

### 6.2 Where do I stand in the software industry today, in the AI era?

I see myself as someone whose strength is requirements. AI can now write a lot of the code, so the harder part is knowing exactly what to build, which rules are business decisions, and when to stop and ask the owner instead of guessing. That is the work I enjoyed most, and I think it becomes more valuable as coding gets faster.

### 6.3 What is my plan for next year and the next five years?

Next year: I want an internship or junior role as a data analyst, where I can turn business questions, like how often shifts change or how long approvals take, into clear answers from data.

In five years: I want to be a senior data analyst who understands both the business and the data well enough to guide decisions, using AI to work faster while still checking every result against the source.
