# Worker schedule validation

## Validation: PASS

**Date**: 2026-11-18
**Spec**: `.specs/features/worker-schedule/spec.md`
**Diff range**: `5ec075c^..818aed0`
**Verifier**: independent verifier sub-agent; no implementation changes made.

All seven acceptance criteria match the implementation and outcome assertions. The initial all-enabled-profile coverage gap is fixed in `818aed0`.

## Acceptance evidence

| AC | Expected outcome | Assertion evidence | Result |
| --- | --- | --- | --- |
| 1 | Latest due 06:00, 14:00 or 22:00 Brasília slot, including yesterday before 06:00 | `tests/schedule_test.ts:19`: `assert.equal(new Date(row.slot).toISOString(), new Date(expected).toISOString())`; before/exact-boundary cases at lines 8–14 | PASS |
| 2 | One queued request with configured owner and all enabled profile IDs | `tests/schedule_test.ts:42`: `assert.equal(rows.length, 1)`; lines 43–44 assert owner and queued state; line 45 asserts `[local.profile, secondProfile]` against a fixture with two enabled searches and one disabled search at lines 28–32 | PASS |
| 3 | Concurrent/restarted polling cannot duplicate an owner/slot, even after completion | `tests/schedule_test.ts:40`: accepted count equals 1 across four concurrent calls; lines 48–50 assert replayed outcome, identical persisted request ID, and row count 1 after completion | PASS |
| 4 | Busy/manual work preserved; no owner/no enabled profiles enqueue nothing | `tests/schedule_test.ts:56`, `:63`, `:76`: exact no_owner, no_profiles and busy outcomes; lines 60, 67, 80 assert persisted row counts; lines 83–87 prove enqueue resumes after manual completion | PASS |
| 5 | Schedule before claim; scheduling failure still processes manual jobs | `tests/schedule_poll_test.ts:51`: events equal `['schedule', 'claim']`; lines 52–56 assert the correct manual/scheduled run completes and clears its queue. Real adapter request/run completion asserted at `tests/schedule_test.ts:122` and `:123`; actual CLI completion at `:158` and `:160` | PASS |
| 6 | Non-service RPC access denied | `tests/schedule_test.ts:94`: HTTP 401 anonymous, 403 authenticated; line 96 asserts no queued rows | PASS |
| 7 | False disables scheduler; default enables it | Default: `tests/schedule_test.ts:158` asserts an automatically created request completes with no env override. Disabled: `tests/cli_preload.ts:19` sets false for the manual browser fixture; `frontend/tests/interface.spec.ts:999` asserts one queued manual job and `:1027` one run. Main supplied the passing isolated-port browser proof. | PASS |

Every new test maps to these criteria. Payload values and state are asserted, not merely method calls. No existing assertions were weakened; the preload explicitly isolates manual-only CLI/browser scenarios. No spec-precision gaps remain.

## Gates

- Independently ran `rtk deno test -A tests/schedule_test.ts tests/schedule_poll_test.ts` before and after mutation restoration: **8 passed, 0 failed**.
- Independently ran `rtk deno check src/worker.ts`: exit 0.
- Independently linted the six changed TypeScript files: exit 0. Reverification commit only strengthens the fixture and its assertion.
- Feature adds eight tests; existing assertions/tests were not removed.
- Main supplied existing-worker results: 23 checks passed, plus browser durability proof passed on isolated port 5175 after manual-only fixture isolation.

## Discrimination sensor

| Mutation | Target | Current outcome |
| --- | --- | --- |
| Truncate selected enabled profiles to `LIMIT 1` | `supabase/migrations/20261118223050_property_worker_schedule.sql:28` | KILLED: SCHED-02/03 fails at `tests/schedule_test.ts:45`, missing the second enabled UUID |
| Calculate slots in UTC instead of America/Sao_Paulo | `supabase/migrations/20261118223050_property_worker_schedule.sql:5` | KILLED: SCHED-01 fails at `tests/schedule_test.ts:19`, actual 06:00Z versus expected previous 22:00 Brasília (01:00Z) |

Current sensor: **2 injected, 2 killed, 0 survived**. The LIMIT 1 mutation survived the original single-enabled-profile fixture in the first review; `818aed0` corrected that gap.

Mutant SQL files were generated under `/private/tmp` and installed only into the disposable local Supabase database. The original migration was reapplied successfully afterward, then all eight schedule tests passed again. No production access occurred. No real source/test file was mutated. Real worktree porcelain exactly matched the pre-sensor baseline before the authorized report/lessons updates.

## Quality and scope

Changes reuse the existing durable queue, manual-enqueue lock, owner authorization, and worker lease. Timing uses the database clock and an explicit timezone. Scheduled RPC execution is granted only to service_role. The poller isolates scheduler failures from manual work. Documentation covers catch-up, disabling scheduling, shutdown/sleep, long-run delays, and avoiding duplicate external timers.

No implementation bug found. Production migration and worker restart remain outside local verification. Backend-only feature; interactive UAT is unnecessary.

## Lesson

Recorded candidate **L-008** through the skill's lessons script, grounded in the historical surviving LIMIT 1 mutant: test scheduled selection with at least two enabled searches and one disabled search, asserting every persisted profile UUID.

**Overall**: PASS. Local implementation is ready for the separately authorized production rollout.
