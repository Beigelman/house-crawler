# Readable architecture

## Problem Statement

Implement the approved architecture proposal with backend/src and backend/supabase, preserving observable behavior and existing local edits.

## Out of Scope

New product behavior, flights, deployment, remote writes, rewritten migration history.

## Assumptions & Open Questions

| Assumption            | Chosen default                                                          | Rationale                               |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| Authority             | Approved docs/architecture-proposal.md plus subsequent user corrections | User requested execution                |
| Runtime configuration | Deno config and environment remain at root                              | Preserve existing operational interface |
| Browser test port     | Dedicated 5174 with matching callback URLs                              | Existing development server uses 5173   |
| Open questions: none. |                                                                         |                                         |

## User Stories

As a maintainer, I can find a screen, a collection flow and a database adapter by their names and paths.

Acceptance Criteria:

1. When running root Deno tasks, the system SHALL load backend/src entrypoints and backend/supabase configuration while retaining existing task names.
2. When browsing the frontend, the system SHALL retain routes, filters, marks, profiles, authentication and queued collection behavior with feature-local queries and no App/pages import cycle.
3. When running collection or validation, the system SHALL preserve partial outcomes, deduplication, cancellation, lease fencing, scheduling and email failure semantics through separate use cases.
4. The system SHALL keep shared contracts pure and separate provider implementation, diagnostics, HTTP, persistence and notification boundaries.
5. The system SHALL preserve existing test assertions and migration bytes, provide current architecture/database/operation documentation and readable formatting.

## Requirement Traceability

| ID      | Acceptance | Evidence                                     | Status   |
| ------- | ---------- | -------------------------------------------- | -------- |
| ARCH-01 | 1          | Deno tasks and CLI integration               | verified |
| ARCH-02 | 2          | Browser suite and frontend build             | verified |
| ARCH-03 | 3          | Worker and schedule tests                    | verified |
| ARCH-04 | 4          | Typecheck and dependency inspection          | verified |
| ARCH-05 | 5          | Migration hashes, test counts and formatting | verified |
