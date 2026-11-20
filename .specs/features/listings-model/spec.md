# Listings model

## Problem Statement
Replace the legacy schema with the agreed fresh-install model. The user approved resetting the database and refactoring migrations, objects, and consumers. No remote database is changed by this work.

## Requirements
### REQ-001: Listing identity and observations
- WHEN a listing is collected, THE SYSTEM SHALL store an internal UUID, canonical URL, optional source identifier, English attributes, nullable unknown values, and integer-centavo prices.
- WHEN a price changes, THE SYSTEM SHALL append history linked by listing and job IDs; unchanged prices SHALL NOT append history, and unknown prices SHALL preserve the last known price and timestamp.
- WHEN a listing is removed or a check fails, THE SYSTEM SHALL preserve identity, marks and history; failed checks SHALL NOT confirm removal.
### REQ-002: Searches and jobs
- WHEN a saved search is written, THE SYSTEM SHALL validate typed criteria and preserve current form behavior, including false meaning no amenity requirement.
- WHEN a manual or scheduled collection is queued, THE SYSTEM SHALL persist one idempotent job, enforce the existing rate limit and one-active-job invariant, and capture immutable search settings at claim time.
- WHEN a lease expires or changes owner, THE SYSTEM SHALL reject every stale write and interrupt the previous job before takeover.
- WHEN an unexpected worker failure occurs while its lease is valid, THE SYSTEM SHALL mark the job failed, store a sanitized job diagnostic, and release its lease.
### REQ-003: Access and presentation
- WHEN a non-owner accesses application data or worker RPCs, THE SYSTEM SHALL deny access.
- WHEN the frontend displays listings, marks, history, searches, jobs or worker health, THE SYSTEM SHALL use the new schema and preserve existing user workflows.
- WHEN comparisons are queried, THE SYSTEM SHALL derive subject-excluded active-peer medians with a minimum of five eligible peers, without stored comparison columns.

## Assumptions & Open Questions

Open questions: none.
- Personal single-owner application, current two sources, current schedule and worker polling behavior.
- A job has one attempt. Automatic retry-attempt history and cross-portal physical-property deduplication are out of scope.
- Eight tables; no legacy migration replay, raw price column, or persisted search matches.
- Existing local Supabase is disposable test infrastructure. Remote reset/deployment is separate.

## Acceptance Criteria
- WHEN the schema is installed locally, THE SYSTEM SHALL create exactly the eight agreed application tables and no legacy tables.
- WHEN existing tests are ported, THE SYSTEM SHALL pass owner access, form, pagination, price, queue, schedule, lease and browser outcome checks.
- WHEN types are generated, THE SYSTEM SHALL compile the frontend and Deno entrypoints against the new model.

## Out of Scope
Deployment, remote resets, multi-user tenancy, automatic job retries, property deduplication.

## Execution Plan
One atomic refactor spans migrations, shared objects, backend adapters/providers, frontend consumers, test fixtures/assertions, generated types and current database/operation docs. These must change together because the old database contract is intentionally removed. Gate: disposable local reset; Deno tests, check, lint and formatting; frontend build and Playwright; independent verification.

## User Stories
As the owner, I can browse, annotate and track listing prices, edit saved searches, and operate durable crawl jobs on a fresh database.

## Requirement Traceability
| Requirement | Evidence |
| --- | --- |
| REQ-001 | database and worker integration tests; listing browser tests |
| REQ-002 | database, worker and schedule integration tests; search browser tests |
| REQ-003 | access integration tests; frontend browser tests |

## Status

Complete locally. Independent validation passes all 13 outcomes; see [validation.md](validation.md).
