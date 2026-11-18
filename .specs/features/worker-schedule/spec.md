# Worker collection schedule

## Problem Statement

The persistent worker only consumes manual requests. Add automatic collection at 06:00, 14:00 and 22:00 America/Sao_Paulo through the same durable queue.

## Out of Scope

Automatic validation, schedule editing, OS cron installation, remote deployment, and changes to portal adapters.

## Assumptions & Open Questions

| Assumption | Chosen default | Rationale |
| --- | --- | --- |
| Schedule | 06:00, 14:00, 22:00 America/Sao_Paulo | User confirmed |
| Offline behavior | Enqueue only the most recent due slot | One catch-up avoids a backlog |
| Busy queue | Defer scheduling until an active request finishes | Preserve existing single-request invariant |
| No owner or enabled profiles | Do not enqueue | No authorized search to execute |
| Deployment | Local implementation only | Production migration remains a separate rollout action |

Open questions: none.

## User Stories

As the owner, I want my saved searches collected three times daily while the worker is running.

Acceptance Criteria:
1. WHEN the clock reaches 06:00, 14:00 or 22:00 Brasília time, the scheduler SHALL select that slot; before 06:00 it SHALL select yesterday at 22:00.
2. WHEN an unscheduled latest slot is due and the queue is free, the scheduler SHALL persist one queued request containing all enabled profile IDs and the configured owner ID.
3. WHEN the worker restarts or multiple workers poll the same slot, the scheduler SHALL create at most one request for that owner and slot, including after that request completes.
4. WHILE a request is queued or running, the scheduler SHALL return busy without creating another request; when no owner or enabled profiles exist, it SHALL return no_owner or no_profiles without creating a request.
5. WHEN a worker polls, it SHALL attempt scheduling before claiming work; if scheduling fails, it SHALL still process existing manual requests.
6. WHEN a non-service client calls the scheduled enqueue RPC, the database SHALL deny access.

## Requirement Traceability

| ID | Scope | Status |
| --- | --- | --- |
| SCHED-01 | AC1 timing | verified |
| SCHED-02 | AC2 durable payload | verified |
| SCHED-03 | AC3 deduplication | verified |
| SCHED-04 | AC4 busy and empty setup | verified |
| SCHED-05 | AC5 polling and failure isolation | implementing |
| SCHED-06 | AC6 service-only RPC | verified |

## Execution Plan

1. Add durable scheduled enqueue and database boundary tests; commit feat(worker): add durable scheduled requests.
2. Wire scheduled enqueue into polling, add polling tests and operations documentation; commit feat(worker): poll scheduled collection jobs.

Gates: focused local database tests, polling tests, deno check src/worker.ts, and lint changed TypeScript. Independent verification follows the final task.

Task 1 complete: all four tests in tests/schedule_test.ts pass against the disposable local Supabase database. Assertions cover slot timestamps, persisted owner/profile/state payload, concurrency and completion deduplication, busy/empty setup, and 401/403 denial. Each test maps to the SCHED IDs in its name. No production changes.
