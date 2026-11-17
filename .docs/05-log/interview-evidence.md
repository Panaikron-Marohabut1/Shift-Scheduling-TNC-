# Interview Evidence

This file explains where the team's discovery evidence came from and where each record is kept. Participants are identified by code only.

## 1. Where the records are kept

| Record | Location | Why it is kept there |
| --- | --- | --- |
| Meeting recordings, notes and supporting files | [Team Google Drive folder](https://drive.google.com/drive/folders/1n0P3FzTRqDJdGf4120tCVehAvEoZpILZ?usp=sharing) | The files contain real names and company material, so they are not copied into the repository |
| Meeting screenshots | This folder: [2026-09-06-s01-company-portal-walkthrough.png](2026-09-06-s01-company-portal-walkthrough.png), [2026-09-30-s01-shift-workflow-figma.png](2026-09-30-s01-shift-workflow-figma.png) | Proof that the sessions took place |
| UAT sheets from real users | Team drive; transcribed by participant code in [UAT results](../Test_plan/2026-11-03-uat-results.md) | Scan file names contain personal names |

## 2. Stakeholder sessions

The team met the company stakeholder (S01) online through Google Meet. S01 shared their screen to explain the current company systems and the intended shift-scheduling workflow.

| Session | Date | Participants | What was discussed | Evidence |
| --- | --- | --- | --- | --- |
| S01-1 | 6 September 2026 (Sunday) | S01 and all five team members | S01 walked through an existing company web portal: its overview dashboard, approval list and role-based user settings. The team used it as a reference for how company users sign in, how roles are assigned and how approvals are shown | [2026-09-06-s01-company-portal-walkthrough.png](2026-09-06-s01-company-portal-walkthrough.png) |
| S01-2 | 30 September 2026 (Wednesday) | S01 and team members | S01 presented the planned workflow for the shift application in Figma: Authentication → Web Application → Overtime → OT Approve, and Leave → Leave Approve | [2026-09-30-s01-shift-workflow-figma.png](2026-09-30-s01-shift-workflow-figma.png) |

## 3. How the evidence was used

| Discovery output | Source | Where it appears |
| --- | --- | --- |
| Problem and pain points for each role | Proposal and stakeholder sessions | [Proposal](../01-requirements/proposal.md) §2, [case study](../final/case-study.md) §1.2 |
| Workflow for requests and approval | S01-2 workflow (OT and leave with approval) | [Requirements specification](../01-requirements/2026-09-02-01-requirement-spec.md), [backlog](../01-requirements/backlog.md) |
| Role-based access and approval screens | S01-1 company portal walkthrough | Backlog E01 (authentication and roles), E08 (approval workflow) |
| Business rule decisions | Owner decisions recorded after the sessions | [Business rules master](../01-requirements/01-spec/2026-11-04-01-business-rules-master.md) |

## 4. Real-user evidence

The stakeholder sessions above are supported by user acceptance testing with **10 real users from the target roles** on 3 November 2026: 8 shift employees (U01–U08) and 2 shift supervisors (U09–U10). Each participant reported how long tasks took with the old Excel and phone process and with the new system, and completed the SUS questionnaire.

| Evidence | Where |
| --- | --- |
| Participants and sessions | [UAT results §3](../Test_plan/2026-11-03-uat-results.md#3-participants-and-sessions) |
| Old process versus new system task times | [UAT results §4](../Test_plan/2026-11-03-uat-results.md#4-before--after-task-times-m-01-to-m-04) |
| Usability (SUS) | [UAT results §5](../Test_plan/2026-11-03-uat-results.md#5-usability) |
