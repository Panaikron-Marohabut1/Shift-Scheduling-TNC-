# Shift Schedule Management System — Legal & Compliance Rules for AI Agents

Read this before writing any code that touches user data or user actions.

## PDPA (Personal Data Protection Act)

What it is: Thailand's personal-data protection framework governing the
collection, use, disclosure, storage, security, and rights of data subjects.

What it requires: consent where required · purpose limitation · data
minimisation · access/correct/delete · sensitive data

Rules for the agent:
- If the system stores employee names, employee IDs, roles, team membership,
  or shift schedules, it must restrict access according to the user's
  authorized role and access permissions.
- If the system stores shift-swap or day-off change requests, it must collect
  only information required for the request and scheduling process.
- If the system uses employee data for scheduling, approval, notifications,
  HR export, or schedule history, it must use the data only for the relevant
  system purpose.
- If the system sends schedule-related notifications, it must disclose only
  the information necessary for the recipient to understand the notification.
- If the system provides schedule access to a Shift Operator, it must provide
  only information permitted by the user's access permissions.
- If the system provides schedule access to a Shift Supervisor, it must
  restrict access according to the Supervisor's assigned responsibilities
  and approval scope.
- If the system provides schedule access to HR, it must expose only schedule
  information required for HR-related processing.
- If the system provides access to a Contractor or Van Driver, it must expose
  only the information required for transportation responsibilities.
- If the system provides employee pickup/drop-off information to a Contractor
  or Van Driver, it must restrict the information to the relevant
  transportation operation.
- If the system provides access to external users, it must not provide them
  with schedule editing or approval permissions.
- If the system exports schedule data for HR, it must restrict the export to
  authorized HR users and minimize the exported information to what is
  required for the approved HR purpose.
- If the system exports schedule data, it must maintain a record of the
  authorized export activity, including who performed the export and when.
- If the system stores schedule-related requests, it must associate the
  request with the relevant employee.
- If a user requests access, correction, or deletion of applicable personal
  data, the system must process the request through an authorized process
  while preserving records required for schedule, approval, or audit purposes.
- If the system stores personal data, it must not provide access beyond the
  user's authorized role and permissions.

## Computer Crime Act §26

What it is: A Thai computer-crime requirement concerning the retention of
computer traffic/access information and the ability to associate relevant
activity with a real user.

What it requires: keep an access/traffic log ≥90 days, tied to a real user

Rules for the agent:
- If the system has user authentication, it must record relevant successful
  and failed authentication activity with the associated user account and
  timestamp.
- If the system has role-based access control, it must record relevant
  unauthorized access attempts and access-denial events with the associated
  user.
- If the system has schedule records, it must maintain records of important
  schedule activities, including creation, modification, removal, approval,
  and rejection.
- If a schedule is changed, it must record who made the change, what was
  changed, when the change was made, the affected employee, and the affected
  date or shift.
- If the system has shift-swap or day-off change requests, it must record
  request submission, review, approval, rejection, and final application of
  the request.
- If a request requires more than one Supervisor approval, it must record the
  decision of each required Supervisor.
- If the system has HR data export, it must record the user performing the
  export, the exported scope, and when the export occurred.
- If the system provides access to schedule information through an API, it
  must maintain records sufficient to associate relevant access with the
  requesting user where required.
- If the system performs an action on behalf of a user, the action must be
  attributable to the relevant authenticated user and must not rely on an
  anonymous user identity.
- If the system is subject to the §26 retention requirement, it must retain
  the required access/traffic records for at least 90 days.
- If the system retains access/traffic or audit records, it must restrict
  access to authorized users.
- If a schedule or request is changed, approved, rejected, or removed, the
  system must not silently overwrite or remove the historical record required
  to understand the change.

## Electronic Transactions Act §9 / 26 / 28

What it is: The Thai legal framework concerning electronic transactions and
electronic signatures.

What it requires: valid e-signature test (§9) · presumed-reliable signature
(§26) · CA duties (§28)

Rules for the agent:
- If the user submits a shift-swap request, the system must record the
  authenticated user associated with the request.
- If the user submits a day-off change request, the system must record the
  authenticated user associated with the request.
- If a Supervisor approves a shift-swap or day-off change request, the system
  must record the Supervisor who performed the approval and the time of the
  action.
- If a Supervisor rejects a request, the system must record the Supervisor
  who performed the rejection and the time of the action.
- If an approval results in a schedule change, the system must maintain a
  record connecting the approval to the resulting schedule change.
- If a cross-shift swap requires approval from both responsible Supervisors,
  the system must record each Supervisor's approval separately.
- If a cross-shift swap requires approval from both responsible Supervisors,
  the system must not update the final schedule until all required approvals
  have been completed.
- If either required Supervisor rejects a cross-shift request, the system must
  not update the final schedule.
- If a schedule change is made, the system must maintain a record of who made
  the change, what was changed, when it was changed, and the approval status.
- If an electronic approval is used for a schedule-related request, the
  approval must be attributable to the authenticated user who performed the
  approval.
- If the system uses an electronic signature or certificate authority, the
  implementation must follow the applicable requirements for that mechanism
  and must not treat an ordinary button click as automatically satisfying
  every electronic-signature requirement.
  