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
