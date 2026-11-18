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
7. WHEN WORKER_SCHEDULE_ENABLED=false, the CLI SHALL keep automatic scheduling disabled and continue processing manual requests; otherwise scheduling SHALL be enabled.

## Requirement Traceability

| ID | Scope | Status |
| --- | --- | --- |
| SCHED-01 | AC1 timing | verified |
| SCHED-02 | AC2 durable payload | verified |
| SCHED-03 | AC3 deduplication | verified |
| SCHED-04 | AC4 busy and empty setup | verified |
| SCHED-05 | AC5 polling and failure isolation | verified |
| SCHED-06 | AC6 service-only RPC | verified |
| SCHED-07 | AC7 opt out for existing external timers and manual fixtures | verified |

## Execution Plan

1. Add durable scheduled enqueue and database boundary tests; commit feat(worker): add durable scheduled requests.
2. Wire scheduled enqueue into polling, add polling tests and operations documentation; commit feat(worker): poll scheduled collection jobs.

Gates: focused local database tests, polling tests, deno check src/worker.ts, and lint changed TypeScript. Independent verification follows the final task.

Task 1 complete: all four tests in tests/schedule_test.ts pass against the disposable local Supabase database. Assertions cover slot timestamps, persisted owner/profile/state payload, concurrency and completion deduplication, busy/empty setup, and 401/403 denial. Each test maps to the SCHED IDs in its name. No production changes.

Task 2 complete: seven schedule tests pass, including the real store adapter scheduling, claiming and completing a persisted job. Polling failure isolation completes a manual job when scheduling throws. Type check and lint pass. Existing worker suite: 23 checks pass; browser check requires an alternate port because the user frontend owns 5173.

Final task gate: eight schedule tests pass, including the actual CLI default and real DB persistence. The existing browser durability test passes with an isolated temporary Playwright config on port 5175 and the manual-only fixture. No existing assertions were changed. The fixture disables scheduling to retain its manual-only scenario. Type check, lint and spec closure pass. Independent verification remains the final gate.
