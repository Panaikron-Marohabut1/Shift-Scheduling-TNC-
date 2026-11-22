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
## 6. Reflection

### 6.1 Lessons learned: How did building the app with AI affect software engineering?

While working on ShiftFlow, I was the Designer. I designed the screens in Figma first, then used Claude to help me turn them into real web pages. I also learned how to connect a login system with Supabase and put a trial website on Vercel for the company to test. My work went from reading the shift supervisor's feedback, item by item, to designing the screens and checking every role myself.

One thing that got "better": I could try many prototypes. For example, workers had trouble finding their own shift in a big table, so I changed the first page to simple cards. With AI, I could test a new idea in a few hours, and the supervisor could give feedback on a real screen, not just a picture in Figma.

One thing that got "worse": I had to check everything myself. Once, the whole website went white because of one small error in a setting file. Also, some company rules, like OT types PY and PL, were still unclear, and AI could not answer them. That taught me that AI makes the work faster, but only users can tell us what is right.

### 6.2 Where do I stand in the software industry today, in the AI era?

I see myself as a "junior UX/UI designer who can build". With AI, I can make a working prototype, not just a drawing. But I still need to improve my design basics, like accessibility and user testing, and understand code better so I can check what AI makes.

### 6.3 What is my plan for next year and the next five years?

Next year: I want to do an internship in UX/UI design and help with my family business at the same time. I want to see how real design teams work with users and developers.

In five years: I'd like to be a UX/UI or Product Designer who understands users and uses AI well. Or I may go back to my family business and use what I learned to make it digital.
