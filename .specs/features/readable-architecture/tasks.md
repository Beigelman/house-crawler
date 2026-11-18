# Architecture execution

## Test Coverage Matrix

| Requirement | Checks                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| ARCH-01     | Existing CLI/process and database tests; frontend build                           |
| ARCH-02     | Existing browser assertions, frontend build                                       |
| ARCH-03     | Existing worker, schedule and database assertions                                 |
| ARCH-04     | Deno check, frontend build, architecture boundary inspection                      |
| ARCH-05     | Formatting, migration hashes, unchanged assertion count, documentation inspection |

## Gate Check Commands

Build: rtk deno task lint; rtk pnpm --dir frontend run build.
Full: Build plus rtk deno task test; rtk pnpm --dir frontend test.
Quick: rtk deno test -A tests/unit/.
Run database and browser proofs sequentially. Do not run production entrypoints against root .env.

## Execution Plan

```text
T1 -> T2 -> T3 -> T4 -> T5
```

## Task Breakdown

### T1: Relocate backend and database configuration

Depends on: none
Where: backend/, root configuration, test paths
Tests: existing integration and CLI tests, unchanged assertions
Gate: Full
Done when: ARCH-01 passes; migration bytes unchanged; user edits remain uncommitted.
Status: complete

### T2: Separate frontend features and data access

Depends on: T1
Where: frontend/src/
Tests: existing browser assertions
Gate: Full
Done when: ARCH-02 passes; no App/pages cycle; Supabase calls outside presentation.
Status: complete

### T3: Establish backend and shared boundaries

Depends on: T2
Where: backend/src/, shared/, affected imports
Tests: existing parsing, filtering, HTTP and integration assertions
Gate: Full
Done when: ARCH-04 passes; types module no longer executes scraping; shared is pure.
Status: complete

### T4: Separate collection validation and worker lifecycle

Depends on: T3
Where: backend/src/property/application/, backend/src/runtime/
Tests: existing worker/schedule/fencing assertions
Gate: Full
Done when: ARCH-03 passes with separate flows and explicit composition.
Status: complete

### T5: Consolidate formatting tests styles and documentation

Depends on: T4
Where: tests/, frontend styles, README.md, docs/
Tests: all existing assertions, migration hashes, formatting
Gate: Full
Done when: ARCH-05 passes, current architecture documented, independent verification recorded.
Status: complete
