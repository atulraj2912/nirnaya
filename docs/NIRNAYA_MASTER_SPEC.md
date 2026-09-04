# NIRNAYA — MASTER TECHNICAL SPECIFICATION

Version: V1
Status: Authoritative Project Specification

This file is the verbatim authoritative specification provided for the
NIRNAYA project. All architecture, phase planning, and implementation
decisions in this repository must remain consistent with it. Where an
implementation decision resolves an ambiguity or intentionally narrows
scope, the decision and its rationale are recorded in `DECISIONS.md`
rather than by silently editing this document.

============================================================
1. PRODUCT DEFINITION
============================================================

NIRNAYA is an AI-powered internal Enterprise IT Service Management
(ITSM) and intelligent IT help desk platform.

It is designed for employees inside an organization to raise IT
support tickets and for IT agents and administrators to manage,
classify, assign, resolve, monitor and collaborate on those tickets.

NIRNAYA is NOT a customer-support/chat-support application.

Primary domain:
Artificial Intelligence

Subdomain:
AI-powered IT Service Management / Intelligent Help Desk Automation

The project should be suitable for:
- Major-project demonstration
- Portfolio presentation
- Technical evaluation
- Future production hardening

The goal is a complete coherent V1, not a throwaway prototype.


============================================================
2. CORE DIFFERENTIATORS
============================================================

NIRNAYA should differentiate itself through:

1. AI-powered ticket classification
2. Intelligent agent assignment recommendation
3. SLA response and resolution management
4. Real-time ticket and notification updates
5. Internal/public collaboration
6. Organization-aware RBAC
7. Complete ticket lifecycle
8. Activity/audit timeline
9. Data-driven automation rather than hardcoded demo behavior


============================================================
3. FROZEN TECHNOLOGY STACK
============================================================

Use exactly:

- Node.js 22 LTS
- JavaScript only
- Next.js with App Router
- React 19.x
- Prisma 6.x
- PostgreSQL 17.x
- Supabase PostgreSQL
- Tailwind CSS 4.x
- Zod 4.x
- React Query 5.x
- Socket.IO 4.x
- jose
- bcrypt

Architecture:

SINGLE Next.js application.

Next.js provides:
- frontend
- API route handlers
- server-side business logic
- authentication integration
- database access

Prisma connects directly to Supabase PostgreSQL.

Socket.IO provides realtime communication.

Do NOT use:
- TypeScript
- Express as a separate backend
- separate frontend/backend applications
- Supabase Auth
- MongoDB
- MySQL
- Firebase
- unnecessary state-management frameworks
- unnecessary UI frameworks

Supabase is PostgreSQL infrastructure only.
It is NOT the authentication provider.


============================================================
4. APPLICATION ARCHITECTURE
============================================================

Use clear separation between:

- app routes/pages
- reusable UI components
- API route handlers
- authentication
- authorization
- business/service logic
- database/Prisma
- validation
- AI services
- SLA engine
- notifications
- realtime/socket functionality

Do not put large business rules directly into React components.

Do not put large business rules directly into route handlers.

Prefer reusable server-side services and utilities.

The system should remain understandable to another developer.


============================================================
5. MULTI-TENANCY
============================================================

NIRNAYA is organization-aware.

All organization-owned resources must be isolated by organizationId.

A request must never be allowed to access another organization's:
- users
- departments
- tickets
- categories
- tags
- comments
- notifications
- AI predictions
- SLA configuration
- saved replies
- assignment histories
- watchers

V1 rule:

Each USER belongs to one department.

Multi-department users are deferred to a future version.


============================================================
6. ORGANIZATION
============================================================

Organization concept includes:

- id
- name
- slug
- description
- logoUrl
- businessHoursStart
- businessHoursEnd
- timezone
- ticketCounter
- createdAt
- updatedAt

Requirements:
- name unique
- slug unique
- ticketCounter defaults to 0
- ticket numbering must be atomic
- do not introduce createdBy/updatedBy on Organization if that creates
  bootstrap circular dependency

Business-hours fields exist for organizational configuration,
but SLA V1 does not pretend to support business-hours calculations
unless that functionality is explicitly implemented later.


============================================================
7. ROLES
============================================================

Three roles:

USER
AGENT
ADMIN


USER permissions:

- Create tickets
- View own tickets
- View own ticket details
- Add public comments to own tickets
- Reopen own resolved tickets where permitted
- Manage watchers on authorized own tickets
- View applicable SLA information
- Receive relevant notifications

USER cannot:
- see internal comments
- manage users
- manage departments
- assign tickets
- perform agent workflows
- perform admin operations
- access another user's tickets


AGENT permissions:

- View authorized organizational tickets
- Update ticket workflow
- Assign/reassign tickets where authorized
- Add public comments
- Add internal comments
- Use AI classification
- Request/view intelligent assignment recommendations
- Accept assignment recommendations where authorized
- Manage watchers on authorized tickets


ADMIN permissions:

- Organization-wide ticket management
- User management
- Department management
- Category management
- Tag management
- Assignment
- SLA configuration
- Organization configuration
- Saved replies
- Administrative analytics
- All authorized agent functionality


Every permission must be enforced server-side.

Hiding a UI button is NOT authorization.


============================================================
8. USER MODEL
============================================================

User includes concepts such as:

- id
- username
- email
- passwordHash
- employeeId
- role
- status
- avatarUrl
- designation
- organizationId
- departmentId
- createdById
- updatedById
- createdAt
- updatedAt

Important constraints:

- username unique within organization
- email unique within organization
- employeeId unique within organization when present
- organizationId required
- departmentId required for normal V1 organization users
- proper indexes for organization/department/role/status

Never trust client-provided:
- role
- organizationId
- status
- privileged ownership fields


============================================================
9. DEPARTMENTS
============================================================

Department includes concepts such as:

- id
- name
- code
- managerId (optional)
- organizationId
- createdById
- updatedById
- isActive
- createdAt
- updatedAt

Unique within organization:

(organizationId, name)
(organizationId, code)

Departments must always be organization-scoped.


============================================================
10. TICKETS
============================================================

Ticket number format:

NIR-YYYY-000001

Example:

NIR-2026-000001

Ticket numbers must be generated server-side.

Ticket number generation must use an atomic organization counter
mechanism to prevent collisions during concurrent ticket creation.

Do not allow clients to provide ticket numbers.


============================================================
11. TICKET TYPES
============================================================

Priority:

LOW
MEDIUM
HIGH
CRITICAL

Type:

INCIDENT
SERVICE_REQUEST

Source:

WEB
EMAIL
API


Initial categories:

NETWORK
HARDWARE
SOFTWARE
EMAIL
ACCOUNT
DATABASE
SECURITY
INFRASTRUCTURE


Categories and departments must be database entities.

Never hardcode database IDs.

============================================================
12. TICKET LIFECYCLE
============================================================

Canonical lifecycle:

OPEN
  ↓
ASSIGNED
  ↓
IN_PROGRESS
  ↓
WAITING_FOR_USER
  ↓
IN_PROGRESS
  ↓
RESOLVED
  ↓
CLOSED

Reopening:

RESOLVED
  ↓
REOPENED
  ↓
IN_PROGRESS


CLOSED is terminal.

Do not permit arbitrary state transitions.

Transitions must be validated server-side.

The client must never be allowed to bypass lifecycle rules.

USER:
- may reopen their own RESOLVED ticket where allowed

AGENT/ADMIN:
- may perform authorized workflow transitions

Assignment and state transitions should preserve relevant history.


============================================================
13. TICKET VALIDATION
============================================================

Validate server-side with Zod.

Example V1 constraints:

title:
- required
- maximum 200 characters

description:
- required
- maximum 10,000 characters

Validate:
- category exists
- category belongs to same organization
- department exists
- department belongs to same organization
- tags belong to same organization
- assigned agent belongs to same organization
- assigned agent has AGENT role
- assigned agent is active
- privileged fields cannot be mass-assigned

Never trust client timestamps.

Server generates authoritative timestamps.


============================================================
14. COMMENTS
============================================================

Comments are internal ITSM collaboration.

Two visibility types:

PUBLIC
INTERNAL

USER:
- can create public comments on their own tickets
- can see public comments
- MUST NEVER see internal comments

AGENT/ADMIN:
- can see authorized public and internal comments
- may create internal comments
- may create public comments

Internal comments must never leak through:
- REST responses
- realtime payloads
- notifications
- activity APIs
- UI rendering
- unauthorized queries

Do not build an advanced customer-chat system.

Keep collaboration focused on ITSM.


============================================================
15. WATCHERS
============================================================

Users can watch authorized tickets.

Operations:

- list watchers
- add watcher
- remove watcher

Rules:
- no duplicate watcher
- watcher must belong to same organization
- requester must have permission to manage watchers
- arbitrary cross-org user IDs are forbidden
- watcher operations must not create notification recursion

Watcher activity may trigger relevant notifications/realtime events.


============================================================
16. ACTIVITY / AUDIT TIMELINE
============================================================

Ticket detail should provide a meaningful chronological activity timeline.

Relevant activity includes:

- ticket creation
- assignment
- reassignment
- status changes
- priority changes
- category changes
- department changes
- public comments
- internal comments
- SLA changes
- resolution
- closure
- reopening
- watcher add/remove
- AI classification
- AI assignment recommendation
- AI assignment acceptance
- other meaningful ticket changes where already persisted

Reuse existing domain history such as:
- TicketAssignmentHistory
- timestamps
- comments
- notifications
- existing persisted AI prediction information

Avoid creating a duplicate generic audit model unless there is a
strong architectural reason.

Activity must be:
- organization-safe
- role-aware
- paginated
- bounded
- chronologically ordered
- associated with actor identity where available

USER must not receive internal activity that reveals internal-only
information.


============================================================
17. AI TICKET CLASSIFICATION
============================================================

NIRNAYA provides AI-powered classification.

Input:
- ticket title
- ticket description
- relevant ticket context

Output:

- category
- priority
- department
- confidence
- explanation
- suggested next steps

Categories initially:

NETWORK
HARDWARE
SOFTWARE
EMAIL
ACCOUNT
DATABASE
SECURITY
INFRASTRUCTURE


AI output must be validated before use.

Confidence must be bounded and meaningful.

If category/department cannot be reliably resolved:
- return null
- do NOT select an arbitrary first database record

The implementation should support an actual AI provider when configured.

A deterministic fallback may be provided for local development/testing
when no AI provider key exists.

Fallback behavior must still be real deterministic logic, not fake
hardcoded demo results.

Persist AI prediction history appropriately.


============================================================
18. AI ASSIGNMENT RECOMMENDATION
============================================================

Intelligent agent assignment is a major NIRNAYA differentiator.

IMPORTANT:

Recommendation is NOT the same thing as assignment.

AI recommends.
Authorized human accepts/assigns.


Candidate eligibility:

- role = AGENT
- same organization
- ACTIVE status
- same department when department is known
- if department is unknown, organization agents may be considered
- exclude ADMIN
- exclude USER
- exclude inactive users
- exclude cross-organization agents
- exclude wrong-department agents when department is known


Consider these factors:

1. Department match
2. Category experience
3. Current workload
4. Priority readiness
5. Historical experience


Suggested weights:

Department: 30%
Category experience: 30%
Workload: 25%
Priority readiness: 10%
Historical experience: 5%

Normalize factors to 0-1 and final score to 0-100.

Lower active workload is better.

Workload generally includes tickets in:

ASSIGNED
IN_PROGRESS
WAITING_FOR_USER
REOPENED

Do not count CLOSED as active workload.

RESOLVED is generally not active workload.


Category experience:
- based on resolved/closed tickets for the relevant category
- use diminishing returns rather than allowing huge history to dominate


Historical experience:
- resolved/closed tickets across categories
- separate from exact category experience


Priority awareness:
- HIGH and CRITICAL tickets should consider agent readiness/load


Tie-break order should be deterministic:

1. category experience
2. lower workload
3. lower high/critical workload
4. stable user ID


Recommendation output should include:

- recommended agent
- score
- confidence
- workload
- relevant experience
- explanation
- contributing factors
- timestamp


Factor representation should expose:

{
  normalized,
  weight,
  contribution
}

Contributions should reconcile with the final score.


Assignment confidence formula should follow the established model:

gapRatio =
(topScore - runnerUpScore) / max(topScore, 1)

base =
0.35 + gapRatio * 0.50

Add:
- candidate-count contribution up to 0.08
- quality bonus up to 0.05

Bound final confidence to:

0.50 - 0.98


Examples of expected behavior:

48 vs 47:
approximately 0.50 confidence

60 vs 59:
approximately 0.50 confidence

80 vs 40:
approximately 0.68 confidence

90 vs 20:
approximately 0.93 confidence

60 vs 40:
approximately 0.63 confidence


Do not hardcode a particular agent as the winner.

Do not create N+1 database queries unnecessarily.

Use Prisma batching/groupBy/aggregate where appropriate.


============================================================
19. ASSIGNMENT ACCEPTANCE
============================================================

When an authorized AGENT/ADMIN accepts a recommendation:

Revalidate:

- authentication
- authorization
- ticket organization
- ticket current state
- agent organization
- agent role
- agent active status
- agent department
- recommendation freshness
- relevant ticket state

Do not blindly trust a previously calculated recommendation.

Persist assignment history.

Do not overwrite AI history unnecessarily.


============================================================
20. SLA ENGINE
============================================================

NIRNAYA has two independent SLA clocks:

1. Response SLA
2. Resolution SLA


RESPONSE SLA:

Starts:
- when ticket is created

Satisfied:
- first qualifying PUBLIC comment by AGENT or ADMIN

Does NOT satisfy:
- USER comments
- INTERNAL comments

Once satisfied:
- remains satisfied


RESOLUTION SLA:

Starts:
- when ticket is created

Satisfied:
- when ticket reaches RESOLVED

Paused:
- WAITING_FOR_USER

Resumes:
- IN_PROGRESS


SLA statuses:

ON_TRACK
WARNING
BREACHED
PAUSED
COMPLETED


Overall status severity should prioritize:

BREACHED
then warning/at-risk
then PAUSED
then ON_TRACK
then completed/satisfied

WARNING/AT_RISK should occur when remaining time is approximately
20% or less of the original duration.


Priority-specific SLA targets are configured through
SLAConfiguration.

If priority changes before SLA completion:
- recalculate due time from original ticket creation time
- use the new priority target


Important V1 limitation:

The current architecture may not have waitingEndedAt/history for exact
historical pause durations.

Do NOT falsely claim exact historical business pause accounting.

Unless the schema is deliberately extended and tested, the safe
deterministic V1 behavior is to retain/document the original
resolution due date behavior.

Business-hours SLA is NOT considered implemented unless actual
business-hours calculations are implemented.

Timezone behavior must be explicit.


============================================================
21. SLA SECURITY
============================================================

SLA information is server-controlled.

Clients cannot set:
- SLA status
- due dates
- firstRespondedAt
- waitingSince
- resolvedAt

USER:
- may see SLA for own authorized tickets

AGENT/ADMIN:
- may see SLA for authorized organizational tickets


============================================================
22. SLA NOTIFICATIONS
============================================================

SLA warning and breach notifications must be deduplicated.

Do not repeatedly create the same notification for the same:

ticket
+
notification type
+
user

Use an appropriate database index/query strategy.

Socket emission should happen after important persistence.


============================================================
23. NOTIFICATIONS
============================================================

Notifications should cover relevant events such as:

- ticket creation where appropriate
- assignment
- reassignment
- status changes
- comments
- watcher activity
- SLA warning
- SLA breach
- assignment acceptance
- other important ticket events

Notifications must be:
- organization scoped
- role/recipient appropriate
- deduplicated where required

Never expose:
- internal comment content to unauthorized users
- sensitive ticket content unnecessarily


============================================================
24. REALTIME / SOCKET.IO
============================================================

Use Socket.IO.

Standardized events:

ticket:updated
ticket:comment_added
ticket:assignment_changed
notification:read
notification:read_all


Rooms may include:

- user room
- organization room where genuinely appropriate
- ticket room


Ticket room access must be authorized.

USER:
- only their own ticket room

AGENT/ADMIN:
- authorized organizational ticket rooms


Do not expose sensitive data through socket payloads.

For comment events, payload should contain only safe metadata such as:

- commentId
- isInternal
- author information
- createdAt

Do NOT send comment content through a broad socket event where it
could leak.


For status notifications:
- send status information
- do not unnecessarily expose sensitive ticket data


Important mutation sequence:

1. Perform business mutation
2. Persist notification
3. Emit realtime event

Socket failure must NOT cause a successful business mutation to fail.


============================================================
25. AUTHENTICATION
============================================================

Use:

- bcrypt
- jose
- JWT
- secure HTTP-only cookies

Token model:

Access token:
approximately 1 hour

Refresh token:
approximately 7 days


JWT payload:

userId
role
organizationId


Secrets must come from environment variables.

Never hardcode JWT secrets.

Fail fast when required production secrets are missing.

Verify JWT cryptographically.

Verify user status server-side.

Do not trust role/organization data from request bodies.


============================================================
26. AUTHORIZATION
============================================================

Authorization helper concepts should support:

- requireAuth
- requireRole
- requireAdmin
- requireAgentOrAdmin

Authorization must be centralized where practical.

Every resource lookup must consider organization scope.

Examples:

Ticket lookup must constrain organizationId.

User lookup must constrain organizationId.

Department lookup must constrain organizationId.

Category/tag lookup must constrain organizationId.

Comment lookup must constrain ticket organization/authorization.

AI prediction lookup must constrain ticket organization/authorization.

Notification lookup must constrain recipient/organization.

Watcher lookup must constrain ticket organization.

Assignment history lookup must constrain ticket organization.


============================================================
27. DATABASE DOMAIN
============================================================

The intended V1 domain has approximately 17 core models.

Core concepts include:

- Organization
- Department
- User
- Ticket
- Category
- Tag
- TicketTag
- Comment
- Notification
- AIPrediction
- TicketAssignmentHistory
- Watcher
- SLAConfiguration
- SavedReply
- authentication/session-related data where required
- invitation-related data where required
- attachment-related data where required

Do not blindly create every possible model.

Only retain models required by the actual product.

Use:
- foreign keys
- indexes
- unique constraints
- organization-scoped uniqueness
- appropriate onDelete behavior
- audit fields


============================================================
28. DATA SAFETY
============================================================

Never perform destructive database operations simply to solve a
development issue.

The intended database is Supabase PostgreSQL.

Do not replace it with localhost PostgreSQL.

Use Prisma for database access.

The original project used Prisma db push intentionally rather than
a migrations directory for the showcase build.

If the implementation chooses migrations later, document the decision
first.

Seed data must be:
- idempotent
- realistic
- organization-scoped
- safe to run repeatedly

Never destroy real data during development.


============================================================
29. DEMO / SEED DATA
============================================================

Seed data should demonstrate the actual product naturally.

It may include:
- one organization
- multiple departments
- multiple users
- multiple agents
- categories
- tags
- realistic tickets
- comments
- notifications
- AI predictions
- assignment histories
- watchers
- SLA configuration
- saved replies

All demo data must exercise actual application logic.

Do NOT hardcode:
- a specific recommended agent
- fake AI outputs
- fake statistics
- fake ticket state
- fake SLA status

The flagship demo ticket should naturally produce useful AI
classification and assignment behavior from real stored data.


============================================================
30. API DESIGN
============================================================

Use Next.js route handlers.

APIs should be:
- authenticated where required
- role protected
- organization scoped
- validated
- bounded
- consistent in error handling

Potential API areas include:

/api/auth/*
/api/tickets/*
/api/tickets/[id]/*
/api/tickets/[id]/comments
/api/tickets/[id]/watchers
/api/tickets/[id]/activity
/api/notifications/*
/api/users/*
/api/departments/*
/api/categories/*
/api/tags/*
/api/sla/*
/api/ai/*
/api/admin/*

Exact routes may differ if architecture remains coherent.

Do not create duplicate APIs for the same business operation.


============================================================
31. PAGINATION / LIMITS
============================================================

All potentially unbounded endpoints must have bounded pagination.

Never return unlimited:
- tickets
- comments
- notifications
- activity
- users
- assignment history
- watchers

Use sensible defaults and maximum limits.

Validate pagination parameters server-side.


============================================================
32. UI
============================================================

NIRNAYA should look like a polished enterprise ITSM application.

Core pages/features:

- Login
- Dashboard
- Ticket list
- Ticket creation
- Ticket detail
- Comments
- Activity timeline
- Watchers
- Notifications
- AI classification
- AI assignment recommendation
- SLA information
- Agent workflows
- Admin management
- Users
- Departments
- Categories
- Tags
- SLA configuration
- Analytics where appropriate


Ticket detail should make the important intelligence visible:

- ticket number
- title
- description
- status
- priority
- type
- category
- department
- requester
- assigned agent
- SLA response clock
- SLA resolution clock
- AI classification
- AI assignment recommendation
- assignment confidence
- workload/experience
- comments
- activity timeline
- watchers


For AGENT/ADMIN:
- public/internal comment toggle
- assignment controls
- workflow controls
- AI recommendation acceptance where appropriate


For USER:
- no internal comments
- no privileged controls
- only own tickets


UX priorities:

- clean enterprise appearance
- responsive design
- accessibility
- loading states
- skeleton states
- empty states
- error states
- success feedback
- clear status indicators
- consistent spacing/typography
- no unnecessary redesign between phases


============================================================
33. REALTIME UI BEHAVIOR
============================================================

Realtime updates should integrate with the existing UI without forcing
manual refresh.

Ticket detail should react to:
- ticket updates
- comments
- assignment changes
- notifications

Dashboard notification state should synchronize across multiple tabs
where possible.

Notification read events:

notification:read
notification:read_all


============================================================
34. TESTING REQUIREMENTS
============================================================

Testing is mandatory.

At minimum test:

AUTH:
- login validation
- password verification
- JWT verification
- inactive user rejection

RBAC:
- USER restrictions
- AGENT permissions
- ADMIN permissions

ORGANIZATION ISOLATION:
- cross-org ticket access denied
- cross-org user access denied
- cross-org department access denied
- cross-org category/tag access denied
- cross-org watcher denied
- cross-org assignment denied
- cross-org AI data denied

TICKETS:
- creation
- validation
- numbering
- lifecycle
- invalid transitions
- reopening
- terminal CLOSED behavior
- assignment history

AI CLASSIFICATION:
- category
- priority
- department
- confidence
- unresolved entities
- fallback behavior
- persistence

AI ASSIGNMENT:
- candidate eligibility
- department filtering
- workload
- category experience
- historical experience
- priority readiness
- scoring
- tie breaking
- confidence
- acceptance revalidation

SLA:
- response clock
- resolution clock
- qualifying comments
- internal comment exclusion
- USER comment exclusion
- waiting pause
- resume
- priority change
- warning
- breach
- deduplication

COMMENTS:
- public comments
- internal comments
- USER visibility
- AGENT/ADMIN visibility

WATCHERS:
- add
- remove
- list
- duplicate prevention
- authorization
- cross-org protection

REALTIME:
- event names
- ticket room authorization
- payload security
- notification read synchronization
- socket failure isolation

ACTIVITY:
- ordering
- actor
- pagination
- authorization
- internal visibility

REGRESSION:
- complete test suite
- production build


============================================================
35. PROJECT DOCUMENTATION
============================================================

Maintain:

docs/NIRNAYA_MASTER_SPEC.md
docs/ARCHITECTURE.md
docs/PROGRESS.md
docs/TEST_PLAN.md
docs/DECISIONS.md


NIRNAYA_MASTER_SPEC.md:
- authoritative requirements

ARCHITECTURE.md:
- technical architecture
- directory structure
- data flow
- service boundaries

PROGRESS.md:
- completed phases
- current phase
- remaining work
- test/build status

TEST_PLAN.md:
- testing strategy
- test categories
- coverage expectations

DECISIONS.md:
- important architectural decisions
- rationale
- intentional limitations


============================================================
36. DEVELOPMENT PHASES
============================================================

Build in controlled phases.

PHASE 0:
Repository/environment inspection and project bootstrap.

PHASE 1:
Next.js foundation, dependencies, environment configuration,
base UI structure.

PHASE 2:
Prisma schema, database connection, seed infrastructure.

PHASE 3:
Authentication and authorization.

PHASE 4:
Core ticket system and lifecycle.

PHASE 5:
AI ticket classification.

PHASE 6:
Intelligent agent assignment.

PHASE 7:
SLA engine.

PHASE 8:
Notifications and realtime.

PHASE 9:
Comments, watchers and activity timeline.

PHASE 10:
Dashboard, analytics and administrative UI.

PHASE 11:
Security hardening, validation, regression testing and UX polish.

PHASE 12:
Final production build, documentation, environment setup and ZIP-ready
release.


Do not implement the entire application in one uncontrolled generation.


============================================================
37. DEVELOPMENT WORKFLOW
============================================================

Before each phase:

1. Inspect current repository.
2. Inspect existing files.
3. Inspect current database/schema where relevant.
4. Review project documentation.
5. Identify dependencies.
6. State the implementation plan.


During each phase:

1. Implement actual files.
2. Keep architecture consistent.
3. Validate inputs.
4. Implement authorization.
5. Add tests.
6. Run tests.
7. Run build/validation.
8. Fix failures.
9. Update documentation.


After each phase:

Report:
- what was implemented
- files changed
- tests run
- test results
- build result
- known limitations
- next phase

Do not mark a phase complete merely because the code compiles.


============================================================
38. GIT SAFETY
============================================================

Never:

- force push
- reset --hard
- rewrite history unnecessarily
- delete repositories
- overwrite unrelated work
- perform destructive cleanup without explicit approval


Prefer meaningful commits/checkpoints after stable phases.

The emergency Spring Boot repository is separate and must NOT be
rewritten or used as the architecture for this project.


============================================================
39. EMERGENCY PROJECT DISTINCTION
============================================================

There exists an older emergency/demo project based on:

- React
- Spring Boot
- Java
- microservices
- Kafka
- Redis

That project was only an emergency recovery/demo base.

It is NOT the real NIRNAYA architecture.

Do not copy its architecture.

Real NIRNAYA architecture:

Next.js
+
React
+
JavaScript
+
Prisma
+
Supabase PostgreSQL
+
Socket.IO


============================================================
40. IMPORTANT ENGINEERING RULE
============================================================

If requirements conflict, do not silently choose one.

Identify the conflict and explain it.

If an implementation detail is unspecified:
- choose the simplest sound solution
- document the decision
- avoid adding unnecessary complexity


============================================================
41. QUALITY BAR
============================================================

NIRNAYA must behave like a genuine enterprise ITSM product.

Do not optimize for:
- fastest possible code generation
- superficial UI
- fake AI
- fake analytics
- hardcoded demo behavior
- excessive feature count

Optimize for:

- correctness
- security
- organization isolation
- maintainability
- realistic business rules
- explainable AI
- reliable persistence
- testability
- coherent UX
- professional presentation


============================================================
42. CURRENT KNOWN INTENTIONAL V1 LIMITATIONS
============================================================

These must not be falsely represented as completed functionality:

1. Exact historical WAITING_FOR_USER SLA pause duration may require
   additional timestamp/history modeling.

2. Business-hours SLA calculation is not implemented unless explicitly
   developed and tested.

3. Organization timezone-aware SLA behavior must be explicit and should
   not be claimed as fully timezone-aware without implementation.

4. Advanced knowledge-base/RAG/chatbot functionality is outside the
   current V1 scope.

5. Advanced customer-chat functionality is outside scope.

6. Attachments, mentions and other advanced collaboration features
   should only be implemented if explicitly included in the current
   phase/specification.

Do not expand scope casually.


============================================================
43. FINAL PRODUCT EXPECTATION
============================================================

The final NIRNAYA V1 must be:

- runnable
- internally coherent
- secure
- database-backed
- organization-aware
- role-aware
- AI-enabled
- SLA-enabled
- realtime-enabled
- collaborative
- tested
- documented
- polished

It must be possible to export the complete source tree as a ZIP and
run it on another machine after installing dependencies and supplying
the required environment variables.

The ZIP must contain the actual complete project source code and
documentation, not generated explanations or pseudo-code.
