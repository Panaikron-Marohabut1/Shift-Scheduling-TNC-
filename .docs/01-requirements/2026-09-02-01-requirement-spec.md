# Shift Scheduling System Requirement Specification

- **Class date:** 2026-09-02
- **Specification sequence:** 01
- **Status:** Discover-phase draft for stakeholder and legal review
- **Source pain notes:** `proposal.md`, sections 2.1-2.5

## 1. Problem Statement and Evidence

The Production Department maintains monthly shifts in Excel. A change requires repeated manual editing, review, and redistribution. This creates duplicated or outdated versions, makes change history difficult to establish, and forces schedule changes and confirmations through phone calls or other manual communication. Contractors and van drivers cannot access the internal Excel file directly, while HR has no structured schedule, leave, or overtime export that is agreed for its process.

The proposal identifies the following evidence:

- Excel must be manually edited and reviewed for schedule changes (`proposal.md`, 2.1).
- Different users may receive different schedule versions (`proposal.md`, 2.2).
- Phone calls and manual channels are used for changes and confirmations (`proposal.md`, 2.3).
- Contractors and van drivers need restricted operational access (`proposal.md`, 2.4).
- HR needs structured export support; full HR integration and automatic payroll/OT calculation are out of scope for the initial implementation (`proposal.md`, 2.5 and 4.2).

## 2. Scope, Actors, and Assumptions

### 2.1 In scope

A centralized scheduling service for authenticated users that supports monthly schedule management, standardized shift codes, business-rule validation, operator requests, supervisor approval, a central approved schedule, controlled notifications, restricted driver access, mobile operator access, HR viewing/export, and attributable audit/history records.

### 2.2 Actors

| Actor | Required responsibility |
| --- | --- |
| Shift Operator | View own/authorized schedule and submit supported requests. |
| Shift Supervisor | Manage assigned schedules, review requests, and perform required approvals. |
| HR | View approved schedule data and export only fields approved for HR processing. |
| External User (Contractor / Van Driver) | Read only the minimum approved transportation information. |
| System Administrator | Provision and manage access only after the authentication/provisioning decision is approved. |
| System owner / legal reviewer | Resolve business, privacy, retention, and approval decisions. |

### 2.3 Assumptions requiring confirmation

The backlog's current shift codes, teams A-D, six operators per team, six-day limit, one rest day, two swaps per month, and cross-shift approval are treated as documented current rules, not immutable legal conclusions. The system is a web-based central source with mobile access for operators and drivers as proposed; supported devices and identity provider remain open questions.

### 2.4 Explicitly out of scope

Automatic salary or OT payment calculation, payroll processing, full HR-system integration, leave-management replacement, transportation route optimization, GPS tracking, and autonomous AI approval or schedule change are out of scope for this specification. Export is limited to an approved, structured handoff.

## 3. Functional Requirements

Acceptance criteria use **Given/When/Then** so each requirement can be tested. All functional requirements below are **Priority: P0 / Must** unless stated otherwise.

### FR-001 Authentication and role access

**User story:** As a user, I want attributable authenticated access and a role-specific landing page so that I reach only scheduling functions and data permitted for my responsibility. **Backlog:** US-001, US-002, US-003.

**Acceptance criteria**

- Given valid credentials, when the user signs in, then the system creates an attributable session and shows the role-appropriate landing page.
- Given invalid credentials or no authenticated session, when protected content is requested, then access is denied without revealing protected data.
- Given a role assignment, when an action is requested through the UI or API, then the server enforces the role permission and records an authorization denial where applicable.

### FR-002 Team and employee scheduling data

**User story:** As a Supervisor, I want minimum employee, team, position, and skill data so that assignments and access routing use current authorized information. **Backlog:** US-004, US-005, US-006, US-007, US-013.

**Acceptance criteria**

- Given an authorized Supervisor, when employee/team data is viewed or maintained, then only fields needed for scheduling are available and team membership, position, and required skills can be represented.
- Given a team assignment, when schedule visibility or approval routing is evaluated, then the assigned team and Supervisor are used.
- Given an unauthorized role, when employee data is requested directly or through an API, then fields outside that role's approved scope are denied.

### FR-003 Monthly schedule creation and maintenance

**User story:** As a Supervisor, I want to create, edit, cancel, and review a monthly schedule in one central grid so that repeated Excel edits and duplicate versions are removed. **Backlog:** US-008, US-009, US-010, US-011, US-039.

**Acceptance criteria**

- Given an authorized Supervisor, when a month and team are selected, then employees, dates, shift codes, and relevant times are displayed in the monthly grid.
- Given a valid assignment change, when it is submitted, then validation runs before the change is saved and the central schedule is updated only according to its approval state.
- Given a cancellation, when it is accepted, then the assignment is marked cancelled or superseded and its prior value remains retrievable.
- Given two authorized clients, when they view the effective schedule after an approved change, then both receive the same central version.

### FR-004 Schedule codes and business validation

**User story:** As a Supervisor, I want standardized codes and validation so that schedules do not create unsafe, duplicate, unqualified, or understaffed assignments. **Backlog:** US-014, US-015, US-016, US-017, US-018, US-019.

**Acceptance criteria**

- Given the approved code configuration, when a schedule is displayed, then M, MT, N, NT, D, O/Blank, V, B, S, and H have one consistent meaning and configured work/leave status.
- Given a create, edit, swap, request, approval, or replacement action, when the six-consecutive-working-day, one-rest-day, duplicate/time-conflict, position/skill, coverage, or other configured rule is evaluated, then the result identifies the failed rule.
- Given a request outside the approved change window or one-day advance cutoff, when normal processing is attempted, then the request is blocked or routed to an explicitly approved exception workflow; the unresolved policy is not silently selected.

### FR-005 Operator schedule-change requests

**User story:** As an Operator, I want to submit and track a shift-change or day-off request from a supported device so that manual phone coordination is reduced. **Backlog:** US-020, US-021, US-026, US-050, US-051.

**Acceptance criteria**

- Given an authenticated Operator, when an affected date, requested schedule, and required reason are submitted, then the request is validated and receives Pending status.
- Given a submitted request, when the Operator opens it, then submission time, current status, decision time when present, and an authorized rejection reason are shown.
- Given a mobile-supported client, when the same request is submitted, then it uses the same validation and status rules as the web flow.

### FR-006 Shift swaps and replacement validation

**User story:** As an Operator or Supervisor, I want swap and replacement requests checked against eligibility and staffing rules so that an approved change remains operationally valid. **Backlog:** US-022, US-023, US-024, US-025, US-028, US-029, US-030.

**Acceptance criteria**

- Given two employees and a target shift, when a swap is submitted, then both employees' position, skill, conflict, coverage, and consecutive-day eligibility are checked.
- Given the documented monthly swap limit, when a request would exceed the limit, then the system blocks it and states which counting rule was applied; the counting rule remains conditional until confirmed.
- Given emergency sick leave, when retrospective correction is authorized, then the original and revised schedule values remain linked and the replacement is validated.
- Given planned leave, when a replacement or OT employee is proposed, then target-shift eligibility and consecutive-day rules are checked before approval.

### FR-007 Complete approval and rejection workflow

**User story:** As a Supervisor, I want a pending inbox and attributable approval decisions so that only fully approved changes become effective. **Backlog:** US-031, US-032, US-033, US-034.

**Acceptance criteria**

- Given a pending request, when an authorized Supervisor filters by type, employee, team, or date, then the matching request details and required approvers are displayed.
- Given a single-approver request, when the Supervisor approves or rejects it, then the decision, identity, timestamp, request version, and required reason are recorded and the status changes accordingly.
- Given a multi-approver request, when any required approval is missing, then the request remains pending; it becomes effective only after all required approvals are complete.
- Given any required rejection, when the workflow closes, then the schedule remains unchanged and the rejection reason is shown only to authorized recipients.

### FR-008 Effective schedule update and notifications

**User story:** As an affected user, I want the approved schedule and relevant event notification to be current so that I do not act on an old Excel version. **Backlog:** US-035, US-036, US-037, US-038.

**Acceptance criteria**

- Given an approved request, when it is applied, then the central effective schedule changes as one recorded operation and supported clients can retrieve the new version.
- Given a request submission, approval, rejection, or approved schedule change, when notification is enabled for the recipient, then the recipient receives only the minimum approved event details and a link or reference to the relevant record where supported.
- Given a recipient without permission, when notification content is generated, then it excludes other employees' restricted schedule, contact, leave, or health information.

### FR-009 HR schedule view and controlled export

**User story:** As HR, I want to view and export approved structured schedule data so that payroll, OT, and allowance processes can use it without repeated spreadsheet transformation. **Backlog:** US-040, US-041, US-042, US-043.

**Acceptance criteria**

- Given an authorized HR user, when date, team, or employee filters are applied, then only approved schedule data in the permitted scope is displayed.
- Given an approved export definition, when HR selects its permitted scope, then the export contains only approved minimum fields, including employee identifier, schedule date, shift/leave status, and separately represented normal and OT information as defined by HR.
- Given an export request, when it completes or fails, then the system records the requester, scope/filter, fields, timestamp, destination/download event, and result.
- Given no approved HR column, date, OT, or destination definition, when export configuration is requested, then the export remains conditional and does not invent a payroll rule.

### FR-010 Restricted contractor and van-driver access

**User story:** As a system owner, I want drivers to see only approved transportation information in read-only mode so that operational access is possible without exposing internal Excel or unrelated employee data. **Backlog:** US-044, US-045, US-046.

**Priority:** P0 for US-046; P1 for US-044 and US-045.

**Acceptance criteria**

- Given an authorized driver, when today's assigned transportation schedule is requested, then only the approved pickup/drop-off fields, relevant employees, date/time, and latest update indicator are returned.
- Given a driver session, when create, edit, delete, approve, or direct API mutation is attempted, then the server rejects the action.
- Given a driver visibility policy has not been approved, when fields are configured, then the feature remains conditional and medical, leave-detail, contact, or unrelated schedule data is excluded by default.

## 4. Non-Functional Requirements

All NFRs are **Priority: P0 / Must** and are linked to existing P0 backlog stories. Verification methods are mandatory.

| ID | Requirement and measurable target | Verification | Backlog |
| --- | --- | --- | --- |
| NFR-001 | For a test set of 1,000 authentication and authorization requests, 100% of unauthorized protected-resource attempts are rejected by the server; no protected response body is returned. | Automated API authorization tests and negative direct-URL/API tests. | US-001, US-002, US-004, US-046 |
| NFR-002 | For 95% of 1,000 schedule reads under the agreed MVP load profile, the server returns the authorized current schedule within 2 seconds; 99% complete within 5 seconds. | Repeatable load test using the approved device/network profile; record percentile latency. | US-008, US-012, US-035, US-039 |
| NFR-003 | After an approved schedule change is committed, 99% of 100 test observations retrieve the same effective version from each supported client within 60 seconds. | Multi-client consistency test with version identifiers and timestamped observations. | US-035, US-039, US-050 |
| NFR-004 | In 100 test request submissions, 100% have a durable status and an attributable event record, including failures returned to the user without duplicate application. | Integration tests plus database/event-log inspection. | US-020, US-021, US-031, US-032, US-033 |
| NFR-005 | In 100 export tests, 100% contain only the approved field set and include an export audit event with user, scope, fields, timestamp, destination/download event, and result. | Export contract tests, field diff, and audit-record inspection. | US-040, US-041, US-042, US-043 |
| NFR-006 | Authentication, authorization, schedule, request, export, notification, and approval events are retrievable for at least 90 consecutive days; 100% of test event records include real user/service identity and UTC timestamp. | Retention test, event-schema test, and protected-log retrieval test. | US-001, US-002, US-010, US-032, US-034, US-041 |
| NFR-007 | In 100 attempts, 100% of historical schedule and approval records remain retrievable after cancellation, revision, rejection, or supersession; no update deletes the prior evidence. | Revision and cancellation integration tests with before/after record comparison. | US-011, US-032, US-034 |
| NFR-008 | For 100 valid and invalid assignments across all configured rules, 100% produce the same validation result through web and mobile clients, and every rejection identifies a rule ID/message. | Cross-client automated acceptance suite. | US-009, US-015, US-016, US-018, US-019, US-022, US-025, US-030, US-051 |

## 5. Legal Requirements

These are requirements derived from `rule.md`, not legal advice. Each must be reviewed by the system owner and qualified legal reviewer before implementation. Every item links to an affected requirement and backlog item.

### PDPA

- **LR1:** The system shall document the scheduling purpose, minimum fields, authorized role/team scope, retention decision, and audit events before storing employee identity, team, role, schedule, request, or export data. **Source:** `rule.md`, PDPA rules 1, 4 and Implementation Gate. **Links:** FR-001, FR-002, FR-009; US-001, US-004, US-005, US-040, US-041.
- **LR2:** The system shall minimise and restrict leave or sick-leave detail, shall not expose health details to drivers or unrelated employees, and shall collect a reason only when required for the approved workflow. **Source:** `rule.md`, PDPA rules 2, 3 and 5. **Links:** FR-005, FR-006, FR-010; US-026, US-027, US-029, US-044, US-045.
- **LR3:** The system shall enforce role/team visibility for Operators, Supervisors, HR, and drivers at UI, API, and export boundaries. **Source:** `rule.md`, PDPA rules 6-9. **Links:** FR-001, FR-002, FR-009, FR-010; US-002, US-004, US-040, US-046.
- **LR4:** The system shall route access, correction, deletion, and other applicable data-subject requests through an authorized process while preserving only the minimum records needed for legal, payroll, safety, and audit obligations. **Source:** `rule.md`, PDPA rules 11-12. **Links:** FR-002, FR-003, FR-009; US-005, US-010, US-011, US-040.
- **LR5:** For a personal-data incident, the system shall support restricting further access, preserving evidence, notifying the responsible administrator, and following the organization's incident and legal-notification process. **Source:** `rule.md`, PDPA rule 13 and Implementation Gate. **Links:** FR-001, FR-002; US-001, US-002, US-004.
- **LR6:** Any AI-assisted schedule action shall use the same authorization and minimisation controls as the application and shall not infer/disclose sensitive data or approve/reject/sign without explicit attributable user authorization. **Source:** `rule.md`, PDPA rule 14 and Electronic Transactions AI rule. **Links:** FR-001, FR-003, FR-007, NFR-001; US-001, US-002, US-032, US-034.

### Computer Crime Act Section 26

- **LR7:** The system shall retain protected, retrievable access/traffic logs for at least 90 days, tied to a real user or accountable approved process, including authentication, denial, privilege, schedule, request, notification/API, and export events applicable to the deployed features. **Source:** `rule.md`, Computer Crime Act Section 26 and rules 1-10. **Links:** NFR-006; US-001, US-002, US-010, US-020, US-032, US-041, US-046.
- **LR8:** A schedule change audit record shall include real user, timestamp, previous value, new value, reason/source, affected employee, and affected date/shift; cancelled or revised records shall not silently overwrite evidence. **Source:** `rule.md`, Computer Crime Act rules 3, 5 and 10. **Links:** FR-003, FR-007, NFR-007; US-010, US-011, US-032, US-034.
- **LR9:** Each required request approver and HR export shall be individually attributable, with request/export scope and outcome retrievable for authorized investigation. **Source:** `rule.md`, Computer Crime Act rules 5, 7 and 8. **Links:** FR-007, FR-009, NFR-005; US-024, US-031, US-034, US-041.

### Electronic Transactions Act Sections 9, 26, and 28

- **LR10:** An electronic approval or rejection shall record authenticated approver, decision, timestamp, exact request/schedule version, and required reason, and shall be bound to the version that becomes effective. **Source:** `rule.md`, Electronic Transactions rules 1, 3 and 4. **Links:** FR-007, NFR-007; US-024, US-032, US-033, US-034.
- **LR11:** Cross-team or cross-shift approvals shall be recorded separately for each responsible Supervisor and shall not apply until all required approvals are complete. **Source:** `rule.md`, Electronic Transactions rule 5. **Links:** FR-006, FR-007; US-024, US-034.
- **LR12:** Withdrawn, amended, superseded, exported, or reviewed electronic records shall preserve original approval metadata and enough linked context to retrieve and verify integrity and history; an AI agent may prepare but not approve/sign without explicit attributable authorization. **Source:** `rule.md`, Electronic Transactions rules 6-10. **Links:** FR-007, FR-009, NFR-007; US-032, US-034, US-041, US-048.

## 6. Open Questions and Decision Owners

No option below is selected. The owner must decide before the affected conditional requirement is implemented.

| Question | Options and consequence | Decision owner | Affected |
| --- | --- | --- | --- |
| Schedule-change window, including the documented +/-7-day wording | A: fixed 7 calendar days, simplest validation but may misread the intended rule. B: configurable days before/after, adaptable but needs governance/versioning. C: no normal window with Supervisor exception, flexible but increases operational and audit risk. | System owner + Supervisor | FR-004; US-017 |
| One-day advance rule and emergency cutoff | A: hard block after 1 day, predictable but may obstruct legitimate emergencies. B: configurable cutoff with approved exception, flexible but needs authorization. C: allow late request with retrospective record, operationally flexible but increases staffing risk. | System owner + Supervisor + HR | FR-004, FR-006; US-018, US-028, US-029 |
| Authentication and provisioning | A: organization SSO, central control but depends on IT readiness. B: managed local accounts, deployable independently but adds credential lifecycle work. C: invitation plus approved MFA provider, flexible but requires provider and recovery decisions. | IT owner + system owner | FR-001; US-001, US-002 |
| Staffing minimums and exception behavior | A: hard block, protects coverage but may prevent emergency operation. B: warning plus Supervisor override, flexible but needs attributable exception approval. C: configurable by team/shift, accurate but increases setup complexity. | Production owner + Supervisor | FR-004, FR-006; US-019, US-030 |
| Swap counting rule | A: count submissions, limits workload but may penalize rejected requests. B: count approved swaps, reflects actual changes but permits repeated pending requests. C: count approved plus pending, strongest cap but requires withdrawal/expiry handling. | System owner + Supervisor | FR-006; US-023 |
| Notification channels and delivery target | A: in-system only, minimizes disclosure/integration but requires users to check. B: in-system plus email, improves reach but adds address/privacy handling. C: approved messaging channel, reaches users quickly but adds vendor and disclosure controls. | System owner + IT + legal reviewer | FR-008; US-036, US-037, US-038 |
| HR export format, OT rules, and destination | A: CSV with fields approved by HR, simplest but may require manual import. B: XLSX template matching current process, familiar but more formatting maintenance. C: API/file exchange, reduces manual work but requires integration and security decisions. OT: represent source fields only, or an HR-approved calculation input model, but not an invented formula. | HR owner + IT + legal reviewer | FR-009; US-041, US-042, US-043 |
| Driver visibility and identity | A: daily pickup/drop-off list only, minimal disclosure but limited context. B: list plus shift/time and approved contact field, useful but higher privacy exposure. C: route-scoped token/account, operationally precise but requires provisioning and expiry. | Transport owner + system owner + legal reviewer | FR-010; US-044, US-045, US-046 |
| Approval hierarchy and emergency replacement | A: one assigned Supervisor, simple but weak for cross-team coverage. B: both responsible Supervisors, stronger control but slower. C: designated emergency delegate with reason and later review, resilient but requires delegation rules. | Production owner + system owner | FR-006, FR-007; US-024, US-029, US-034 |
| History retention and deletion policy | A: retain operational history for a fixed approved period, predictable but may conflict with another obligation. B: retain audit evidence >=90 days and schedule history for a separately approved period, minimises data but needs two policies. C: retain until legal/payroll/safety hold ends, protective but requires hold administration. | System owner + legal reviewer + HR | LR4, LR7, LR8, LR12; US-047, US-048, US-049 |

## 7. Source Traceability

| Requirement | Source |
| --- | --- |
| FR-001 to FR-010 | `proposal.md` sections 3-8, 5 (roles), 6 (workflows), 7 (rules), 8 (notifications); backlog US links in each requirement. |
| NFR-001 to NFR-008 | `proposal.md` section 10, `rule.md` implementation baseline, and linked backlog stories. |
| LR1 to LR6 | `rule.md`, PDPA rules and Implementation Gate; linked functional/NFR and US items. |
| LR7 to LR9 | `rule.md`, Computer Crime Act Section 26 rules; linked functional/NFR and US items. |
| LR10 to LR12 | `rule.md`, Electronic Transactions Act Sections 9/26/28 rules; linked functional/NFR and US items. |
| Problem evidence | Supplied pain notes as documented in `proposal.md` sections 2.1-2.5. |
| Scope and roles | `proposal.md` sections 4-6 and backlog sections 2, 7-9. |
| Shift codes and current business rules | Backlog sections 3 and 6; marked conditional where the source says confirmation is required. |
| Deferred responsive/dashboard stories | `US-052`, `US-053`, and `US-054` remain Phase 1/2 backlog items outside this MVP draft and require a later specification update before implementation. |

## 8. Review Gate

Before implementation, stakeholders must resolve the open questions, approve the purpose/minimum-field/access/retention/audit/approval definitions, and confirm each conditional business rule. This draft is reviewable requirements work only; it does not authorize application code or production data collection.
