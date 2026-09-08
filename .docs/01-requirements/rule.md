# Shift Scheduling (TNC) — Legal & Compliance Rules for AI Agents

Read this before writing any code that touches user data or user actions.

This document is an implementation baseline for the Shift Scheduling System. It is not legal advice. Confirm the organization, lawful bases, retention periods, notification channels, and approval authority before production deployment.

## PDPA (Personal Data Protection Act)

What it is: Thailand's personal-data protection framework governing the collection, use, disclosure, storage, security, and rights of data subjects.

What it requires: consent where required · purpose limitation · data minimisation · transparency · appropriate security · access/correct/delete requests · controlled handling of sensitive data

Rules for the agent:
- If the system stores employee names, IDs, contact details, team membership, roles, or schedules, it must document the purpose, restrict access by role and team, and collect only the fields required for scheduling.
- If the system stores leave or sick-leave information, it must treat health-related details as sensitive, minimise the displayed detail, restrict access to authorised users, and never expose medical details to contractors or unrelated employees.
- If the system stores shift-swap, day-off, emergency sick-leave, or schedule-change requests, it must record the stated purpose and reason only when required, and must not request unnecessary personal information.
- If the system uses employee data for scheduling, approvals, notifications, HR export, or audit, it must use that data only for the documented purpose and must not reuse it for unrelated purposes without a valid legal basis.
- If the system sends notifications, it must disclose only the minimum information needed by the recipient and must not reveal another employee's leave, health, contact, or schedule details.
- If the system provides schedule access to a Shift Operator, it must show only the operator's own data and authorised team data.
- If the system provides access to a Supervisor, it must limit visibility to assigned teams and approval tasks.
- If the system provides access to HR, it must expose only the schedule and staffing fields required for approved payroll, OT, or HR processing.
- If the system provides access to a Contractor or Van Driver, it must expose only read-only transportation information required for the assigned operation.
- If the system exports data for HR, it must apply access control, use an approved format and destination, minimise exported fields, and record who exported what and when.
- If a data subject requests access, correction, deletion, or another applicable right, the system must route the request through an authorised process and preserve records needed for legal, payroll, safety, or audit obligations.
- If data is corrected or deleted, the system must preserve the minimum audit record required to explain an approved schedule decision without retaining unnecessary personal data.
- If the system has a security incident involving personal data, it must restrict further access, preserve evidence, notify the responsible administrator, and follow the organisation's incident-response and legal-notification process.
- If an AI agent generates, edits, exports, or summarises schedule information, it must follow the same authorisation and minimisation rules as the underlying application and must not infer or disclose sensitive employee information.

## Computer Crime Act §26

What it is: A Thai computer-crime requirement relevant to maintaining evidence of access to and use of computer systems and data.

What it requires: keep an access/traffic log ≥90 days, tied to a real user. Logs must be protected from unauthorised alteration and be retrievable for authorised investigation.

Rules for the agent:
- If the system has authentication, it must log successful and failed login attempts, logout events, account identifier, timestamp, and relevant source information.
- If the system has role-based access, it must log access denials and privilege changes, including the real user and the administrator or process that made the change.
- If the system has schedule records, it must log creation, update, cancellation, approval, rejection, and publication of schedule assignments.
- If a schedule changes, the audit record must include the real user, timestamp, previous value, new value, reason or source, affected employee, and affected date or shift.
- If the system has requests, it must log submission, review, approval, rejection, withdrawal, and final application of each request, including each required approver.
- If the system has HR exports, it must log the real user, filters or scope, fields exported, timestamp, destination or download event, and result.
- If the system sends notifications or exposes data through an API, it must log the requesting user or service identity, permitted scope, timestamp, and outcome where needed for investigation.
- If an AI agent performs an action on behalf of a user, it must use an attributable authenticated identity and must not use a shared or anonymous account.
- If an administrator or service account is used, the system must retain accountability for the responsible person or approved system process and must restrict shared credentials.
- If logs are retained for less than 90 days, the system must block production use until the retention policy is corrected or formally approved as legally compliant.
- If logs are accessed or changed, the system must restrict that access to authorised administrators or investigators and must record the access or change.
- If a record is cancelled or revised, the system must not silently overwrite or delete the historical audit evidence.

## Electronic Transactions Act §9 / 26 / 28

What it is: The Thai legal framework supporting electronic records and electronic transactions, including the evidentiary treatment and reliability of electronic signatures and certification-authority duties.

What it requires: valid e-signature test (§9) · presumed-reliable signature (§26) · CA duties (§28). An electronic approval must be attributable to the person approving, linked to the approved record, and preserved in a form that can be retrieved and inspected.

Rules for the agent:
- If a Supervisor approves or rejects a shift change, shift swap, leave request, or exception electronically, the system must record the approver's authenticated identity, decision, timestamp, request version, and decision reason where required.
- If the user clicks "I agree" on a consent notice, data-use notice, policy, or legally relevant acknowledgement, the system must record the user's identity, exact notice version, text or content reference, timestamp, action, and relevant context.
- If an approval changes the central schedule, the system must bind the approval to the exact schedule or request version and prevent an unapproved version from becoming effective.
- If a cross-team or cross-shift swap requires two Supervisors, the system must record each approval separately and must not apply the change until all required approvals are complete.
- If a request is rejected, the system must record the rejecting user, timestamp, request version, and rejection reason, and must show the reason only to authorised recipients.
- If an approval is withdrawn, amended, or superseded, the system must preserve the original electronic record and create a new linked event rather than silently replacing it.
- If the system relies on an electronic signature, it must use authenticated accounts, protect signing credentials, prevent unauthorised reuse, and provide a way to retrieve the signed record.
- If the system uses a certificate authority or other trusted service, it must use an approved provider and retain the certificate, validation, and relevant service records required by the provider and applicable law.
- If an AI agent prepares an approval, it must not approve, reject, or sign on the user's behalf unless the user explicitly authorises the action through an attributable authenticated interaction.
- If an electronic record is exported or presented for review, it must retain the original approval metadata and enough context to verify the record's integrity and history.

## Implementation Gate

Do not implement a feature that collects, changes, approves, exports, or exposes employee data until its purpose, authorised roles, retention period, audit events, and approval requirements are defined. Unresolved legal or policy questions must be escalated to the system owner or qualified legal counsel.
