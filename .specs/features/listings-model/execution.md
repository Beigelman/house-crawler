# Listings model execution

One atomic database-contract refactor covers the baseline, shared objects, backend consumers, frontend queries, fixtures, tests and operational documentation. Remote resets and deployment remain outside this task.

## Verification coverage

| Requirement | Outcome evidence |
| --- | --- |
| REQ-001 | `tests/integration/database_test.ts:69` asserts the exact eight tables; MODEL02 asserts removed legacy/derived columns; MODEL04 asserts stable UUID and mark through URL change; MODEL05 separates portals; MODEL06 asserts all real price changes within one job. AC51–56 assert price preservation, history and availability outcomes. |
| REQ-002 | AC28 asserts invalid typed writes leave the complete row unchanged; AC30 asserts the original search name in the claim snapshot. AC32–40 assert durable identity, replay, rate limits, exclusivity and interruption. AC39 asserts every stale mutation returns 400 and leaves stored data unchanged. Schedule integration tests assert exact Brasília boundaries and one durable scheduled job. MODEL09 asserts one seed under concurrency; MODEL10 asserts a queued job keeps its ID through claim. |
| REQ-003 | AC03 asserts non-owner reads/writes/RPCs fail without data mutation. MODEL07 asserts health access and private-state isolation. AC58–62 assert eligible subject-excluded medians and live comparison timestamps. Browser tests assert login, filters, marks, history, saved searches, job outcomes, worker health and mobile/keyboard operation. |

Tests were ported to the new database contract. Legacy upgrade/parser tests were replaced with fresh-install, identity and observation tests because the approved baseline has no legacy data path. Persisted-match tests now evaluate current criteria without a match table. Comparison tests use real cohort inputs rather than writing derived columns. The 15 unit tests and 60 existing integration scenarios remain represented, with four new model regressions added.

## Status

Implementation complete. Local behavioral gates pass across the full regression run plus the corrected seed assertion. All 48 browser checks pass. Independent verification follows the implementation commit.

## Local checks

- Fresh baseline reset completed using `--local --no-seed`.
- SQL lint: no schema errors. Security/performance advisors: no issues.
- Deno type checking, lint and formatting pass.
- Frontend TypeScript/Vite production build passes; existing bundle-size warning remains.
- Deno regression coverage: 78 passed in the full run; corrected MODEL09 HTTP expectation (void RPC returns 204) passes in isolation. Independent verifier reruns the final full suite.
- Browser regression run and independent validation are recorded in `validation.md`.

## Preservation of existing work

Provider request headers, hourly worker polling and heartbeat edits, their unit test, package-lock changes and unrelated specs existed before this task. Their working-tree content is retained; the refactor commit excludes those existing edits.


## Independent review fix

Completed: unexpected persistence failures now use the fenced finish RPC to store a sanitized diagnostic on `crawl_jobs`, mark the job failed and release its lease. Portal result rows remain portal-only. MODEL11 used a real negative-price observation and failed before the fix (`running` instead of `failed`), then passed with exact failed state, `database` category, completion timestamp, cleared job/lease and no synthetic source row. The other 26 unit/worker regressions pass; type check, build, lint and formatting pass. The independent verifier passed the original 79-test gate and will rerun the final 80-test suite after this fix. Round-one findings are retained in `validation.round1.md`.
