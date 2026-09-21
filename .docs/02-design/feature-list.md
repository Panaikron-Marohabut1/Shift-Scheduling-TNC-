# Feature List

| Feature | Description | Role |
|---|---|---|
| Monthly Shift Schedule | View employees' monthly shift schedules | Shift Employee, Shift Supervisor, HR & Management, External User (Guest) |
| Shift Schedule Management | Create, edit, and adjust employee shift schedules, including shift changes, employee replacements, and urgent shift arrangements | Shift Supervisor |
| Shift Swap Request | Submit a request to swap shifts with another employee | Shift Employee, Shift Supervisor |
| Shift Swap Approval | Review and approve or reject shift swap requests | Shift Supervisor |
| Leave Request | Submit leave requests through the system | Shift Employee, Shift Supervisor |
| OT Request | Submit overtime (OT) requests through the system | Shift Employee, Shift Supervisor |
| Retroactive Submission | Submit leave or OT documentation retrospectively when required | Shift Employee, Shift Supervisor |
| Public Holiday Entitlement | Select whether to take a public holiday off or work on the holiday as OT | Shift Employee, Shift Supervisor |
| Employee Management | Add, remove, or transfer employees between teams | Shift Supervisor |
| OT Request Review | Review and approve or reject OT requests. Rejection requires a reason | Shift Supervisor |
| Leave Request Review | Review and approve or reject leave requests | Shift Supervisor |
| Schedule Publishing | Publish the monthly shift schedule | Shift Supervisor |
| Multi-level Approval | Route requests through the appropriate approval levels based on the applicable approval workflow | Shift Supervisor |
| Notification | Notify relevant users of important request statuses and schedule-related updates | System |
| Labor Law Compliance Validation | Automatically validate shift schedules against applicable labor regulations | System |
| Entitlement and Quota Validation | Automatically validate requests against applicable employee entitlements and predefined system limits | System |
| Audit Log | Automatically record system changes, including the user, timestamp, and before-and-after values. Authorized users can review the change history | System, Shift Supervisor |
| Dashboard | View a summary of key scheduling and request information | Shift Supervisor, Shift Employee |
| Export Schedule Data (CSV/Excel) | Export shift schedules, OT records, shift allowances, and other relevant data | Shift Supervisor, HR & Management |

## Automated Features

The following features operate automatically and are therefore not included as user actions in the User Journey:

- Labor Law Compliance Validation
- Entitlement and Quota Validation
- Audit Log

These features are triggered automatically by system activities or user actions and do not require users to manually perform the validation or logging process.

However, **View Audit Log** is included in the Shift Supervisor User Journey because the Shift Supervisor can access and review historical changes.

> **Note:** Specific business rules and validation criteria will be defined after the relevant requirements have been confirmed.