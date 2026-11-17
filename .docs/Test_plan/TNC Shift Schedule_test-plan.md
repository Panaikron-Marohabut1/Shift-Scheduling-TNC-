# Test Plan: TNC Shift Schedule

> **Source:** synced on 2026-11-17 from the team's Word file `TNC-Shift_schedule_test_plan.docx`, which is the current version.
> Results from the UAT paper sheets were added in §4.2, §4.3, §5.2 and §5.3; full data is in the [UAT results](2026-11-03-uat-results.md) and the [issue log](issue-log.md).
>
> SUS item 10 for all 10 participants added on 2026-11-17 from two follow-up scans; see §5.3.
>
> UAT actual date corrected to 3 November 2026 in §6.1, as confirmed by the team on 2026-11-17 (the Word file said 2 November).
>
> §3.2 re-synced on 2026-11-17 from the updated Word file: integration tests ran on the demo version, which cannot sign in with a company account, so IT-01 is recorded as failed and IT-02 passed against demo data only.

Group: ODestiny

| Name | Student ID |
| --- | --- |
| Charuwan Kasaempan | 6631503007 |
| Juladit Teekawiwat | 6631503008 |
| Parichat Sriagsorn | 6631503028 |
| Alisa Pansomkid | 6631503049 |
| Panaikron Marohabut | 6631503126 |

## 1. Scope

The testing focuses on the employee shift swap workflow.

### 1.1 Must Requirement

The system must allow employees to request a shift swap with another employee. It must support the approval process by both shift supervisors and enforce the following business rules:

- Each employee may swap shifts no more than twice a month, whether as the requester or as the swap partner.
- Employees must not work more than six consecutive days.
- The shift schedule must be updated correctly after an approved shift swap.

A request is approved only when both shift supervisors have approved it, in either order. If either supervisor rejects it, the request is rejected. A shift swap counts toward the limit of both employees involved (the requester and the swap partner) only after both supervisors have approved it. Pending or rejected requests do not count toward this limit.

### 1.2 Core Workflow

1. The employee views their current shift schedule.
2. The employee selects a shift and submits a shift swap request with another employee.
3. The request is reviewed and approved or rejected by the relevant shift supervisors.
4. The system updates the shift schedule if the request is approved.
5. The employees verify that the updated schedule reflects the approved shift swap.

### 1.3 Out of Scope

The testing will focus on the employee shift swap workflow. The following features are excluded from this testing:

- Overtime (OT) Request Processing: full processing and approval workflows managed by external systems.
- Advanced SSO and Data Synchronization: internal configuration of Single Sign-On (SSO) and advanced mechanisms for synchronizing employee data with external systems.

Basic login functionality, the availability and accuracy of employee data required for shift swapping, and the Audit Trail record of an approved schedule change will still be verified as prerequisites and supporting checks for the core workflow.

## 2. Test Levels

The plan covers four levels and follows the Testing Pyramid: 8 unit cases, 7 integration cases, 3 E2E cases, and 7 UAT scenarios with real users.

### 2.1 Unit Testing

Verify individual components or business rules related to shift swapping, such as the monthly swap limit, the maximum number of consecutive working days, request validation, the two-supervisor approval rule, and the schedule update after an approved swap.

### 2.2 Integration Testing

Verify interactions between the application components needed for the shift swap workflow (request, approval, schedule update, and the Audit Trail record) and the basic prerequisites provided by external services, including company account authentication and employee data availability. Internal SSO configuration and advanced data synchronization remain out of scope. Cases IT-06 and IT-07 submit a request without the user interface, using an API call or a test script. Unit and integration tests are run with an automated test framework.

### 2.3 End-to-End (E2E) Testing

Verify the complete shift swap workflow, from viewing the schedule and submitting a request, through the required approvals, to updating the shift schedule. This includes a rejected request.

### 2.4 User Acceptance Testing (UAT)

Conduct UAT with real users to evaluate whether the shift swap workflow meets their needs in actual working scenarios. The test plan involves 5 real users (3 employees and 2 shift supervisors), with each user participating in 2 sessions, resulting in a total of 10 testing sessions.

- Session 1 – Basic Shift Swap: employees view their shift schedule, select a shift, and submit a shift swap request. Supervisors review a pending request.
- Session 2 – Approval and Validation: employees check the request status, verify the updated schedule, and try the business rules (monthly swap limit, maximum consecutive working days, etc.). Supervisors approve or reject a request and check its status.

Task completion results and user feedback will be collected. The System Usability Scale (SUS) will be used to evaluate usability.

**Actual:** 10 real users took part (8 employees and 2 shift supervisors), giving 20 sessions. See §4.2.

### 2.5 Testing Pyramid

The largest number of cases is at the unit level (8), fewer are at the integration level (7), and the fewest are at the E2E level (3). Business rules such as the monthly swap limit and the consecutive working day limit are verified first as unit tests because they are fast to run. They are then checked once through the system as integration tests, and finally by real users in UAT07. E2E tests are kept for complete workflows: viewing the schedule, a successful swap, and a rejected swap.

## 3. Test Cases and UAT Scenarios

This section lists 8 unit cases, 7 integration cases, 3 E2E cases, and 7 UAT scenarios. Actual Result and Pass/Fail are filled in during execution. A test case passes when the actual result matches the expected result. Otherwise it fails and the difference is recorded as a defect.

### 3.0 Test Data

Test Data lists the accounts and schedules used by the test cases, so that anyone who sets up the same data gets the same result. All data is fictional and is reset before every test case. The test date is 4 November 2026 and the swap date is 5 November 2026 unless a case says otherwise.

| Test Data | Description |
| --- | --- |
| Employee A | Shift A. Works the day shift on 6 Nov. No swaps in November. |
| Employee B | Shift B. Works the night shift on 6 Nov. No swaps in November. |
| Employee C | Same schedule as Employee A. 1 approved swap in November. |
| Employee D | Same schedule as Employee A. 2 approved swaps in November. |
| Employee E | Works 30 Oct to 4 Nov. Off on 5 Nov. This schedule is prepared on purpose to test the six-day limit. |
| Supervisor A | Shift supervisor of Shift A. |
| Supervisor B | Shift supervisor of Shift B. |

### 3.1 Unit Testing

| Test Case ID | Test Scenario | Test Data | Test Steps | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| UT-01 | Monthly Shift Swap Limit – Within Limit | Employee C (1 approved swap in November). New request for 5 Nov. | 1) Open the unit test suite for monthly swap limit validation. 2) Set up the test data for Employee C. 3) Run the validation for another swap request. | The request passes the monthly swap limit validation because the employee has not exceeded the limit of 2 swaps per month. | Request pass | pass |
| UT-02 | Monthly Shift Swap Limit – Limit Reached | Employee D (2 approved swaps in November). New request for 5 Nov. | 1) Open the unit test suite for monthly swap limit validation. 2) Set up the test data for Employee D. 3) Run the validation for an additional swap request. | The additional request fails the monthly swap limit validation. | Request fail | pass |
| UT-03 | Maximum Consecutive Working Days – Six Days | Employee E works 30 Oct to 4 Nov (6 consecutive days). | 1) Open the unit test suite for consecutive working day validation. 2) Prepare Employee E's schedule with 6 consecutive working days. 3) Run the schedule validation. | The schedule passes the validation because it does not exceed 6 consecutive working days. | The schedule passes the validation because it does not exceed 6 consecutive working days. | pass |
| UT-04 | Maximum Consecutive Working Days – Seven Days | Employee E's schedule with 5 Nov added (30 Oct to 5 Nov, 7 consecutive days). | 1) Open the unit test suite for consecutive working day validation. 2) Prepare Employee E's schedule with 7 consecutive working days. 3) Run the schedule validation. | The schedule fails the validation because it exceeds the maximum of 6 consecutive working days. | The schedule fails the validation because it exceeds the maximum of 6 consecutive working days. | pass |
| UT-05 | Shift Swap Request Validation – Complete Data | Request with requester Employee A, partner Employee B, and the shift on 5 Nov, submitted on 4 Nov. | 1) Open the unit test suite for shift swap request validation. 2) Prepare a request containing all required fields with valid values. 3) Run the request validation. | The request passes the required-field validation. | The request passes | pass |
| UT-06 | Shift Swap Request Validation – Missing Required Data | Same request as UT-05 without the partner (Employee B). | 1) Open the unit test suite for shift swap request validation. 2) Prepare a request with one required field missing. 3) Run the request validation. | The request fails validation and is not treated as a valid request. | The request fails validation | pass |
| UT-07 | Schedule Update – Approved Swap | 5 Nov: Employee A on the day shift, Employee B on the night shift. Approved swap between A and B for 5 Nov. | 1) Open the unit test suite for schedule update. 2) Prepare the schedule data and the approved swap. 3) Apply the swap to the schedule. | On 5 Nov, Employee A is on the night shift and Employee B is on the day shift. No other date changes. | Shift changed | pass |
| UT-08 | Approval Rule – Both Supervisors Required | Swap request between A and B. Approval from Supervisor A and Supervisor B, in either order. | 1) Open the unit test suite for request status. 2) Prepare the request with the approval of one supervisor only and evaluate the status. 3) Add the approval of the other supervisor and evaluate the status again. | After step 2 the request is still pending. After step 3 the request is approved. | After step 2 the request is still pending. After step 3 the request is approved. | pass |

### 3.2 Integration Testing

| Test Case ID | Test Scenario | Test Data | Test Steps | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| IT-01 | Company Account Login | Company test account of Employee A. | 1) Open the Shift Schedule Management login page. 2) Sign in using a valid company account. 3) Open the Shift Schedule page. | The user can sign in using the existing company account and access the schedule according to the assigned permissions. | Failed. The demo version does not support signing in with a company account. The tester signed in with the demo account of Employee A, which does not verify company-account login. | fail |
| IT-02 | Employee Information Availability | Employee A. | 1) Select a test employee whose source information is available. 2) Open the employee information or schedule in Shift Schedule Management. 3) Compare the employee ID, name, and team with the approved source data available to the tester. | The employee information displayed by the application matches the corresponding source data for the fields checked (employee ID, name, and team). | The employee ID, name, and team shown for Employee A match the demo seed data. | Pass (demo data only) |
| IT-03 | Approval Workflow and Schedule Update | Request between Employee A and Employee B for 5 Nov. Supervisor A and Supervisor B (either order). | 1) Submit a valid shift swap request using the test employee account. 2) Approve the request using the Supervisor A account. 3) Approve the request using the Supervisor B account. 4) Reopen the request and check its status. 5) Open the schedules of both employees. | The approval records are consistent with the request status. After all required approvals are complete, Employee A is on the night shift and Employee B is on the day shift on 5 Nov. | Using demo accounts, the approval records are consistent with the request status. After all required approvals are complete, Employee A is on the night shift and Employee B is on the day shift on 5 Nov. | pass |
| IT-04 | Pending Approval Does Not Update Schedule | Request between Employee A and Employee B for 5 Nov. Approval from Supervisor A only. | 1) Submit a valid shift swap request using the test employee account. 2) Approve the request using the Supervisor A account. 3) Leave the Supervisor B approval incomplete. 4) Check the request status. 5) Open the schedules of both employees. | The request remains awaiting the remaining required approval. The schedules are not updated: Employee A stays on the day shift and Employee B on the night shift on 5 Nov. | Using demo accounts, the request remains awaiting the remaining required approval. The schedules are not updated: Employee A stays on the day shift and Employee B on the night shift on 5 Nov. | pass |
| IT-05 | Audit Trail for Approved Shift Swap | Approved request from IT-03. | 1) Complete both required supervisor approvals as in IT-03. 2) Open the Audit Trail. 3) Locate the record related to the schedule change. 4) Check the available change details. | The system records the schedule change in the Audit Trail so the change can be reviewed, including the employees involved and the date changed. | The system records the schedule change in the Audit Trail, including the employees involved and the date changed. The record is attributed to the demo accounts used in IT-03. | pass |
| IT-06 | Monthly Shift Swap Limit Enforced by the System | Employee D (2 approved swaps in November) requests a swap with Employee B for 5 Nov. | 1) Sign in as Employee D. 2) Submit the swap request through the system's request function. 3) Check the system response and both schedules. | The system rejects the request because it exceeds the monthly limit. No request is created and neither schedule changes. | Signed in with the demo account of Employee D. The system rejects the request because it exceeds the monthly limit. No request is created and neither schedule changes. | pass |
| IT-07 | Maximum Consecutive Working Days Enforced by the System | Employee E works 30 Oct to 4 Nov and is off on 5 Nov. Employee A asks to swap the 5 Nov shift with Employee E. | 1) Sign in as Employee A. 2) Submit the swap request through the system's request function. 3) Check the system response and both schedules. | The system rejects the request because Employee E would work 7 consecutive days (30 Oct to 5 Nov). No request is created and neither schedule changes. | Signed in with the demo account of Employee A. The system rejects the request because Employee E would work 7 consecutive days (30 Oct to 5 Nov). No request is created and neither schedule changes. | pass |

### 3.3 End-to-End (E2E) Testing

| Test Case ID | Test Scenario | Test Data | Test Steps | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | View Monthly Shift Schedule | Employee A, November 2026, Shift A. | 1) Sign in to Shift Schedule Management using an authorized account. 2) Open Shift Schedule. 3) Select the required month and year. 4) Locate the relevant shift team and employee. 5) Check the displayed shift assignments. | The system displays the schedule for the selected month and year, with the relevant employee and shift information (Employee A on the day shift on 5 Nov). | The system displays the schedule for the selected month and year, with the relevant employee and shift information (Employee A on the day shift on 5 Nov). | pass |
| E2E-02 | Successful Shift Swap | Employee A swaps the 5 Nov shift with Employee B. Supervisor A and Supervisor B. | 1) Sign in as Employee A. 2) Open Shift Schedule and select the shift to swap. 3) Open Shift Swap/Change Request. 4) Select Employee B and the shift to exchange. 5) Review the request details and submit the request. 6) Sign in as Supervisor A and approve the request. 7) Sign in as Supervisor B and approve the request. 8) Check the request status and both employees' schedules. | The request is recorded and approved by both required supervisors. On 5 Nov, Employee A is on the night shift and Employee B is on the day shift. | The request is recorded and approved by both required supervisors. On 5 Nov, Employee A is on the night shift and Employee B is on the day shift. | pass |
| E2E-03 | Rejected Shift Swap | Same request as E2E-02. Supervisor A rejects the request and Supervisor B takes no action. | 1) Sign in as Employee A and submit a valid shift swap request. 2) Sign in as Supervisor A. 3) Open the pending request. 4) Reject the request. 5) Check the request status. 6) Check both employees' schedules. | The request is recorded as rejected, and neither employee's schedule is changed as a result of the rejected request (Employee A on the day shift and Employee B on the night shift on 5 Nov). | The request is recorded as rejected, and neither employee's schedule is changed as a result of the rejected request (Employee A on the day shift and Employee B on the night shift on 5 Nov). | pass |

### 3.4 User Acceptance Testing (UAT)

Each participant uses a prepared test account with the data below. The team plays the other roles needed by a scenario (for example the swap partner or the second supervisor). The test steps are for the observer. The participant is given only the goal of the task (for example, "You cannot work on 5 November. Ask to swap that day with Employee B.") and is not told which menu or button to use. A UAT scenario passes when the participant completes it without help from the observer.

| Test Case ID | Test Scenario | Test Data | Test Steps | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| UAT01 | Employee Views Personal Shift Schedule | Employee account with the day shift on 5 Nov. | 1) Sign in using the employee's company account. 2) Open Shift Schedule or My Schedule View. 3) Locate the shift on 5 Nov. 4) Identify the assigned shift or day off. | The employee can find and understand their own shift assignment for the selected day. | The employee can find and understand their own shift assignment for the selected day. | pass |
| UAT02 | Employee Submits a Shift Swap Request | Employee A. Swap partner: Employee B. Date: 5 Nov. | 1) Open the employee's schedule. 2) Select a shift to swap. 3) Open Shift Swap/Change Request. 4) Select the other employee and the shift to exchange. 5) Review the request and submit it. 6) Locate the submitted request. | The employee can submit a valid request and locate the request afterward. | The employee can submit a valid request and locate the request afterward. | pass |
| UAT03 | Employee Checks Request Status | Request from Employee A approved by both supervisors (the Session 1 request, or a prepared one). | 1) Sign in as an employee who has submitted a swap request. 2) Open the request list or relevant request details. 3) Locate the submitted request. 4) Identify its current status. | The employee can locate the request and understand its current approval status (approved). | The employee can locate the request and understand its current approval status | pass |
| UAT04 | Supervisor Reviews a Pending Request | Supervisor A. Pending request between Employee A and Employee B for 5 Nov. | 1) Sign in using the assigned supervisor account. 2) Open Approval Workflow. 3) Locate the pending request. 4) Open the request details. 5) Review the employees and shifts involved. | The supervisor can locate the assigned request and understand the information needed to review it. | The supervisor can locate the assigned request and understand the information needed to review it. | pass |
| UAT05 | Supervisor Approves or Rejects a Request | Pending request between Employee A and Employee B. One supervisor approves and the other rejects, each using a separate prepared request. | 1) Open a pending request using the supervisor account. 2) Review the request details. 3) Carry out the assigned action: approve or reject. 4) Reopen the request or request list. 5) Check the recorded status. | The selected decision is recorded correctly and the request status reflects that decision. | The selected decision is recorded correctly and the request status reflects that decision. | pass |
| UAT06 | User Verifies the Schedule After Approval | Fully approved request between Employee A and Employee B for 5 Nov. | 1) Use a request that has received all required approvals. 2) Open the schedules of both employees. 3) Locate the affected dates. 4) Compare the displayed shifts with the approved request. | The displayed schedules match the approved shift swap for both employees (Employee A on the night shift and Employee B on the day shift on 5 Nov). | The displayed schedules match the approved shift swap for both employees (Employee A on the night shift and Employee B on the day shift on 5 Nov). | pass |
| UAT07 | User Verifies Shift Swap Restrictions | Employee D (monthly limit reached) for the first request. Employee A requesting the exchange with Employee E described in IT-07 (7 consecutive days) for the second request. | 1) Use the prepared test account that has reached the monthly swap limit. 2) Attempt another swap request and record the system response. 3) Use the prepared schedule for a swap that would cause 7 consecutive working days. 4) Attempt the prepared swap and record the system response. 5) Check whether either invalid request changed the schedule. | The system enforces both the monthly swap limit and the maximum of 6 consecutive working days. Neither invalid request results in an invalid schedule. | The system enforces both the monthly swap limit and the maximum of 6 consecutive working days. Neither invalid request results in an invalid schedule. | pass |

## 4. UAT Execution Plan and Session Records

UAT had 10 planned sessions: 5 participants, 2 sessions each. **Actual:** 20 sessions with 10 participants.

### 4.1 UAT Session Structure

One session is one participant completing the assigned tasks of one UAT session while a team member observes and records the results. Team members do not count as participants. A session counts toward the 10 planned sessions only when its session record is completed.

User Acceptance Testing (UAT) is divided into two sessions to evaluate different stages of the shift swap workflow. Session 1 focuses on submitting a shift swap request, while Session 2 focuses on checking the request status, verifying the updated shift schedule after approval, and trying the business rules. Separating the sessions allows the testing to cover both the request submission process and the user's ability to verify the outcome.

Session 2 requires an approved shift swap request. The request submitted during Session 1 may be used if approval is completed in time; otherwise, a prepared test request can be used.

| Session | Objective | Main Activities | UAT Scenarios |
| --- | --- | --- | --- |
| Session 1 | Evaluate shift swap request submission | Employees: log in, view the shift schedule, and submit a shift swap request. Supervisors: review a pending request. | UAT01, UAT02, UAT04 |
| Session 2 | Evaluate request tracking, schedule verification, and business rules | Employees: check the request status after approval, verify the updated schedule, and try the business rules. Supervisors: approve or reject a request and check its status. | UAT03, UAT05, UAT06, UAT07 |

### 4.2 UAT Participants and Session Plan

**Planned:** 3 employees (U01–U03) and 2 shift supervisors (U04–U05). **Actual:** 8 employees and 2 shift supervisors. The paper sheets did not carry individual codes, so codes U01–U10 were assigned afterwards in scan order; the mapping is in the [UAT results](2026-11-03-uat-results.md).

| Participant ID | User Role | Session 1 | Session 2 |
| --- | --- | --- | --- |
| U01 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U02 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U03 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U04 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U05 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U06 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U07 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U08 | Employee | UAT01, UAT02 | UAT03, UAT06, UAT07 |
| U09 | Shift Supervisor | UAT04 | UAT05 (approve a request) |
| U10 | Shift Supervisor | UAT04 | UAT05 (approve a request) |

Both supervisor sheets record an approval, so the "reject" path of UAT05 was not tested with a real user. It was covered by E2E-03.

### 4.3 UAT Session Records

A session record is kept for each UAT session to document the participant's activities, observations, and feedback. These records help identify usability issues and difficulties encountered while completing the assigned tasks. For tasks M-01 to M-04, the time, number of errors, and help requests are written in the Observation / User Feedback column.

| Session ID | Participant ID | Test Date | Activity | Observation / User Feedback | Issue / Defect Reference |
| --- | --- | --- | --- | --- | --- |
| UAT-S01 | U01 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S02 | U01 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Completed. | — |
| UAT-S03 | U02 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S04 | U02 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Old method for checking status: about 1–3 days of waiting for the supervisor. UAT07: the system answered that swap rights were already used and the request was not allowed, as expected. | [ISS-04](issue-log.md) (closed) |
| UAT-S05 | U03 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S06 | U03 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Completed. | — |
| UAT-S07 | U04 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S08 | U04 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Old method for checking status: 2–3 days. | — |
| UAT-S09 | U05 | 3 Nov 2026 | View schedule and submit a shift swap request | Problem noted with colours on UAT01 ⚠. Submitting a swap took 5 min in the new system vs 2 min by phone; ease 3/5. | [ISS-01](issue-log.md), [ISS-02](issue-log.md) |
| UAT-S10 | U05 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Completed. | — |
| UAT-S11 | U06 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S12 | U06 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Completed. | — |
| UAT-S13 | U07 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S14 | U07 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | Suggests showing leave balances by type, with totals and days used in the year. | [ISS-03](issue-log.md) |
| UAT-S15 | U08 | 3 Nov 2026 | View schedule and submit a shift swap request | Completed. | — |
| UAT-S16 | U08 | 3 Nov 2026 | Check request status and updated schedule; swap restrictions | UAT07: system answered that the swap quota was used up / the shift was already changed, as expected. | — |
| UAT-S17 | U09 | 3 Nov 2026 | Review a pending shift swap request | Completed. | — |
| UAT-S18 | U09 | 3 Nov 2026 | Approve a request | Completed. | — |
| UAT-S19 | U10 | 3 Nov 2026 | Review a pending shift swap request | Completed. | — |
| UAT-S20 | U10 | 3 Nov 2026 | Approve a request | Completed. | — |

Times for M-01 to M-04 are in §5.2. Errors and help requests were not recorded on the sheets. ⚠ marks handwriting that must be checked against the original scan.

## 5. Metrics

Task results are compared before (old method) and after (new system). Usability is measured with SUS.

### 5.1 Task Performance Metrics

Task performance metrics are used to evaluate whether the Shift Schedule Management system improves the efficiency and accuracy of shift management tasks. Performance is compared between the old method and the new Shift Schedule Management system. The evaluation measures task completion rate, task completion time, and error rate.

| Metric | Measurement Method | Desired Result |
| --- | --- | --- |
| Task Completion Rate | Percentage of assigned tasks completed successfully | Higher completion rate |
| Task Completion Time | Time required to complete each task, measured in minutes | Reduced completion time |
| Error Rate | Number of errors encountered while completing assigned tasks | Lower error rate |

### 5.2 Before-and-After Task Evaluation

Participants perform representative shift management tasks using the old method and the new system. Tasks M-01 to M-04 are measured with the three employee participants (U01 to U03) and correspond to UAT01, UAT02, UAT03, and UAT06. Supervisor sessions are evaluated with UAT results and SUS.

| Task ID | Task | Before: Old Method | After: New System | Results to Measure |
| --- | --- | --- | --- | --- |
| M-01 | View shift schedule | 1) Employee opens the Excel shift schedule. 2) Employee finds their own shift on 5 Nov. | 1) Sign in with the company account. 2) Open Shift Schedule or My Schedule View. 3) Locate the shift on 5 Nov. | Completion status and time |
| M-02 | Submit shift swap request | 1) Employee calls the other employee to agree on the shift swap. 2) Employee calls the supervisor to report the swap. | 1) Open the employee's schedule and select the shift to swap. 2) Open Shift Swap/Change Request. 3) Select the other employee and the shift to exchange. 4) Review and submit the request. | Completion status, time, and errors |
| M-03 | Check request status | 1) Supervisor reviews the swap against the conditions (swap limit and consecutive working days). 2) Employee calls the supervisor to ask whether the swap is approved. | 1) Open the request list or request details. 2) Locate the submitted request. 3) Read its approval status. | Completion status, time, and errors |
| M-04 | Verify approved shift swap | 1) Supervisor changes the shifts in the Excel schedule. 2) Employee opens the Excel schedule and checks that both shifts match the approved swap. | 1) Open the schedules of both employees. 2) Locate the affected dates. 3) Compare the displayed shifts with the approved request. | Completion status, time, and errors |

Before-and-After Measurement Record

Results for the 8 employees (U01–U08), median minutes. Times are the participants' own estimates written on the UAT sheet, not observer timings; per-participant values are in the [UAT results](2026-11-03-uat-results.md).

| Task ID | Before: Completed (Yes/No) | Before: Time (min) | Before: Errors | After: Completed (Yes/No) | After: Time (min) | After: Errors |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | Not observed (estimate) | 1.25 | Not recorded | Yes (8/8) | 1.0 | Not recorded |
| M-02 | Not observed (estimate) | 5.0 | Not recorded | Yes (8/8) | 3.0 | Not recorded |
| M-03 | Not observed (estimate) | 3.5 (n = 6; 2 answered in days: 1–3 and 2–3) | Not recorded | Yes (8/8) | 2.0 | Not recorded |
| M-04 | Not observed (estimate) | 2.0 | Not recorded | Yes (8/8) | 1.0 | Not recorded |

Task completion rate is the percentage of assigned tasks completed successfully without help from the observer. Task completion time starts when the participant has read the task and stops when the participant says the task is done, and is measured in minutes. An error is an incorrect action that the participant has to undo or repeat, such as choosing the wrong date or the wrong employee. Results are summarized per task as the mean and the median for the old method and the new system. With 5 participants, the comparison is descriptive and is not a statistical test.

### 5.3 System Usability Scale (SUS)

The System Usability Scale (SUS) is used to evaluate participants' perceived usability of the Shift Schedule Management system. After completing their assigned UAT tasks, participants answer the standard 10-item SUS questionnaire using a five-point response scale.

The SUS score is calculated on a scale from 0 to 100. For each odd-numbered item, subtract 1 from the response. For each even-numbered item, subtract the response from 5. Add the adjusted scores and multiply the total by 2.5 to obtain the final SUS score.

SUS Questionnaire and Score Recording

| No. | SUS Statement | Participant Response (1–5) | Adjusted Score |
| --- | --- | --- | --- |
| 1 | I think that I would like to use this system frequently. |  |  |
| 2 | I found the system unnecessarily complex. |  |  |
| 3 | I thought the system was easy to use. |  |  |
| 4 | I think that I would need the support of a technical person to be able to use this system. |  |  |
| 5 | I found the various functions in this system were well integrated. |  |  |
| 6 | I thought there was too much inconsistency in this system. |  |  |
| 7 | I would imagine that most people would learn to use this system very quickly. |  |  |
| 8 | I found the system very cumbersome to use. |  |  |
| 9 | I felt very confident using the system. |  |  |
| 10 | I needed to learn a lot of things before I could get going with this system. |  |  |
|  | Total Adjusted Score |  |  |
|  | Final SUS Score (Total × 2.5) |  |  |

Participants select one response for each statement: 1 = Strongly disagree, 2 = Disagree, 3 = Neither agree nor disagree, 4 = Agree, 5 = Strongly agree. The questionnaire is completed after participants have used the new system, and the final scores are used to summarize participants' perceived usability.

Interpreting the SUS score. The final SUS score is a number from 0 to 100. It is not a percentage. It is read by comparing it with a benchmark: the average SUS score is 68, so a score above 68 is above average and a score below 68 is below average. The table shows the acceptability for each score range.

| SUS Score | Acceptability |
| --- | --- |
| 71.1 to 100 | Acceptable |
| 51.7 to 71.0 | Marginal |
| 0 to 51.6 | Not acceptable |

The team reports the SUS score of each participant and the mean score of all participants. Source: 5 Ways to Interpret a SUS Score (MeasuringU).

**Results.** The paper form given to participants had only items 1–9. Item 10 was collected afterwards on a separate sheet from all 10 participants, so every participant has a standard SUS score.

| Group | SUS mean | Range |
| --- | --- | --- |
| Employees (U01–U08) | 71.3 | 50.0–82.5 |
| Supervisors (U09–U10) | 70.0 | 67.5–72.5 |
| All (n = 10) | 71.0 | 50.0–82.5 |

71.0 is above the SUS average of 68. Against the table above it sits at the top of "Marginal" (51.7–71.0), 0.1 below "Acceptable".

Per-participant responses are in the [UAT results](2026-11-03-uat-results.md).

## 6. Test Schedule, Owners, and Exit Criteria

Testing is planned for 4 November 2026.

### 6.1 Test Schedule

The planned activities cover Unit Testing, Integration Testing, End-to-End Testing, and User Acceptance Testing (UAT). The schedule below identifies the planned activities and allows the actual execution dates to be recorded. On 4 November, the unit, integration, and E2E tests are run first, followed by the UAT sessions. Session 2 starts after the Session 1 requests are approved or the prepared requests are ready.

| Test Level | Planned Activity | Planned Date | Actual Date |
| --- | --- | --- | --- |
| Unit Testing | Verify individual functions and business rules | 4 November 2026 | 2 November 2026 |
| Integration Testing | Verify interactions between connected components | 4 November 2026 | 2 November 2026 |
| End-to-End Testing | Verify the complete shift swap workflow | 4 November 2026 | 2 November 2026 |
| User Acceptance Testing | Evaluate the workflow with representative users | 4 November 2026 | 3 November 2026 |

### 6.2 Test Owners

| Test Level | Responsible Role | Owner | Responsibility |
| --- | --- | --- | --- |
| Unit Testing | Developer | Juladit Teekawiwat | Test individual functions and business rules |
| Integration Testing | Developer / QA Tester | Alisa Pansomkid | Verify interactions between connected components |
| End-to-End Testing | QA Tester | Alisa Pansomkid | Execute complete workflows and record results |
| User Acceptance Testing | Team member running the sessions | Charuwan Kasaempan | Run the sessions, observe, and record results |
| User Acceptance Testing | Employee / Shift Supervisor (participants) | Participant IDs U01 to U10 | Perform assigned tasks and provide feedback |
| Test data and accounts | Developer / QA Tester | Alisa Pansomkid | Prepare and reset test accounts and data before every test case and each UAT session |

Participants are recorded by code only. The original paper sheets are kept outside this repository.

### 6.3 Exit Criteria

Testing is considered complete when all of the following are true. The status of each criterion after testing is in the [UAT results](2026-11-03-uat-results.md) (§1).

- All planned test cases have been executed, or any unexecuted case is documented with a reason.
- All core workflow cases (IT-03, E2E-01, E2E-02, and E2E-03) have passed.
- At least 90% of all unit, integration, and E2E cases have passed.
- No critical defect is open. A critical defect prevents a swap request from being submitted or approved, or leads to an incorrect schedule. All other defects are documented.
- At least 10 UAT sessions have been completed, each with a session record.
- Task results (old method and new system) and a SUS score from every participant have been recorded.

### 6.4 Planned for the Next Test Round

The rules and cases below were added on the `shiftflow-shift-management` branch on 13 November 2026 for the shared Supabase demo. They were **not part of the test round executed on 2–3 November 2026** and have no results yet. Their test data follows the earlier plan (swap date 4 November); align it with §3.0 before running them.

**Reverse swap:** Employees can submit a new swap request following steps 1–5 of §1.2. It follows the usual approval rules and uses a slot from its requester's quota when approved. The original approval and quota use remain in effect.

**Example:** A submits a request to swap shifts with B. Once fully approved, it counts as one swap toward A's monthly limit. If B later submits a reverse swap request and it is fully approved, it counts as one swap toward B's monthly limit. A's original swap still counts toward A's limit.

**Cancellation of an approved swap:** Before the earliest affected shift begins, the original requester can cancel when all affected roster entries still match the approved result. Successful cancellation restores all original assignments and one slot in the original requester's month while preserving approval history. [Business Rules, section 6](../01-requirements/01-spec/2026-11-04-01-business-rules-master.md#6-การอนุมัติ-สถานะ-และการยกเลิก)

| Test Case ID | Test Scenario | Test Data | Test Steps | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-04 | Reverse Swap | Schedule after E2E-02 (Employee A on the night shift, Employee B on the day shift on 4 Nov). Employee B has no earlier request this month, so the reverse request is within the monthly limit. | 1) Sign in as Employee B. 2) Open Shift Schedule and select the shift to swap on 4 Nov. 3) Open Shift Swap/Change Request. 4) Select Employee A and the shift to exchange. 5) Review the request details and submit the request. 6) Sign in as the first required supervisor and process the request. 7) Sign in as the other required supervisor and complete the approval. 8) Check the request status and both employees' schedules. | The reverse request is recorded as a new request and approved by both required supervisors. The schedules return to the original: Employee A on the day shift and Employee B on the night shift on 4 Nov. | Not executed | Not executed |
| E2E-05 | Cancel an Approved Swap | Future approved one-day or two-date swap by A and B with no subsequent changes. | 1) Sign in as A. 2) Open the approved request before the earliest affected shift. 3) Cancel and confirm. 4) Check the request, both schedules, and A's monthly quota. | The request is cancelled. All affected assignments are restored, one slot returns to A in the same month, and the original approval history is retained. | Not executed | Not executed |

## 7. AI Usage

AI was used to help draft the test cases in this plan, covering the different test levels and the user acceptance scenarios. The drafts were then checked and adjusted by the team so that they match the shift swap workflow described in this plan.
