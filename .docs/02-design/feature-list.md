# Feature List

Features available in the Shift Schedule system (ShiftFlow) as of 17 November 2026. Business rules are defined in the [business rules master](../01-requirements/01-spec/2026-11-04-01-business-rules-master.md).

## Requests

| Feature | Description | Role |
|---|---|---|
| Shift Swap Request | Swap shifts with an employee from another team of the same type: one day (swap both cells on the same date) or two days (two dates in the same month with the same partner) | Shift Employee, Shift Supervisor |
| Leave Request | Request leave (V vacation, S sick, B business, VG other), with or without a cover person from another team who is on a day off | Shift Employee, Shift Supervisor |
| OT Request | Request a full overtime shift, morning (MT) or night (NT), on one's own day off | Shift Employee, Shift Supervisor |
| Public Holiday Request | Use a public-holiday entitlement: take the holiday off, or work it and choose a replacement day off | Shift Employee, Shift Supervisor |
| Withdraw Request | Withdraw a pending request before any approver has acted | Shift Employee, Shift Supervisor |
| Cancel Approved Request | Cancel an approved request before the affected shift starts; the system restores the original shifts and returns the swap quota | Shift Employee, Shift Supervisor |
| Track Requests | See every own request with its status and approval steps | Shift Employee, Shift Supervisor |

## Approval

| Feature | Description | Role |
|---|---|---|
| Request Review Queue | See requests waiting for one's decision, separated from all other requests | Shift Supervisor, Manager |
| Approve / Reject Request | Approve or reject a request; rejection requires a reason | Shift Supervisor, Manager |
| Multi-level Approval | An employee's swap or leave with cover needs both teams' supervisors, in any order. Leave without cover and OT need the own team's supervisor. A supervisor's request goes to the Manager alone | System |
| Request Monitoring | Follow the status of every request in the department | Manager |

## Schedules and dashboards

| Feature | Description | Role |
|---|---|---|
| Monthly Shift Schedule | View the monthly roster of teams A–D | Shift Employee, Shift Supervisor, Manager, HR |
| Dashboard: My Shift | Today's shift and hours, consecutive working days against the limit, and remaining swap quota | Shift Employee, Shift Supervisor |
| Dashboard: Staffing Overview | Daily view of who is on morning, night, off, leave or OT | Shift Supervisor |
| Annual Schedule | View the whole year's roster | Manager |
| My History | Personal history of requests and schedule changes | Shift Employee |
| Change History | Department history of schedule changes and decisions | Shift Supervisor |
| Transport Schedule | View the employee transport schedule and acknowledge it | External User (Van Driver) |

## People, access and settings

| Feature | Description | Role |
|---|---|---|
| People and Teams | Change an employee's position, switch the role between Employee and Supervisor, and transfer an employee to another team from an effective date | Manager |
| Swap Quota Setting | Set the monthly swap limit per employee, applied from the next month | Manager |
| Initial Role Assignment | Give a signed-in user without a role their first role (Employee, Supervisor or Manager) | Admin |
| Account List | View accounts and the history of role assignments | Admin |
| Sign-in | Sign in with email and password, or Microsoft 365 when enabled | All |

## HR data

| Feature | Description | Role |
|---|---|---|
| Export Schedule Data (CSV for Excel) | Download the closed-month roster as a CSV file that opens directly in Excel with Thai text supported. In the local demo, HR can also export monthly shifts, leave records, OT records and the full-year schedule | HR |
| OT and History Review | Review OT records and change history within HR's scope | HR |

## Automated features

These run automatically when users act, so they are not listed as user steps in the [User Journey](user-journey.md).

| Feature | Description |
|---|---|
| Rule Validation | Checks every request on submission and again on final approval: date window (today to month end), at most 6 consecutive working days, at least 12 hours of rest between shifts, and one active request per person per day |
| Swap Quota Check | Counts approved swaps per month and blocks approval when the limit is reached |
| Approval Deadline | A request must be decided within 24 hours of submission and before the next month starts, otherwise it closes |
| Month Close | At 00:00 on the 1st (Bangkok time), the previous month's roster is locked |
| Notifications | In-app notifications to everyone affected by a request or schedule change |
| Audit Log | Records who changed what and when, with previous and new values; records cannot be edited or deleted |
