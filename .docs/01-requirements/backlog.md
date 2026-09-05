# Shift Schedule System — Product Backlog

## 1. Product Overview

**Product:** Shift Schedule System

**Goal:**
Replace the current Microsoft Excel-based shift scheduling process and phone-based coordination with a centralized scheduling system that acts as a single source of truth for schedules, approvals, validations, notifications, and HR export.

This system must support continuous 24-hour / 7-day operations and reduce scheduling errors, administrative effort, and supervisor coordination overhead.

**Current requirements specification:** [2026-09-02-01-shift-scheduling.md](01-spec/2026-09-02-01-shift-scheduling.md). The specification links the current MVP and compliance stories to functional, non-functional, and legal requirements; deferred Phase 1/2 stories are explicitly identified for later specification work. No backlog story IDs or priorities are changed by that document.

---

## 2. User Roles

| Role | Description |
| --- | --- |
| Shift Operator | View their own schedule, view authorized team schedules, and submit shift change, swap, or day-off requests. |
| Shift Supervisor | Create, edit, and delete schedules, and approve or reject employee requests. |
| HR | View and export schedule data for payroll and OT calculation. |
| Contractor / Van Driver | View daily work schedules and employee pickup/drop-off information; read-only access. |

---

## 3. Shift Definitions

| Code | Description | Working Time |
| --- | --- | --- |
| M | Normal Morning/Day Shift | 07:30–19:30 |
| MT | Morning/Day Shift with OT | 07:30–19:30 + OT handover period |
| N | Normal Night Shift | 19:30–07:30 |
| NT | Night Shift with OT | 19:30–07:30 + OT handover period |
| D | Normal Working Hours | 08:00–17:00 |
| O / Blank | Off Day | No scheduled work |
| V | Vacation Leave | Leave |
| B | Business Leave | Leave |
| S | Sick Leave | Leave |
| H | Holiday / Traditional Holiday | Holiday |

> Shift codes and working hours are based on the current schedule documentation. The exact OT calculation rules and HR payroll interface should be confirmed during detailed requirements.

---

## 4. Epic Summary

| Epic | Name | Priority |
| --- | --- | --- |
| E01 | Authentication & Role-Based Access | P0 |
| E02 | Employee & Shift Team Management | P0 |
| E03 | Shift Schedule Management | P0 |
| E04 | Schedule Validation & Business Rules | P0 |
| E05 | Shift Change Request | P0 |
| E06 | Shift Swap Request | P0 |
| E07 | Day-Off / Leave Request | P0 |
| E08 | Approval Workflow | P0 |
| E09 | Real-Time Schedule & Notifications | P0 |
| E10 | HR Export & Integration | P0 |
| E11 | Contractor / Van Driver Schedule | P1 |
| E12 | Audit Trail & Schedule History | P1 |
| E13 | Mobile & Responsive Experience | P0 |
| E14 | Reporting & Dashboard | P2 |

---

## 5. Product Backlog

### E01 — Authentication & Role-Based Access

#### US-001 — User Login

**User Story**
As a user, I want to log in to the system so that I can securely access shift scheduling functions.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- User can enter valid authentication credentials.
- Successful authentication redirects the user to the appropriate landing page.
- Invalid credentials display an appropriate error message.
- Unauthenticated users cannot access protected pages.
- User session is maintained while the user is active.

---

#### US-002 — Role-Based Access Control

**User Story**
As a System Administrator, I want to assign roles so that each user can access only functions relevant to their responsibility.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- System supports Operator, Supervisor, HR, and Contractor/Van Driver roles.
- Each role has defined permissions.
- Unauthorized actions are blocked.
- API/backend authorization is enforced in addition to UI restrictions.

---

#### US-003 — Role-Specific Landing Page

**User Story**
As a user, I want to see a role-specific dashboard after login so that I can quickly access relevant information.

**Priority:** P1  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Operator sees My Shift / relevant schedule information.
- Supervisor sees team schedule and pending requests.
- HR sees schedule/export functions.
- Driver sees Today's Schedule.

---

#### US-004 — Data Visibility by Role

**User Story**
As a system owner, I want schedule data to be restricted by role and team so that users cannot access unauthorized employee information.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Operator can access their own schedule and authorized team information.
- Supervisor can access assigned team(s).
- HR can access required organization-wide schedule data.
- Driver can access only information required for transportation.
- Unauthorized employee data cannot be accessed through direct URLs or APIs.

---

### E02 — Employee & Shift Team Management

#### US-005 — Employee Profile

**User Story**
As a Supervisor, I want to view employee information so that I can assign the correct person to a shift.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Employee has an employee ID.
- Employee has a name.
- Employee has contact information where permitted.
- Employee has an assigned shift team.
- Employee has a role/position.
- Employee can have relevant skills defined.

---

#### US-006 — Shift Team Management

**User Story**
As a Supervisor, I want employees to be grouped into shift teams so that I can manage schedules by team.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- System supports Shift Team A, B, C, and D.
- Employees can be assigned to a shift team.
- A Supervisor can be assigned to a team.
- Team membership is used for schedule visibility and approval routing.

---

#### US-007 — Position and Skill Management

**User Story**
As a Supervisor, I want each employee's position and skills to be recorded so that the system can validate shift assignments and swaps.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Employee can have one or more skills/qualifications.
- Employee can have an assigned position.
- Skills can be checked during schedule assignment.
- Skills can be checked during shift swap.

---

### E03 — Shift Schedule Management

#### US-008 — Monthly Schedule Grid

**User Story**
As a Supervisor, I want to view the shift schedule in a monthly grid so that I can manage the entire team's schedule.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Monthly calendar/grid is displayed.
- Employees are listed against calendar dates.
- Shift codes are displayed in each schedule cell.
- Team can be selected.
- Month can be changed.
- Schedule information is clearly readable.

---

#### US-009 — Create Schedule

**User Story**
As a Supervisor, I want to assign a shift to an employee on a specific date so that I can create the monthly schedule.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Supervisor can select employee.
- Supervisor can select date.
- Supervisor can select a valid shift code.
- System validates business rules before saving.
- Invalid assignments cannot be saved.
- Successful changes are recorded.

---

#### US-010 — Edit Schedule

**User Story**
As a Supervisor, I want to edit an existing schedule so that I can reflect approved changes.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Supervisor can select an existing schedule.
- Supervisor can change the assigned shift.
- Validation is executed before saving.
- Schedule history is recorded.
- Authorized users see the updated schedule.

---

#### US-011 — Delete / Cancel Schedule

**User Story**
As a Supervisor, I want to remove or cancel a schedule assignment so that the schedule reflects the actual plan.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Supervisor can cancel an existing schedule.
- System validates whether cancellation is allowed.
- Existing schedule data is not silently deleted.
- Change is recorded in the audit/history.

---

#### US-012 — My Shift

**User Story**
As an Operator, I want to view my own schedule so that I know when I am working and when I am off.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- User can view current and future schedules.
- Shift code is displayed.
- Working date is displayed.
- Working time is displayed.
- Leave and off-day status are displayed.

---

#### US-013 — Team Schedule View

**User Story**
As an Operator, I want to view the authorized team schedule so that I can understand team coverage.

**Priority:** P1  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- User can view authorized team schedules.
- Unauthorized teams are hidden.
- Employee and shift information is displayed according to access permissions.

---

#### US-014 — Shift Code Management

**User Story**
As a Supervisor, I want to use standardized shift codes so that schedule information is consistent.

**Priority:** P0  
**Story Points:** 2  
**Release:** MVP

**Acceptance Criteria**
- System supports M, MT, N, NT, D, O/Blank, V, B, S, and H.
- Each code has a defined meaning.
- Each code has configured working time or leave status.
- Schedule displays the code consistently.

---

### E04 — Schedule Validation & Business Rules

#### US-015 — Maximum Consecutive Working Days

**User Story**
As a Supervisor, I want the system to prevent employees from working more than 6 consecutive days so that scheduling complies with company rules.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- System checks consecutive working days before saving a schedule.
- Maximum allowed consecutive working days is 6.
- Employee must have at least 1 rest day before returning to work.
- Invalid schedules cannot be approved/saved unless an explicitly defined exception process exists.
- Validation result explains the reason for rejection.

---

#### US-016 — Position / Skill Validation

**User Story**
As a Supervisor, I want the system to verify employee skills and positions so that only qualified employees can be assigned to a shift.

**Priority:** P0  
**Story Points:** 8  
**Release:** MVP

**Acceptance Criteria**
- System checks employee position.
- System checks required skills for the assigned position/shift.
- Unqualified employees cannot be assigned where the rule prohibits it.
- Validation error identifies the missing requirement.

---

#### US-017 — Schedule Change Time Restriction

**User Story**
As a Supervisor, I want schedule changes to follow the configured time window so that changes are controlled.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- System validates the allowed change period.
- Changes outside the configured period require the appropriate exception process.
- The current requirement supports a configurable restriction around the original schedule date.
- The exact rule must be confirmed during detailed requirement gathering.

---

#### US-018 — Minimum Advance Processing Time

**User Story**
As a Supervisor, I want planned leave and schedule changes to be completed at least one day in advance so that staffing can be prepared.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Planned requests must be submitted and approved at least 1 day before the affected shift.
- System blocks normal planned changes after the cutoff.
- Emergency sick leave can follow a separate exception workflow.

---

#### US-019 — Team Coverage Validation

**User Story**
As a Supervisor, I want the system to verify team coverage so that required positions are not left unstaffed.

**Priority:** P0  
**Story Points:** 8  
**Release:** MVP

**Acceptance Criteria**
- System checks required staffing for a shift.
- System identifies missing positions.
- Supervisor receives a warning/error when a schedule creates insufficient coverage.
- Required staffing configuration can be maintained separately from employee data.

---

### E05 — Shift Change Request

#### US-020 — Submit Shift Change Request

**User Story**
As an Operator, I want to request a change from my assigned shift so that I can adjust my working schedule when necessary.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Operator can select an affected date.
- Operator can select the requested shift.
- Operator can provide a reason.
- System validates the request.
- Request is created with Pending status.
- Supervisor is notified.

---

#### US-021 — View Shift Change Request Status

**User Story**
As an Operator, I want to see my request status so that I know whether it has been approved.

**Priority:** P0  
**Story Points:** 2  
**Release:** MVP

**Acceptance Criteria**
- Request status includes Pending, Approved, and Rejected.
- User can see submission date.
- User can see decision date.
- User can see rejection reason when applicable.

---

### E06 — Shift Swap Request

#### US-022 — Submit Shift Swap Request

**User Story**
As an Operator, I want to request a shift swap with another employee so that we can exchange working schedules.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Employee can select their own shift.
- Employee can select another eligible employee.
- Employee can select the shift/date to swap.
- System validates both employees.
- Request is created as Pending.
- Relevant Supervisor(s) receive the request.

---

#### US-023 — Maximum Shift Swaps per Month

**User Story**
As a system owner, I want to limit shift swaps so that frequent schedule changes can be controlled.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Employee can request no more than 2 shift swaps per month.
- System counts applicable swap requests according to the configured business rule.
- Requests exceeding the monthly limit are blocked.
- User receives a clear validation message.

---

#### US-024 — Cross-Team / Cross-Shift Approval

**User Story**
As a Supervisor, I want cross-shift or cross-team swaps to require approval from both responsible Supervisors so that both teams agree to the change.

**Priority:** P0  
**Story Points:** 8  
**Release:** MVP

**Acceptance Criteria**
- System identifies the Supervisor responsible for each employee/team.
- Both Supervisors must approve when required.
- Swap is not finalized until all required approvals are completed.
- Rejection by any required Supervisor rejects the request.
- Final schedule is updated only after all required approvals.

---

#### US-025 — Swap Skill Validation

**User Story**
As a Supervisor, I want the system to validate skills before approving a swap so that an employee is not moved into an unsuitable position.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Both employees' qualifications are checked.
- Required position/skill is checked.
- Invalid swaps cannot be approved.
- Validation failures are displayed to the Supervisor.

---

### E07 — Day-Off / Leave Request

#### US-026 — Submit Day-Off Change Request

**User Story**
As an Operator, I want to request a change to my day off so that I can adjust my schedule for personal needs.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Employee can select the affected date.
- Employee can specify the requested schedule.
- Employee can provide a reason.
- System validates consecutive working days.
- System validates schedule coverage.
- Request requires Supervisor approval.

---

#### US-027 — Leave Type Selection

**User Story**
As an Operator, I want to select the appropriate leave type so that the schedule accurately reflects my absence.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- System supports Vacation (V).
- System supports Business Leave (B).
- System supports Sick Leave (S).
- System supports Holiday (H).
- Leave type is stored with the schedule/request.

---

#### US-028 — Planned Leave Workflow

**User Story**
As an Operator, I want to submit planned leave in advance so that the Supervisor can arrange replacement staffing.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Planned leave follows the minimum advance processing rule.
- Supervisor can review staffing impact.
- Replacement/OT requirement can be identified.
- Schedule is updated only after required approval.

---

#### US-029 — Emergency Sick Leave

**User Story**
As an Operator, I want an emergency sick leave process so that unexpected absences can be recorded even when advance notice is impossible.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Emergency request can be recorded after the actual event where required.
- Supervisor can arrange replacement staffing.
- Replacement employee must pass consecutive-day validation.
- Actual schedule can be corrected retrospectively.
- Original and revised schedule information is retained in history.

---

#### US-030 — Replacement / OT Employee Validation

**User Story**
As a Supervisor, I want to validate a replacement employee before assigning OT so that the replacement does not violate scheduling rules.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Replacement employee must be eligible for the shift.
- Required skill/position is validated.
- Consecutive working days are checked.
- Invalid replacement assignments are rejected.

---

### E08 — Approval Workflow

#### US-031 — Pending Request Inbox

**User Story**
As a Supervisor, I want to see all pending requests so that I can process employee requests efficiently.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Pending requests are listed.
- Requests can be filtered by type.
- Requests can be filtered by employee/team/date.
- Request details can be opened.

---

#### US-032 — Approve Request

**User Story**
As a Supervisor, I want to approve a valid request so that the requested schedule change can take effect.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Supervisor can approve eligible requests.
- System performs final validation before approval.
- Approved request updates the schedule.
- Request status becomes Approved.
- Relevant users are notified.

---

#### US-033 — Reject Request

**User Story**
As a Supervisor, I want to reject a request with a reason so that employees understand why their request was not accepted.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Supervisor can reject a request.
- Rejection reason is required.
- Request status becomes Rejected.
- Employee is notified.

---

#### US-034 — Multi-Level Approval

**User Story**
As a system owner, I want requests requiring multiple approvals to remain pending until all required approvers have completed their decisions.

**Priority:** P0  
**Story Points:** 8  
**Release:** MVP

**Acceptance Criteria**
- System identifies required approvers.
- Each approval is recorded independently.
- Request is approved only when all required approvals are complete.
- Any required rejection causes the request to be rejected.
- Approval history is retained.

---

### E09 — Real-Time Schedule & Notifications

#### US-035 — Real-Time Schedule Update

**User Story**
As an Operator, I want approved schedule changes to appear immediately so that I always use the latest schedule.

**Priority:** P0  
**Story Points:** 8  
**Release:** MVP

**Acceptance Criteria**
- Approved changes update the central schedule.
- Authorized users can see the latest schedule without relying on Excel versions.
- Stale schedule data is minimized.
- Schedule updates are consistent across supported clients.

---

#### US-036 — Schedule Change Notification

**User Story**
As an affected employee, I want to receive a notification when my schedule changes so that I know about the latest assignment.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- User is notified after an approved schedule change.
- Notification identifies the affected date.
- Notification identifies the new shift.
- Notification links to the relevant schedule/request where supported.

---

#### US-037 — New Request Notification

**User Story**
As a Supervisor, I want to be notified when an employee submits a request so that I can process it promptly.

**Priority:** P1  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Supervisor receives notification for relevant new requests.
- Notification identifies request type and employee.
- Notification does not expose unauthorized information.

---

#### US-038 — Approval / Rejection Notification

**User Story**
As an Operator, I want to receive notification when my request is approved or rejected.

**Priority:** P1  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- Approved requests trigger notification.
- Rejected requests trigger notification.
- Rejection reason is included where appropriate.

---

#### US-039 — Single Source of Truth

**User Story**
As a business user, I want all authorized users to access the same current schedule so that multiple Excel versions do not cause conflicts.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Schedule is stored centrally.
- Users access the same schedule data according to permissions.
- Approved changes are reflected in the central schedule.
- System does not depend on manually distributed Excel files for operational schedule viewing.

---

### E10 — HR Export & Integration

#### US-040 — HR Schedule View

**User Story**
As HR, I want to view employee schedules so that I can verify working time and leave information.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- HR can view schedule data for the required employees.
- HR can filter by team/date/employee.
- HR can distinguish working shifts, leave, off days, and relevant OT codes.

---

#### US-041 — Export Schedule Data

**User Story**
As HR, I want to export schedule data so that I can use it for payroll and OT processing.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- HR can select a date range.
- HR can select relevant teams/employees.
- System exports schedule data.
- Export contains employee ID and schedule date.
- Export contains shift code.
- Export contains relevant leave information.
- Export contains relevant OT information.

---

#### US-042 — HR Export Format

**User Story**
As HR, I want the export format to match the required payroll/OT process so that manual data transformation is minimized.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Export format is agreed with HR.
- Required columns are defined.
- Date/time format is standardized.
- Shift and OT information is represented consistently.
- Export can be consumed by the existing HR process.

---

#### US-043 — OT Data Separation

**User Story**
As HR, I want normal working time and OT information to be distinguishable so that OT can be calculated correctly.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Normal shift duration is identifiable.
- OT period is identifiable.
- OT multiplier/type can be represented where required.
- The exact payroll calculation formula remains configurable/subject to HR confirmation.

---

### E11 — Contractor / Van Driver Schedule

#### US-044 — Today's Schedule

**User Story**
As a Van Driver, I want to see today's work schedule so that I know who I need to pick up or drop off.

**Priority:** P1  
**Story Points:** 3  
**Release:** Phase 1

**Acceptance Criteria**
- Driver can see today's schedule.
- Schedule is grouped by relevant route/time where configured.
- Driver cannot modify schedule data.

---

#### US-045 — Employee Pickup List

**User Story**
As a Van Driver, I want to see the employees assigned for transportation so that I know whom I need to pick up/drop off.

**Priority:** P1  
**Story Points:** 5  
**Release:** Phase 1

**Acceptance Criteria**
- Driver sees only employees relevant to the assigned transportation schedule.
- Employee information is limited to necessary transportation data.
- Schedule reflects the latest approved information.

---

#### US-046 — Read-Only Driver Access

**User Story**
As a system owner, I want Van Drivers to have read-only access so that they cannot accidentally modify schedules.

**Priority:** P0  
**Story Points:** 2  
**Release:** MVP

**Acceptance Criteria**
- Driver cannot create schedules.
- Driver cannot edit schedules.
- Driver cannot delete schedules.
- Driver cannot approve requests.
- Backend permissions also prevent modification.

---

### E12 — Audit Trail & Schedule History

#### US-047 — Schedule Change Audit

**User Story**
As a Supervisor/HR, I want to know who changed a schedule and when so that schedule changes are traceable.

**Priority:** P1  
**Story Points:** 5  
**Release:** Phase 1

**Acceptance Criteria**
- System records the user who made the change.
- System records timestamp.
- System records previous value.
- System records new value.
- System records the reason/source of change where applicable.

---

#### US-048 — Request Approval History

**User Story**
As a Supervisor/HR, I want to see approval history so that I can trace the decision process.

**Priority:** P1  
**Story Points:** 5  
**Release:** Phase 1

**Acceptance Criteria**
- Approval actions are recorded.
- Approver identity is recorded.
- Approval timestamp is recorded.
- Approval/rejection result is recorded.
- Rejection reason is retained.

---

#### US-049 — Schedule Revision History

**User Story**
As a Supervisor, I want to view previous schedule revisions so that I can compare planned and actual changes.

**Priority:** P2  
**Story Points:** 5  
**Release:** Phase 2

**Acceptance Criteria**
- Previous schedule versions can be viewed.
- Revision date/time is displayed.
- User responsible for the revision is displayed.
- Revision reason is displayed where available.

---

### E13 — Mobile & Responsive Experience

#### US-050 — Mobile My Shift

**User Story**
As an Operator, I want to view my shift schedule on a mobile device so that I can check my work schedule anywhere.

**Priority:** P0  
**Story Points:** 3  
**Release:** MVP

**Acceptance Criteria**
- My Shift is usable on mobile.
- Current and future shifts are readable.
- Shift time and status are visible.
- User can access relevant request functions.

---

#### US-051 — Mobile Request Submission

**User Story**
As an Operator, I want to submit shift change, swap, and day-off requests from mobile so that I do not need a PC.

**Priority:** P0  
**Story Points:** 5  
**Release:** MVP

**Acceptance Criteria**
- Operator can submit supported request types from mobile.
- Request validation is consistent with web.
- User can see request status.
- User receives request result notification.

---

#### US-052 — Responsive Supervisor Schedule

**User Story**
As a Supervisor, I want the schedule interface to remain usable on supported devices so that I can review schedules when needed.

**Priority:** P1  
**Story Points:** 5  
**Release:** Phase 1

**Acceptance Criteria**
- Schedule can be viewed on supported screen sizes.
- Core schedule information remains readable.
- Critical Supervisor actions remain accessible.

---

### E14 — Reporting & Dashboard

#### US-053 — Supervisor Schedule Summary

**User Story**
As a Supervisor, I want a summary of team staffing so that I can quickly identify coverage problems.

**Priority:** P2  
**Story Points:** 5  
**Release:** Phase 2

**Acceptance Criteria**
- Summary shows staffing by shift.
- Missing/insufficient staffing is highlighted.
- Pending requests can be summarized.
- Data reflects the current schedule.

---

#### US-054 — Schedule Change Summary

**User Story**
As a Supervisor, I want to see schedule changes and requests by period so that I can monitor schedule stability.

**Priority:** P2  
**Story Points:** 5  
**Release:** Phase 2

**Acceptance Criteria**
- Changes can be filtered by date range.
- Changes can be filtered by team.
- Changes can be filtered by request type.
- Results are based on the central schedule/history.

---

## 6. Business Rules

| ID | Business Rule |
| --- | --- |
| BR-001 | The operation must support continuous 24-hour / 7-day coverage. |
| BR-002 | Shift Teams are A, B, C, and D. |
| BR-003 | Each shift team consists of 1 Shift Supervisor and 6 Shift Operators based on the current documented structure. |
| BR-004 | An employee must not work more than 6 consecutive days under the current company rule. |
| BR-005 | An employee must have at least 1 rest day before returning to work after 6 consecutive working days. |
| BR-006 | Shift assignment must consider employee position and required skills. |
| BR-007 | Planned schedule/leave changes should be completed at least 1 day in advance. |
| BR-008 | Emergency sick leave may require a retrospective schedule update to reflect actual work. |
| BR-009 | Replacement/OT employees must be eligible for the target shift and must not exceed the consecutive-working-day limit. |
| BR-010 | An employee may request a shift swap no more than 2 times per month according to the current documented rule. |
| BR-011 | Cross-team/cross-shift swaps require approval from both responsible Supervisors. |
| BR-012 | A schedule change becomes effective only after all required approvals are completed. |
| BR-013 | Approved schedule changes must update the central schedule. |
| BR-014 | Authorized users must access the same current schedule as the single source of truth. |
| BR-015 | Van Drivers have read-only access to operational transportation information. |
| BR-016 | Schedule codes must be standardized and consistently interpreted by the system. |
| BR-017 | Normal shift and OT information must be distinguishable for HR processing. |
| BR-018 | Holiday handling must distinguish between holidays falling on working days and holidays falling on scheduled off days. |
| BR-019 | The system may support temporary conversion from shift work to normal working hours (D) for approved special cases. |
| BR-020 | All schedule changes that affect operational records should be traceable through history/audit records. |

---

## 7. MVP Scope

The MVP should deliver the complete operational flow:

```text
Login
  ↓
Role & Permission
  ↓
View Monthly Schedule
  ↓
Supervisor Creates / Edits Schedule
  ↓
Schedule Validation
  ↓
Operator Views My Shift
  ↓
Operator Submits Change / Swap / Day-Off Request
  ↓
Supervisor Reviews
  ↓
Approval / Rejection
  ↓
Schedule Updated
  ↓
Real-Time Update + Notification
  ↓
HR Exports Schedule / OT Data
```

### MVP Stories
- US-001 to US-019
- US-020 to US-043
- US-046
- US-050
- US-051

---

## 8. Phase 1 Scope

Features that improve operational completeness but are not essential to the first end-to-end release:

- US-044 — Today's Schedule
- US-045 — Employee Pickup List
- US-047 — Schedule Change Audit
- US-048 — Request Approval History
- US-052 — Responsive Supervisor Schedule

---

## 9. Phase 2 Scope

Features that can be delivered after the core scheduling workflow is stable:

- US-049 — Schedule Revision History
- US-053 — Supervisor Schedule Summary
- US-054 — Schedule Change Summary

---

## 10. Suggested Sprint Plan

Assuming a 2-week sprint cadence within the 12-week delivery timeline:

| Sprint | Weeks | Main Goal |
| --- | --- | --- |
| Sprint 0 | Week 1–2 | Requirements, UX/UI, architecture, data model |
| Sprint 1 | Week 3–4 | Authentication, roles, employee/team, basic schedule |
| Sprint 2 | Week 5–6 | Monthly Grid, schedule CRUD, shift codes, validation |
| Sprint 3 | Week 7–8 | Shift Change, Shift Swap, Day-Off workflows |
| Sprint 4 | Week 8–9 | Approval workflow, real-time update, notifications |
| Sprint 5 | Week 9–10 | HR Export, Driver view, mobile optimization |
| Sprint 6 | Week 10–11 | Integration testing, bug fixing, UAT preparation |
| Release | Week 12 | UAT completion, production deployment, Go-Live |

---

## 11. Definition of Ready

A Product Backlog Item is ready for development when:

- [ ] User Story is clearly defined.
- [ ] Business value is understood.
- [ ] Acceptance Criteria are defined.
- [ ] Required business rules are identified.
- [ ] UX/UI requirements are available where applicable.
- [ ] Dependencies are identified.
- [ ] Data requirements are understood.
- [ ] Product Owner/Business representative has clarified open questions.
- [ ] Story Point has been estimated by the development team.

---

## 12. Definition of Done

A Product Backlog Item is considered Done when:

- [ ] Development is completed.
- [ ] Code review is completed.
- [ ] Unit/integration tests are completed where applicable.
- [ ] Acceptance Criteria are satisfied.
- [ ] QA testing is completed.
- [ ] No critical/high-priority defect remains open.
- [ ] Role/permission behavior has been tested.
- [ ] Relevant audit/history behavior has been verified.
- [ ] UX/UI has been reviewed.
- [ ] Product Owner/Business representative accepts the item.
- [ ] Documentation is updated where required.

---

## 13. Open Questions for Detailed Requirements

The following items should be confirmed before development of the related backlog items:

1. What is the exact authentication mechanism?
2. Who is responsible for creating and maintaining users?
3. What exact positions and skills are required for each shift?
4. What is the exact minimum staffing requirement for each shift/team?
5. What is the exact rule for the 7-day schedule-change window?
6. Does the 2-shift-swap-per-month limit count submitted requests, approved swaps, or completed swaps?
7. What notification channels are required: in-app, email, push notification, LINE, or others?
8. What exact HR export format is required: Excel, CSV, API, or multiple formats?
9. What exact columns are required for payroll and OT?
10. What is the exact OT calculation rule for M/MT/N/NT?
11. How should public holidays be represented in the schedule?
12. What information may Van Drivers see about employees?
13. What is the exact approval hierarchy between Supervisor, Manager, HR, and other roles?
14. What happens when an emergency absence occurs and no qualified replacement is available?
15. Which schedule changes require audit/history and how long must the history be retained?

---

## 14. Backlog Prioritization Legend

| Priority | Meaning |
| --- | --- |
| P0 | Critical for core operation / MVP |
| P1 | Important for operational completeness |
| P2 | Enhancement / can be delivered after MVP |

---

## 15. Product Success Criteria

The Shift Schedule System should achieve the following outcomes:

- Replace operational dependency on multiple Excel schedule versions.
- Provide a single source of truth for approved schedules.
- Reduce manual phone-based coordination.
- Reduce scheduling errors caused by invalid assignments.
- Ensure employees do not exceed the configured maximum consecutive working days.
- Ensure required skills and positions are considered during schedule changes.
- Provide controlled approval for shift changes and swaps.
- Provide timely visibility of approved schedule changes.
- Provide HR with reliable schedule and OT data for downstream processing.
- Provide mobile access for Operators and relevant field users.