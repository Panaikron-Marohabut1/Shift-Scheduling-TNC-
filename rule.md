# Shift Schedule System — Operating Rules

## 1. Purpose

This document defines the operational rules, governance principles, and business constraints for the Shift Schedule System. It is aligned to the product backlog and describes how schedules are created, validated, approved, changed, and exported.

The system must ensure fair staffing, correct role-based access, consistent schedule data, and auditability across all operational activities.

---

## 2. Scope

These rules apply to:
- Shift Operators
- Shift Supervisors
- HR staff
- Van Drivers / Contractors
- System administrators
- Schedule validation logic and approval workflows
- Data export and audit history

---

## 3. Roles and Responsibilities

### 3.1 Shift Operator
- Can view their own schedule and authorized team schedule.
- Can submit shift change, shift swap, and day-off/leave requests.
- Can view the status of submitted requests.
- Cannot create, edit, delete, or approve schedule records.

### 3.2 Shift Supervisor
- Can create, update, and cancel schedule assignments.
- Can review and approve or reject requests.
- Can ensure team coverage and correct staffing levels.
- Can manage employee assignment to shift teams.
- Must follow validation and approval rules before finalizing changes.

### 3.3 HR
- Can view schedule and staffing data for required teams/employees.
- Can export schedule data for payroll and OT processing.
- Must be able to distinguish shift work, leave, off days, and OT information.
- Must not change operational schedule data directly unless a formal process allows it.

### 3.4 Contractor / Van Driver
- Has read-only access to operational transportation related schedule information.
- Can view only the information necessary for pickup and drop-off responsibilities.
- Cannot edit, approve, delete, or create schedules.

### 3.5 System Administrator
- Maintains role assignments and access permissions.
- Configures shift codes, business rules, staffing requirements, and approval logic.
- Provides platform-level support and security oversight.

---

## 4. Standard Shift Codes

The system must use the following standard shift codes:

| Code | Meaning | Status |
| --- | --- | --- |
| M | Morning/Day shift | Working |
| MT | Morning/Day shift with OT | Working + OT |
| N | Night shift | Working |
| NT | Night shift with OT | Working + OT |
| D | Normal working hours | Working |
| O / Blank | Off day | Non-working |
| V | Vacation leave | Leave |
| B | Business leave | Leave |
| S | Sick leave | Leave |
| H | Holiday / traditional holiday | Holiday |

### Rules
- Codes must be standardized and consistently interpreted across the system.
- Every shift code must have a defined working time or leave status.
- Schedule display must remain consistent in all views and exports.
- OT-related codes must remain distinguishable from regular attendance.

---

## 5. Team Structure Rules

- Shift teams are A, B, C, and D.
- Each team includes a designated Shift Supervisor and assigned operators.
- Employees must be assigned to one valid shift team.
- Team membership determines schedule visibility and approval routing.
- Supervisors are responsible for the team(s) assigned to them.

---

## 6. Access Control Rules

### 6.1 Role-Based Access
- Each user must be assigned one or more valid roles.
- User access must be restricted to only the functions relevant to their responsibility.
- UI restrictions alone are insufficient; backend authorization enforcement is required.

### 6.2 Data Visibility
- Operators can view their own schedule and authorized team schedule only.
- Supervisors can view assigned teams and related approval tasks.
- HR can access schedule data required for payroll and OT processing.
- Van Drivers can access only read-only transportation-related schedule information.
- Unauthorized access through direct URLs or API calls must be blocked.

---

## 7. Schedule Management Rules

### 7.1 Monthly Schedule
- Schedule must be viewable in a monthly calendar/grid format.
- Each date must show assigned shift status for employees.
- Supervisor can select team, month, and employee when creating or editing schedules.

### 7.2 Valid Schedule Assignment
- Schedule changes must be validated before saving.
- Invalid assignments must not be accepted.
- All valid changes must be recorded in the system history.

### 7.3 Schedule Modification
- Supervisors may create, modify, or cancel schedule assignments.
- Any schedule change must be traceable to a user and timestamp.
- A canceled or revised assignment must not be silently removed without audit history.

---

## 8. Business Validation Rules

### 8.1 Maximum Consecutive Working Days
- Employees must not work more than 6 consecutive days.
- After 6 consecutive working days, the employee must have at least 1 rest day before resuming work.
- Violations must block saving or approval of the schedule unless a formal exception process is defined.

### 8.2 Position and Skill Matching
- Schedule assignment must consider employee position and required qualifications.
- Employees must meet required skills for the assigned shift or role.
- Unqualified assignments must be rejected with an explicit validation reason.

### 8.3 Team Coverage Validation
- The system must validate required staffing levels for each shift/team.
- Missing staffing or insufficient coverage must trigger a warning or block assignment depending on configuration.
- Coverage requirements must be maintained separately from employee data.

### 8.4 Change Time Restriction
- Schedule changes must follow the configured change window.
- Changes outside the allowed period require the defined exception process.
- The exact change window must be confirmed as part of detailed requirements.

### 8.5 Minimum Advance Processing Time
- Planned leave and schedule changes must be submitted and approved at least 1 day before the affected shift.
- Normal planned changes submitted after the cutoff must be blocked.
- Emergency sick leave may use an exception path.

### 8.6 Swap Rules
- An employee may request a shift swap no more than 2 times per month.
- Requests exceeding the limit must be blocked with a clear validation message.
- Cross-team/cross-shift swaps require approval from both responsible supervisors.
- Skill and position validation must be applied before final approval.

### 8.7 Replacement / OT Eligibility
- Replacement staff must be eligible for the target shift and role.
- Replacement employees must pass stress and consecutive-working-day validation.
- OT assignments must not violate staffing and compliance rules.

---

## 9. Request Workflow Rules

### 9.1 Request Categories
The system supports the following request types:
- Shift change request
- Shift swap request
- Day-off / leave request
- Emergency sick leave request

### 9.2 Request Submission
- Requests must include the affected date, target schedule/shift, and reason where required.
- Request creation must validate business rules before the request is accepted.
- Status must be set to Pending until approved or rejected.

### 9.3 Request Status
Supported status values include:
- Pending
- Approved
- Rejected

### 9.4 Approval Requirements
- All required approvals must be completed before a change becomes effective.
- Rejection by any required approver rejects the request.
- Approval history must be retained.

### 9.5 Notifications
- Relevant employees and supervisors must receive notifications for new requests, approvals, rejections, and schedule changes.
- Notification content must avoid exposing unauthorized information.

---

## 10. Approval and Decision Rules

- A request is approved only when all required approvals are complete.
- A request is rejected if any required approver rejects it.
- Rejection reasons must be recorded and visible to the requesting employee.
- Approval decisions must be auditable.
- Approved schedule changes must update the central schedule and become visible to authorized users.

---

## 11. Single Source of Truth Rules

- The approved schedule stored in the system is the authoritative source of truth.
- All authorized users must access the same current schedule data.
- Excel copies or manual schedule distributions must not be treated as operational sources of truth.
- Updated schedule data must be reflected in real time for authorized users.

---

## 12. HR and Data Export Rules

- HR can filter schedule data by team, date range, and employee.
- HR export must include employee ID, date, shift code, leave information, and relevant OT details.
- Normal work hours and OT information must remain distinguishable.
- Export format must align with payroll and HR process requirements.
- Date and time formats must be standardized.

---

## 13. Holiday and Leave Rules

- Holidays must be represented consistently in the schedule.
- Holiday handling must distinguish between holidays on working days and holidays on scheduled off days.
- Leave types include Vacation (V), Business Leave (B), Sick Leave (S), and Holiday (H).
- Leave entries must be stored with related schedule or request records.

---

## 14. Driver / Contractor Rules

- Drivers may only access information required for daily transportation operations.
- Drivers must not be able to create, approve, edit, or delete schedules.
- Driver data access must be read-only at both UI and backend levels.
- Driver views must reflect the latest approved operational schedule.

---

## 15. Audit and History Rules

- Every schedule change must record:
  - user identity
  - timestamp
  - previous value
  - new value
  - reason/source where applicable
- Request approval decisions must be recorded with approver identity and result.
- Historical revisions must be retained for governance and investigation purposes.
- Audit records must be available to authorized supervisors and HR users.

---

## 16. Mobile and User Experience Rules

- Operators must be able to view their shift schedule on mobile devices.
- Mobile users must be able to submit supported request types and check request status.
- Supervisor schedule views must remain readable on supported device sizes.
- Responsive behavior must preserve essential operational actions.

---

## 17. Security and Compliance Rules

- Authentication must be required for all protected functions.
- Role-based permissions must be enforced on the server side.
- Unauthorized actions must be blocked even if attempted via direct API or URL manipulation.
- PII and employee information must be restricted to authorized roles.
- Audit logs must support operational and compliance review.

---

## 18. Exception Handling Rules

Exceptions must be explicitly managed and logged when formal business rules are waived, including:
- emergency sick leave
- schedule changes outside the configured time window
- replacement assignments where coverage is temporarily constrained
- special approved transitions from shift work to normal working hours (D)

Any exception must include:
- reason
- approver
- timestamp
- related employee and date
- review outcome

---

## 19. Definition of Required Business Readiness

A feature or change is considered ready for implementation only when:
- the user story is clear
- business value is defined
- acceptance criteria are documented
- relevant business rules are identified
- user access and data visibility are understood
- dependencies and open questions are resolved where required

---

## 20. Operational Policy Summary

The system exists to support safe, compliant, and efficient shift scheduling for continuous operations. The central principles are:

1. Safety and staffing compliance come before convenience.
2. Only authorized roles may view or modify schedule data.
3. Every operational change must be validated and traceable.
4. Approved changes must update the central schedule immediately.
5. HR and supervisors must have the information needed to plan staffing, payroll, and OT processing.
6. A single approved schedule must be the operational truth.

---

## 21. Open Questions to Confirm During Detailed Requirements

The following must be clarified before final detailed design and implementation:

- Exact authentication mechanism and user lifecycle management
- Exact positions and required skills by shift/team
- Minimum staffing levels by shift/team
- Detail of the schedule change time window rule
- Whether the 2-swaps-per-month rule counts submitted, approved, or completed swaps
- Required notification channels (in-app, email, LINE, push, etc.)
- Required HR export format and columns
- Exact OT calculation method for M/MT/N/NT
- Holiday treatment policy and official calendar mapping
- Approval hierarchy beyond supervisor-level responsibilities
- Retention period for audit and schedule history

These questions should be resolved before production design is finalized.
