# Shift Schedule Management System

## Project Proposal

### Team Members

| Student ID | Name |
| --- | --- |
| 6631503007 | Charuwan Kasaempan |
| 6631503008 | Juladit Teekawiwat |
| 6631503028 | Parichat Sriagsorn |
| 6631503049 | Alisa Pansomkid |
| 6631503126 | Panaikron Marohabut |

---

## Project Title 

Shift Schedule Management System 

---

## 1. Background

Currently, shift scheduling and shift-based work management in the Production Department rely primarily on Microsoft Excel and manual communication. Shift rosters are prepared on a monthly basis, and when changes are required, the Excel file must be manually updated and reviewed by the Supervisor before the revised version can be used.

This process can become inefficient when multiple file changes occur. Employees and other relevant parties may not receive the latest version at the same time, while external personnel such as contracted van drivers cannot directly access the internal Excel file.

In addition, communication regarding roster changes is often handled through phone calls or other manual channels. This increases coordination workload and creates a risk of misunderstandings or users referring to outdated information.

Therefore, this project proposes a Shift Scheduling Management System that centralizes shift planning, approval, and related requests in a single platform. The system will provide authorized users with access to the most current roster and support controlled adjustments through predefined business rules and approval workflows.


---

## 2. Problem Statement and Pain Points

### 2.1 Manual Schedule Management Using Excel

Shift schedules are currently maintained using Excel. When a shift needs to be changed, the schedule must be manually edited and reviewed before being distributed again.

This process may:
- Require repeated manual work
- Consume time for Supervisors
- Increase the risk of data-entry errors
- Create multiple versions of the same schedule
- Make it difficult to track schedule changes

### 2.2 Lack of Real-Time Schedule Information

When a schedule is updated, the revised file must be redistributed to relevant users. Different users may therefore have different versions of the schedule.

This can cause confusion, particularly when employees, Supervisors, and external personnel rely on the schedule at the same time.

The proposed system will provide a single source of truth, allowing authorized users to access the latest approved schedule from the same system.

### 2.3 Reliance on Manual Communication

Schedule changes and confirmations currently rely heavily on phone calls or other manual communication.

This can increase coordination time and make it difficult to maintain a clear record of schedule-related requests.

The proposed system will provide in-system requests, approval workflows, and notifications to reduce unnecessary manual coordination.


### 2.4 Limited Access for External Users

External personnel, such as contracted van drivers, may need access to specific schedule information but cannot directly access the organization's internal Excel file.

The proposed system will provide restricted access for external users, allowing them to view only the information required for their responsibilities.


### 2.5 Limited HR Data Integration

The current Excel-based scheduling process does not directly support integration with HR-related data.

This limits the ability to use shift information for future calculations such as:

- Overtime (OT)
- Shift allowances
- Payroll-related information

The proposed system will support structured data export for HR use. Full integration with the HR system may be considered as a future enhancement after the required HR data format and integration requirements have been confirmed.

---

## 3. Project Goals and Objectives

### 3.1 Goal

The primary goal of this project is to develop a centralized Shift Schedule Management System that replaces manual Excel-based schedule management with a controlled, accessible, and up-to-date digital system.

### 3.2 Objectives

The system aims to:
- Reduce the time and effort required to create and modify shift schedules.
- Provide a centralized source of the latest approved schedule.
- Reduce errors caused by manual schedule updates and duplicated files.
- Provide an approval workflow for schedule changes.
- Allow employees to submit shift-swap and day-off change requests through the system.
- Reduce reliance on phone calls and manual communication.
- Provide appropriate access to external users such as van drivers.
- Allow HR staff to export schedule data for payroll and OT-related processes.
- Support both web/PC and mobile access according to user roles.
- Ensure schedule changes follow predefined business and safety rules.

---

## 4. Project Scope

### 4.1 In Scope

The initial version of the system will include:
- User authentication and role-based access control
- Monthly shift schedule management
- Shift creation, editing, and removal
- Employee replacement and shift schedule adjustment
- Day-off change requests
- Supervisor approval and rejection
- Cross-shift approval workflow
- Business-rule validation
- Schedule notifications
- Monthly schedule overview
- Mobile access for Shift Employees
- Read-only mobile access for External Users (e.g., Contractors / Van Drivers)
- HR data export
- Schedule history / change records

### 4.2 Out of Scope

The following features are not included in the initial implementation:
- Automatic Salary and Payroll Calculation
The system will not calculate employee salaries, payroll, or other payment-related amounts.
- Automatic OT Payment Calculation
The system will manage scheduled shift and OT-related schedule information but will not calculate the actual OT payment amount.
- Actual Working Hour / Attendance Calculation
The system will not calculate employees' actual working hours based on clock-in/clock-out records. It will only manage scheduled shift times.
- Full HR System Integration
The system will provide scheduled data export for HR use but will not directly integrate with the organization's HR or payroll system.
- Full Leave Management                                                 The system will not provide a complete leave-management system, including full leave balance management, leave entitlement calculation, or comprehensive leave administration.
- Employee Personal Address Management
The system will not store or manage employees' personal house numbers, home addresses, or precise home locations.
- GPS and Real-Time Location Tracking
The system will not track the real-time location of employees or vehicles.

These features may be considered for future development after the core Shift Schedule Management System has been implemented and evaluated.
---

## 5. User Roles and Core Functions

### 5.1 Shift Operator

Shift Operators can:
- View their assigned shift schedule
- View the overall shift schedule according to their access permissions
- View their upcoming shifts and days off
- Submit shift-change requests
- Submit day-off change requests
- Track the status of their requests
- Receive notifications regarding schedule changes and approvals

### 5.2 Shift Supervisor

Shift Supervisors can:
- View the monthly shift schedule
- Add, edit, and remove shifts
- Review employee schedule requests
- Approve or reject shift-swap requests
- Approve or reject day-off change requests
- Review changes made within their assigned shift
- Participate in cross-shift approval
- View pending requests
- Monitor schedule conflicts and validation warnings
- Replace employees when required for shift coverage
- Adjust employee shift assignments when necessary

For cross-shift swaps, approval from the Supervisors responsible for both affected shifts will be required.

### 5.3 HR
HR users can:

- Access approved schedule data
- Search and filter schedule information
- Export schedule data
- Use exported data for payroll, OT, and shift-allowance processes

The initial system will focus on data export rather than direct payroll calculation.
### 5.4 External Users
External Users can :
- View the latest approved daily schedule
- View the list of employees assigned for transportation
- View relevant pickup/drop-off information
- Access the information through a mobile device
- View the latest update time

Contractors and External Users cannot edit or approve shift schedules.

### 5.5 IT
IT can :
- Backend settings

### 5.6 Production Engineer 

Contractors or van drivers can:
- Setting and adjusting work shift schedules (M, MT, N, NT, D).
- Defining standard staffing levels per position for each shift (7 positions per team).
- Managing team shift rosters (Teams A, B, C, D) in response to new hires or personnel transfers.
- Configuring the annual schedule of public holidays.
- The annual shift scheduler is responsible for proposing the annual staffing plan—as well as any mid-year personnel changes within shifts—for approval by the Production Manager or Production Engineer.

---

## 6. User Workflows

### 6.1 Schedule Management Workflow

Supervisor Login → View Schedule → Add/Edit/Remove Shift → Employee Replacement / Schedule Adjustment (if required) → System Validation → Submit Change → Approval/Confirmation → Update Schedule → Record Audit Log → Notify Relevant Users

The system will validate the change against predefined business rules before the schedule is updated.


### 6.2 Shift-Swap Request Workflow

The employee selects their own shift and chooses the swap type.
For a Cross-Shift Swap:

Employee A → Select Date and Employee B from Another Shift → System Validation → Submit Request → Supervisor A, B Review → Manager Review → All Approve → Update Schedule → Record Audit Log → Notify Relevant Employees

Both Supervisor A and Supervisor B must approve the request before the schedule is updated.


### 6.3 Day-Off Change Workflow

Employee → Select Scheduled Day Off → Submit Change Request → System Validation → Supervisor Review → Manager Review → Approve / Reject → Update Schedule → Record Audit Log → Notify Employee

The system will only allow requests within the configured request period and according to applicable scheduling rules.


---

## 7. Business Rules and Validation

### 7.1 Request Submission Period

The system will define a permitted period for submitting schedule-change requests.

For example, a request may only be submitted within a specified number of days before the affected shift.

The exact period should be confirmed during the requirements-gathering phase with Supervisors and relevant stakeholders.


### 7.2 Maximum Consecutive Working Days

An employee must not be scheduled to work more than 6 consecutive days.

The system should automatically validate the employee's schedule when a shift is created, edited, or swapped.

If the change violates this rule, the system should prevent submission or display a validation warning according to the final business requirement.

### 7.3 Shift Type Validation

The system will support predefined shift types :
- N	Night shift
- M	Morning shift
- O	Blank cell = Weekly day off (Off Days)
- VG	Other leave
- VGh	Other leave (half-day)
- M/O	Scheduled day off; worked morning shift
- N/O	Scheduled day off; worked night shift
- O/M	Scheduled morning shift; changed to day off
- O/N	Scheduled night shift; changed to day off
- M/N	Scheduled night shift; changed to morning shift
- N/M	Scheduled morning shift; changed to night shift
- NT	Night shift OT
- MT	Morning shift OT
- NTh	Night shift OT (half-day)
- MTh	Morning shift OT (half-day)
- OT	Overtime work
- V	Vacation leave
- B	Business leave
- S	Sick leave
- H	Public holiday / Traditional holiday
- D	Day shift (08:00-17:00) 

Additional shift types may be added if required by the organization.

### 7.4 Skill and Position Validation

Before approving a shift swap, the system should verify whether the employee is qualified for the target shift based on defined criteria such as:
- Position
- Job role
- Required skills
- Shift eligibility
- Other organizational requirements

### 7.5 Cross-Shift Approval

If a shift swap affects two different shifts, approval from both responsible Supervisors is required.

The system must not update the final schedule until all required approvals have been completed.

### 7.6 Duplicate and Schedule Conflict Validation

The system should prevent or warn users about conflicts such as:
- An employee being assigned to two shifts at the same time
- Duplicate shift assignments
- Invalid shift sequences
- Exceeding the maximum consecutive working days
- Assigning an employee to an unauthorized shift

---

## 8. Notifications and Schedule Updates

The system should notify relevant users when important schedule events occur, such as:
- A shift-swap request is submitted
- A request is approved
- A request is rejected
- A schedule is modified
- A shift assignment is changed

Notifications may initially be provided through in-system notifications. Additional channels such as email or messaging applications can be considered in future versions.

---

## 9. Screen Layouts and UI Components

### 9.1 Shift Supervisor – Web Application

The Supervisor dashboard will focus on schedule overview and management.

Main components:
- Monthly schedule grid
- Employee list
- Shift information
- Day-off information
- Pending request section
- Add/Edit/Remove Shift buttons
- Approve/Reject buttons
- Search and filter functions
- Validation warnings
- Schedule change history

### 9.2 Shift Operator – Mobile Application

The Shift Operator mobile interface will focus on personal schedule management.

Main components:
- My Shift
- Today's shift
- Shift start/end time
- Upcoming schedule
- Days off
- Request Shift Change
- Request Day-Off Change
- Request status
- Notifications

### 9.3 Contractor / Van Driver – Web Application

External User interface will provide only the information necessary for transportation operations.

Main components:
- Today's Schedule
- Current date
- Shift information
- Employee pickup/drop-off list
- Latest update time
- Data freshness indicator

The interface will be read-only.

### 9.4 HR – Web Application

The HR & Management interface will focus on accessing and exporting approved schedule data.

Main components:
- Export function
- Downloadable schedule data
---

## 10. Non-Functional Requirements

In addition to the functional requirements, the system should consider the following non-functional requirements.

### 10.1 Security
- Role-based access control
- Users can only access information appropriate to their roles
- External users cannot modify schedules
- Authentication is required before accessing protected information

### 10.2 Availability
The system should be accessible during normal working operations and should minimize downtime that could affect shift management.

### 10.3 Usability
The system should provide an easy-to-understand interface because users may access the system quickly during daily operations.

### 10.4 Performance
Common actions such as viewing schedules, submitting requests, and checking approvals should respond within an acceptable period under normal system load.

### 10.5 Auditability
The system should maintain records of important schedule changes, including:
- Who made the change
- What was changed
- When the change was made
- Approval status

This will help Supervisors and administrators track schedule history.

---

## 11. Expected Benefits

The proposed system is expected to provide the following benefits:
- Reduce time spent managing shift schedules
- Reduce duplicated Excel files and manual updates
- Provide a single source of truth for schedule information
- Reduce schedule-related communication and coordination
- Improve visibility of schedule changes
- Allow employees to manage requests through the system
- Simplify Supervisor approval and schedule management
- Provide controlled access for external users
- Make schedule data easier for HR to export and process
- Provide a foundation for future workforce-management capabilities

---

## 12. Future Enhancements

After the initial system has been implemented, the following features may be considered:
- Direct integration with the HR system
- Automatic OT calculation
- Automatic shift-allowance calculation
- Payroll integration
- Leave-management integration
- Integration with transportation management
- Schedule analytics and reporting
- Adding employee house numbers or addresses for easier pick-up and drop-off

---

## 13. Project Implementation Timeline

The project will be developed over approximately 12 weeks.

| Phase | Activities | Timeline |
| --- | --- | --- |
| Phase 1 | Requirements Analysis | 1-8 September 2026 |
| Phase 2 | UX/UI Design | 9 - 15 September 2026|
| Phase 3 | System Design | 16 - 22 September 2026 |
| Phase 4 | Core Development | 23 September - 3 November 2026 |
| Phase 5 | Workflow Development | 4 - 17 November 2026 |
| Phase 6 | HR Data Export | 18 November - 1 December 2026 |
| Phase 7 | System Testing | 2 - 8 December 2026 |
| Phase 8 | User Acceptance Testing (UAT) | 9 -15 December 2026 |
| Phase 9 | Deployment / Go-Live | 16 - 23 December 2026 |
| Phase 10 | Post-Implementation Improvement | After Go-Live |

---

## 14. Stakeholder Analysis

To ensure that the system addresses actual business needs, requirements should be validated with the following stakeholders during Phase 1:

| Stakeholder | Main Concerns |
| --- | --- |
| Production Engineer / Schedule Planner | Schedule planning, operational constraints, workload |
| Shift Supervisor | Approval, employee assignment, schedule conflicts |
| Shift Operator | Personal schedule, shift swaps, day-off requests |
| HR Staff | Schedule data, OT, shift allowances, payroll requirements |
| IT Staff | Security, system integration, deployment, maintenance |
| Contractor / Van Driver | Daily employee pickup/drop-off information and data freshness |

Stakeholder interviews will be used to confirm the current workflow, identify actual pain points, and validate the business rules before development begins.

---

## 15. Success Criteria

The project will be considered successful if the implemented system can:
- Allow authorized Supervisors to manage monthly shift schedules.
- Allow employees to submit and track schedule-related requests.
- Enforce predefined scheduling and validation rules.
- Support the required approval workflow.
- Provide users with access to the latest approved schedule.
- Allow authorized external users to view relevant transportation information.
- Allow HR to export approved schedule data.
- Maintain a record of important schedule changes.
- Successfully pass system testing and User Acceptance Testing.