# Listings model validation

## Validation: PASS

**Verdict:** PASS. The failure-transition defect found in round one is fixed and independently verified. No substantive gaps remain.

**Date:** 2026-11-20
**Spec:** `.specs/features/listings-model/spec.md`
**Diff range:** `9f52c3e^..d398263`
**Verifier:** independent sub-agent; author and verifier are different agents
**Round:** 2

## Resolved finding

Round-one evidence is retained in `validation.round1.md`. Commit `d398263` replaces the forbidden synthetic portal diagnostic with a fenced failed-job transition. `backend/src/property/application/execute-run.ts:61` passes the sanitized diagnostic directly to `finish`. `backend/src/property/persistence/supabase-property-store.ts:61` forwards it as `p_error`. The baseline's `finish_crawl_job` at `backend/supabase/migrations/20261120101344_listings_model.sql:301` checks ownership before updating job error/state/time and releasing the lease.

MODEL11 uses the real persistence adapter and an invalid negative-price observation. It asserts `failed`, the established sanitized category `database`, a completion timestamp, cleared worker job, expired lease, no synthetic source row and no invalid listing. The first draft guessed `internal`; the existing sanitizer classifies database-operation errors as `database` (`backend/src/platform/diagnostics.ts:7`). That correction retains the production diagnostic contract. The regression failed before the fix with running versus failed (`/tmp/model-failure-before.log`), passes in the independent full suite, and kills a scratch mutation that removes finalization.

## Task completion and scope

The approved plan is one atomic database-contract refactor, recorded in spec.md and execution.md; there is no tasks.md. Schema, shared objects, backend adapters/providers, frontend consumers, generated types, fixtures and operating documentation are implemented. The single review fix is complete.

The fresh-install schema intentionally removes legacy replay and stored search memberships under the user's approved reset model. No remote changes or deployment occurred. The verifier did not modify real source or tests. Provider-header, hourly-polling/heartbeat, README/docs-duration, package-lock and unrelated-spec work remains preserved.

## Spec-anchored acceptance criteria

Each row maps one WHEN/THEN bullet. Workflow assertions use the existing scenarios named in the spec and execution.md.

| Criterion | Spec-defined outcome | File:line and assertion evidence | Result |
| --- | --- | --- | --- |
| REQ-001.1: collect a listing | Internal UUID, canonical URL, optional portal ID, English nullable attributes, centavo price | `tests/integration/database_test.ts:389` asserts `rows[0].id === before.id`; `:390` asserts the changed canonical URL; `:405` asserts separate IDs for separate sources. `tests/integration/worker_test.ts:250` deep-compares the complete parsed observation including portal ID, `price_cents: 120000000`, English attributes and canonical URL. `:267` asserts unknown price is null. `tests/unit/worker_test.ts:206` asserts every missing attribute is null. UUID generation is declared at migration line 11. | PASS |
| REQ-001.2: changed, unchanged or unknown price | Append each real change linked to listing/job; no unchanged entry; preserve known value/time on unknown | `tests/integration/database_test.ts:413` deep-compares history prices `[120000000,110000000,100000000]`; `:418` asserts every history job equals the current job; `:663` asserts history listing ID and `:667` exact `110000000`; `:682` asserts no second-job history for unchanged prices; `:272` deep-compares price and observation timestamp before/after unknown. | PASS |
| REQ-001.3: removal or failed check | Preserve listing/mark/history; failed check does not remove | `tests/integration/database_test.ts:279` asserts removed availability; `:283` and `:284` assert retained history and mark; `:291` asserts unknown verification keeps active availability; `:303` asserts only one listing after reappearance. `:851` asserts active verification clears removal and preserves observation time. | PASS |
| REQ-002.1: save search | Typed valid criteria; false amenity means no requirement; existing form persists | `tests/integration/database_test.ts:136` and `:139` assert rejection and full unchanged row for invalid writes; `:581` repeats atomic rejection for null/non-finite/invalid families. `frontend/tests/interface.spec.ts:829` and `:863` compare all persisted search fields after create/edit, including true and false amenities. `shared/search.ts:40` maps false to null; matching uses `!s.hasElevator` / `!s.hasParking`. | PASS |
| REQ-002.2: queue collection | One durable idempotent job, rate limit, one active job, immutable claim snapshot | `tests/integration/database_test.ts:184` asserts replay returns the same job and `:185` a single row; `:191` asserts changed payload returns 400; `:197` asserts busy outcome; `:601` checks below-sixty denial and `:609` accepts after sixty; `:215` asserts exactly one concurrent claimant; `:374` asserts exactly one provider contact across OS contenders; `:162` asserts original snapshot name after edit; `:869` asserts queued ID survives claim. `tests/integration/schedule_test.ts:40` asserts one accepted concurrent schedule and `:46` the exact enabled-search UUID array. | PASS |
| REQ-002.3: stale lease/takeover | Reject every stale mutation; interrupt previous job before takeover | `tests/integration/database_test.ts:643` asserts HTTP 400 for renew/source/finish/save with expired ownership; `:644` and `:645` deep-compare jobs/listings; `:647` asserts zero source rows. `:232` asserts previous job becomes interrupted. Migration line 237 checks job/token/expiry under a row lock. `/tmp/listings-verifier-final-boundary.ts:24` additionally asserts post-takeover stale finish returns 400; `:25` and `:26` compare all stored jobs and worker state unchanged. | PASS |
| REQ-002.4: unexpected worker failure with valid lease | Failed job, sanitized diagnostic and released lease | `tests/integration/worker_test.ts:503` asserts the original 23514 error remains observable; `:505` asserts exact failed state; `:506` email state not_needed; `:507` diagnostic database; `:508` non-null finish time; `:511` null worker job; `:512` released lease; `:513` no fabricated source row; `:514` no invalid listing. | PASS |
| REQ-003.1: non-owner access | No application data or worker RPC access | `tests/integration/database_test.ts:453` asserts populated reads return `[]`; `:492` compares complete rows after denied writes; `:560` asserts each worker RPC returns 403; `:820` asserts non-owner health is 403; `:834` asserts private worker-state route is 404; `:841` asserts comparison view returns `[]`. RLS, grants, invoker view and empty security-definer search paths reviewed. | PASS |
| REQ-003.2: frontend workflows | New schema supports listing/mark/history/search/job/health workflows, including failure outcomes | `frontend/tests/interface.spec.ts:149` asserts 30 rows; `:164` exact filtered listing; `:310` persisted mark status; `:345` cleared mark retains note; `:863` all search fields; `:891` job identity and `:896` email state; `:906` / `:913` exact online/offline boundaries. `frontend/tests/interface.spec.ts:408` asserts two history rows and `:409` / `:412` assert the exact chronological prices. `tests/integration/worker_test.ts:505` now asserts the unexpected-error terminal state is failed and `:511` asserts the lease job is cleared. | PASS |
| REQ-003.3: comparisons | Subject-excluded active eligible medians, at least five peers, no stored comparison columns | `tests/integration/database_test.ts:332` asserts exact five-/six-peer medians `12000` / `12500`; `:339` and `:340` assert four peers yield null discount and median; `:728` asserts excluded peers leave exactly five; `:729` / `:730` assert exact median and 25% discount; `:745` asserts read-time recomputation after price change. `:97` asserts derived fields absent from listings. | PASS |
| AC1: local installation | Exactly the eight agreed application tables; no legacy tables | `tests/integration/database_test.ts:69` deep-compares the complete public/private table inventory to eight exact names. Only the fresh baseline exists under migrations. Fresh reset was performed by the author; the independent full suite queried that resulting schema. | PASS |
| AC2: ported regressions | Owner access, forms, pagination, price, queue, schedule, lease and browser outcomes pass | Independent `rtk deno test -A tests/`: 80 passed, zero failures; independent full Playwright: 48 passed. MODEL11 now covers the formerly missing failure transition. | PASS |
| AC3: types/build | Frontend and Deno entrypoints compile against new contract | `rtk deno task check` exits 0 for all three entrypoints; `rtk npm run build` exits 0 for TypeScript plus Vite. | PASS |

**Spec-anchored result:** 13/13 criteria match the required outcomes. No uncovered criterion or blocking spec-precision gap remains.

The independent boundary proof `/tmp/listings-verifier-final-boundary.ts:11` deep-compares every claim-time search field to the current saved row after editing the queued search; `:14` deep-compares the complete immutable snapshot after a second edit changes all settings. Lines 22–26 prove interruption and atomic stale-finalization denial after ownership changes. Lines 28–32 assert only migration `20261120101344`, exactly one finish RPC with the new signature, and execute privilege denied to anonymous/authenticated roles while allowed to service_role. The proof passed and reset its disposable rows; its log is `/tmp/listings-verifier-final-boundary.log`.

## Edge cases

- Unknown first price remains null without history; later unknown prices preserve the last known price and observation time.
- Reappearance/removal preserves identity, marks and history. Failed checks do not confirm removal; active verification clears removal without changing price observation time.
- Same-source portal identity survives URL changes; identical IDs on separate portals remain separate listings.
- Multiple real changes in one job are retained; unchanged prices in the same or later job add no history.
- Typed search validation rejects null/empty/invalid arrays, non-finite or inverted bounds, invalid suite/room counts and padded invalid names atomically. False amenity form values round-trip through null requirements.
- Replay, payload conflict, busy jobs, rate boundaries, concurrent seeding/scheduling, process-level exclusive claims and queued-job identity pass.
- Complete snapshots reflect claim-time settings and stay immutable after edits. Expired and replaced owners cannot commit stale writes or diagnostics.
- Four peers yield no ranking; five/six eligible peers yield exact subject-excluded medians; removed and invalid-size/price/cohort peers are excluded.
- Unexpected persistence failure now finalizes and releases the lease while preserving the original error.

## Gate check and test integrity

The gate comes from the spec Execution Plan and execution.md. Final independent gates ran against the fresh local baseline after `d398263`. The full Deno and browser suites ran sequentially against the shared disposable database.

| Gate | Outcome | Evidence |
| --- | --- | --- |
| `rtk deno test -A tests/` | 80 passed, 0 failed, 0 skipped; 1m31s | `/tmp/model-verifier-final-deno.log` |
| `rtk npm --prefix frontend exec -- playwright test` | 48 passed, 0 failed; 52.4s | `/tmp/model-verifier-final-browser.log` |
| `rtk deno task check` | Exit 0, all three Deno entrypoints | Independent final rerun |
| `rtk deno lint` | Exit 0, 79 files | Independent final rerun |
| `rtk deno task fmt:check` | Exit 0, 86 files | Independent final rerun |
| `rtk npm run build` in frontend | TypeScript/Vite exit 0 | Independent final rerun; existing bundle-size warning |
| `rtk supabase db lint --local --schema public,private` | Exit 0; no schema errors | `/tmp/model-verifier-final-sql-lint.log` |
| Focused snapshot/takeover/schema proof | Exit 0; all assertions pass | `/tmp/listings-verifier-final-boundary.log` |

Recorded pre-refactor baseline: 75 Deno tests (15 unit and 60 integration scenarios in execution.md). Final count: 80, delta +5; no skipped tests. Approved legacy parser/upgrade/membership scenarios were replaced by fresh-install identity/observation/current-criteria checks. MODEL11 adds the unexpected-failure regression. MODEL09's HTTP 204 expectation matches the void RPC. The diagnostic-category correction in MODEL11 matches the pre-existing sanitizer, and the exact failure/lease assertions remain intact.

## Discrimination sensor

Lightweight depth: three initial behavior mutations plus one focused mutation for the review fix. All four were killed. Initial mutations target code unchanged by the fix.

| Mutation | Production location | Behavior fault | Exact killing assertion |
| --- | --- | --- | --- |
| 1 | `backend/src/property/domain/matches-profile.ts:12` | Change inclusive minimum-centavo bound from >= to > | `tests/unit/worker_test.ts:237`, expected matching true, got false; 14 passed, 1 failed. `/tmp/listings-sensor-exclusive-price-bound.log` |
| 2 | `backend/src/property/providers/parse-property-html.ts:42` | Multiply numeric portal price by 10 instead of 100 | `tests/unit/worker_test.ts:186`, expected 120000000, got 12000000; 14 passed, 1 failed. `/tmp/listings-sensor-wrong-price-unit.log` |
| 3 | `backend/src/property/application/collect-properties.ts:73` | Invert profile match for new listings | `tests/unit/worker_test.ts:213` and `:226`, expected one email, got zero; 13 passed, 2 failed. `/tmp/listings-sensor-inverted-new-matches.log` |
| 4 | `backend/src/property/application/execute-run.ts:61` | Remove unexpected-error finalization | `tests/integration/worker_test.ts:505`, expected failed job, got running; 0 passed, 1 failed, 11 filtered out. `/tmp/listings-failure-sensor-mutant.log` |

The initial scratch unit baseline passed 15/15. The fix-sensor scratch baseline passed MODEL11 (one passed, eleven intentionally filtered). Each sensor copied sources/tests/config into /tmp; the integration sensor only adjusted its copied local-status cwd to discover the real disposable stack. All assertions and source imports used copied feature code. No real source/test/SQL definition was mutated. Scratch copies were deleted and disposable test rows reset. `git status --porcelain` matched exactly before and after each sensor, before writing this report. No stash was used. Logs and before-status snapshots are in `/tmp/listings-sensor-*` and `/tmp/listings-failure-sensor-*`.

## Code quality and requirement traceability

| Review check | Outcome |
| --- | --- |
| Scope, minimum code, no unnecessary abstraction or flexibility | Pass; baseline/consumer refactor and one required failure fix |
| Surgical changes and existing style | Pass; unrelated working-tree changes preserved |
| Domain outcomes, payload values and integration boundaries | Pass; exact identity/history/search/job/lease/comparison assertions plus real-adapter failure coverage |
| Route/browser happy, edge and error outcomes | Pass; all 48 browser tests, including query/save failures, empty states, forms, pagination and job operation |
| Test-to-requirement mapping | Pass; scenarios map to the model or retained workflows named by the spec |
| Project instructions | Pass; verifier shell commands use the user-required rtk prefix |
| Fresh migration fidelity and worker authorization | Pass; one installed baseline and one guarded finish signature, exact role grants verified |

REQ-001, REQ-002 and REQ-003 are verified. No additional fix task remains. Existing browser automation supplies reproducible UI evidence; no new interactive human UAT was required for the contract refactor. Round-one lesson L-009 was already recorded through the skill script and committed with the fix. This clean recheck adds no new lesson signal.
