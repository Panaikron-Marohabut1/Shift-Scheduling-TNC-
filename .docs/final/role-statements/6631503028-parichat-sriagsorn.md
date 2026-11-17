# Role Statement — Parichat Sriagsorn (6631503028)

**Role:** Designer

## 1. What I owned

As Designer, I owned the user experience of the web app: the feature list, the user journey, and the ShiftFlow interface that employees and supervisors use. I turned the first static page into the current app in `apps/web`.

## 2. What I did

I wrote the feature list and user journey describing how each role moves through the system. I rebuilt `apps/web` as the ShiftFlow interface, split it into feature modules, and hardened page security. I added in-app notifications so everyone affected by a schedule change is told, not only the requester, because a swap changes two people's shifts. After shift supervisors reviewed the app, I applied their feedback to the request rules and made every leave request name a cover person. In UAT, employees rated checking a request's status 4.88 out of 5 for ease.

## 3. What I learned

I learned that real users judge a design differently from the people who build it. Inside the team, every screen made sense to us because we knew how the system worked. When shift supervisors reviewed the app, they pointed out request rules that did not match how their teams really work, such as needing a cover person for every leave request. Their feedback changed the design more than any of our own reviews did.

UAT taught me where to focus. Checking a request's status was rated the easiest task, 4.88 out of 5, but submitting a swap, the most important task in the whole system, was rated the least easy at 4.00. One employee took five minutes in the app, compared with two minutes by phone. A new system has to beat a simple phone call, not just an Excel file, so this flow needs the most design attention next.

I also learned that small details matter to users. One participant noticed the colours in the schedule view, which we had not thought of as a problem. Next time I would test early paper or screen sketches with a few real employees before building, so that problems like these are found while they are still cheap to fix.

## 4. Evidence

| Contribution | Link |
| --- | --- |
| Feature list and user journey | [4984cdb](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/4984cdb4) |
| Rebuild of apps/web as ShiftFlow | [455762d](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/455762dd) |
| Feature split and page security | [6a86b4e](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/6a86b4e1) |
| In-app notifications | [542a02c](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/542a02cc) |
| Supervisor feedback applied to request rules | [567a3b4](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/567a3b4d) |
| Cover person required on leave requests | [20a8ab2](https://github.com/Panaikron-Marohabut1/Shift-Scheduling-TNC-/commit/20a8ab25) |

## 5. AI disclosure

| AI tool | What I used it for | How I checked the output |
| --- | --- | --- |
| Claude | Drafting the feature list and user journey, and refining the ShiftFlow layout and on-screen text | Tried every changed screen in the browser and checked the result against the shift supervisors’ feedback |
