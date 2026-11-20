# Listings model validation

## Validation: FAIL

**Verdict**: FAIL. Unexpected persistence errors leave a job running because the error handler writes a forbidden source value before finalizing the job.

**Date:** 2026-11-20
**Spec:** `.specs/features/listings-model/spec.md`
**Diff range:** `9f52c3e^..9f52c3e`, with the preserved working-tree edits present during execution
**Verifier:** independent sub-agent; implementation author and verifier are different agents
**Round:** 1

## Ranked finding and fix plan

1. **P2: Finalize unexpected failures without inserting a synthetic portal source.** `backend/src/property/application/execute-run.ts:61` calls `store.source` with `source: 'system'` before `store.finish(..., 'failed', ...)` at line 68. The new constraint in `backend/supabase/migrations/20261120101344_listings_model.sql:102` accepts only `dfimoveis` and `wimoveis`. Any unexpected error after a successful claim reaches this path, but the diagnostic insert fails with SQLSTATE `23514`; the enclosing catch swallows that failure and never finishes or releases the job. The failed job continues to appear running and blocks new jobs until expiry and later takeover. This violates REQ-003's preservation of job workflows and the acceptance criterion for existing queue/lease outcomes.

   Independent reproduction used the production `propertyStore` and `executeRun`, with a provider returning `price_cents: -1`. The rejected observation correctly raised `23514`, but the saved job remained `state: 'running'`, `finished_at: null`, `error_category: null`; `private.worker_state` retained the same job with a live lease. A direct diagnostic RPC with `p_source: 'system'` returned HTTP 400 / `23514`. Evidence: `/tmp/listings-verifier-repro.ts:19` and `/tmp/listings-verifier-repro.log`. The disposable test rows were reset after reproduction.

   **Fix task:** Persist unexpected-error diagnostics at job level, then mark the job failed and release the lease through the fenced finish operation. Keep portal source rows restricted to the two real sources. Update the adapter, shared port, generated RPC types and baseline together if the RPC signature changes. Add a real-adapter regression asserting exact `failed` state, non-null completion time, sanitized error category, cleared worker job and no fabricated source row. Confirm expired owners still cannot finalize. Re-run local database, type, lint and browser gates after changing the baseline. **Done when:** the regression fails before the fix and passes afterward, and the full gates remain green.

## Task completion and scope

The spec uses a single atomic refactor in its Execution Plan; there is no `tasks.md`. `execution.md` is the recorded implementation/gate checklist. Schema, backend adapters, frontend consumers, generated types, fixtures and documentation are implemented in `9f52c3e`. The failure transition above requires a fix before completion.

Reviewed the commit diff and current implementations. Existing provider-header, hourly-polling, README/docs-duration, package-lock and unrelated-spec edits were preserved. No source or test files were modified by the verifier. The approved fresh-reset model intentionally removes legacy replay and persisted membership behavior; that removal is not a regression.

## Spec-anchored acceptance criteria

Each numbered row is one WHEN/THEN bullet from the spec. Broad workflow language is interpreted using the specific existing scenarios named in the acceptance criteria and `execution.md`.

| Criterion | Spec-defined outcome | File:line and assertion evidence | Result |
| --- | --- | --- | --- |
| REQ-001.1: collect a listing | Internal UUID, canonical URL, optional portal ID, English nullable attributes, centavo price | `tests/integration/database_test.ts:389` asserts `rows[0].id === before.id`; `:390` asserts the changed canonical URL; `:405` asserts separate IDs for separate sources. `tests/integration/worker_test.ts:250` deep-compares the complete parsed observation including portal ID, `price_cents: 120000000`, English attributes and canonical URL. `:267` asserts unknown price is null. `tests/unit/worker_test.ts:206` asserts every missing attribute is null. UUID generation is declared at migration line 11. | PASS |
| REQ-001.2: changed, unchanged or unknown price | Append each real change linked to listing/job; no unchanged entry; preserve known value/time on unknown | `tests/integration/database_test.ts:413` deep-compares history prices `[120000000,110000000,100000000]`; `:418` asserts every history job equals the current job; `:663` asserts history listing ID and `:667` exact `110000000`; `:682` asserts no second-job history for unchanged prices; `:272` deep-compares price and observation timestamp before/after unknown. | PASS |
| REQ-001.3: removal or failed check | Preserve listing/mark/history; failed check does not remove | `tests/integration/database_test.ts:279` asserts removed availability; `:283` and `:284` assert retained history and mark; `:291` asserts unknown verification keeps active availability; `:303` asserts only one listing after reappearance. `:851` asserts active verification clears removal and preserves observation time. | PASS |
| REQ-002.1: save search | Typed valid criteria; false amenity means no requirement; existing form persists | `tests/integration/database_test.ts:136` and `:139` assert rejection and full unchanged row for invalid writes; `:581` repeats atomic rejection for null/non-finite/invalid families. `frontend/tests/interface.spec.ts:829` and `:863` compare all persisted search fields after create/edit, including true and false amenities. `shared/search.ts:40` maps false to null; matching uses `!s.hasElevator` / `!s.hasParking`. | PASS |
| REQ-002.2: queue collection | One durable idempotent job, rate limit, one active job, immutable claim snapshot | `tests/integration/database_test.ts:184` asserts replay returns the same job and `:185` a single row; `:191` asserts changed payload returns 400; `:197` asserts busy outcome; `:601` checks below-sixty denial and `:609` accepts after sixty; `:215` asserts exactly one concurrent claimant; `:374` asserts exactly one provider contact across OS contenders; `:162` asserts original snapshot name after edit; `:869` asserts queued ID survives claim. `tests/integration/schedule_test.ts:40` asserts one accepted concurrent schedule and `:46` the exact enabled-search UUID array. | PASS |
| REQ-002.3: stale lease/takeover | Reject every stale mutation; interrupt previous job before takeover | `tests/integration/database_test.ts:643` asserts HTTP 400 for renew/source/finish/save with expired ownership; `:644` and `:645` deep-compare jobs/listings; `:647` asserts zero source rows. `:232` asserts previous job becomes interrupted. Source review: migration line 237 takes the singleton row lock and checks job/token/expiry; each mutation calls it, while takeover holds the same row lock. | PASS |
| REQ-003.1: non-owner access | No application data or worker RPC access | `tests/integration/database_test.ts:453` asserts populated reads return `[]`; `:492` compares complete rows after denied writes; `:560` asserts each worker RPC returns 403; `:820` asserts non-owner health is 403; `:834` asserts private worker-state route is 404; `:841` asserts comparison view returns `[]`. RLS, grants, invoker view and empty security-definer search paths reviewed. | PASS |
| REQ-003.2: frontend workflows | New schema supports listing/mark/history/search/job/health workflows, including failure outcomes | `frontend/tests/interface.spec.ts:149` asserts 30 rows; `:164` exact filtered listing; `:310` persisted mark status; `:345` cleared mark retains note; `:863` all search fields; `:891` job identity and `:896` email state; `:906` / `:913` exact online/offline boundaries. `frontend/tests/interface.spec.ts:408` asserts two history rows and `:409` / `:412` assert the exact chronological prices. These all pass, but the independent real-adapter failure reproduction leaves a running job. No committed regression asserted terminal state on this error path. | FAIL: finding 1 |
| REQ-003.3: comparisons | Subject-excluded active eligible medians, at least five peers, no stored comparison columns | `tests/integration/database_test.ts:332` asserts exact five-/six-peer medians `12000` / `12500`; `:339` and `:340` assert four peers yield null discount and median; `:728` asserts excluded peers leave exactly five; `:729` / `:730` assert exact median and 25% discount; `:745` asserts read-time recomputation after price change. `:97` asserts derived fields absent from listings. | PASS |
| AC1: local installation | Exactly the eight agreed application tables; no legacy tables | `tests/integration/database_test.ts:69` deep-compares the complete public/private table inventory to eight exact names. Only the fresh baseline exists under migrations. Fresh reset was performed by the author; the independent full suite queried that resulting schema. | PASS |
| AC2: ported regressions | Owner access, forms, pagination, price, queue, schedule, lease and browser outcomes pass | Independent `rtk deno test -A tests/`: 79 passed, zero failures. Existing browser run: 48 passed. The unexpected-failure workflow uncovered by independent reproduction is missing from those regressions and must be added. | FAIL: finding 1 |
| AC3: types/build | Frontend and Deno entrypoints compile against new contract | `rtk deno task check` exits 0 for all three entrypoints; `rtk npm run build` exits 0 for TypeScript plus Vite. | PASS |

**Spec-anchored result:** 10/12 complete; two workflow/gate criteria share one concrete defect. No separate spec-precision gap blocks the agreed model. File citations above reference the reviewed pre-fix snapshot.

## Edge cases and quality

- Unknown first price remains null with no history; known price/timestamp survives later unknown observations.
- Same-source portal ID preserves identity and marks through URL change; the same portal ID across different sources remains separate.
- Multiple price changes within one job remain distinct; unchanged observations do not duplicate history.
- Null arrays, out-of-range numbers, non-finite bounds and padded invalid search names reject atomically.
- Queue replay, payload conflict, busy jobs, exact rate boundary, concurrent seed, claim identity, concurrent schedules and lease expiry pass their outcome assertions.
- Four peers cannot rank; five/six eligible peers yield exact medians; removed/zero-price/zero-area/wrong-room/wrong-neighborhood peers are excluded.
- Owner-only RLS and worker privileges are separated from frontend health access.
- Unexpected persistence failure does not reach a valid terminal transition: finding 1.

Simplicity, required change scope, naming/style and frontend contracts match the approved atomic refactor. Reviewed SQL advisory/row locking, immutable snapshots, source-qualified identity and invoker-security comparisons. Existing unrelated edits were excluded from scope. Every sampled unit/integration/browser scenario maps to the model requirements or explicitly retained regression workflows. The real-adapter missing exception path prevents a clean quality verdict. Project command guidance: user-provided AGENTS.md requires the `rtk` prefix; every verifier shell command used it.

## Gates and test integrity

There is no tasks.md gate section; the mandatory gate comes from the spec Execution Plan and `execution.md`.

| Gate | Result | Provenance |
| --- | --- | --- |
| `rtk deno test -A tests/` | 79 passed, 0 failed, 0 skipped; 1m31s | Independent rerun, `/tmp/model-verifier-deno.log` |
| `rtk deno task check` | Exit 0, three entrypoints | Independent rerun |
| `rtk deno lint` | Exit 0, 79 files | Independent rerun |
| `rtk deno task fmt:check` | Exit 0, 86 files | Independent rerun |
| `rtk npm run build` in frontend | Exit 0; known bundle-size warning | Independent rerun |
| Browser regression | 48 passed, 0 failed; 52.5s | Author run inspected, `/tmp/model-final-browser.log`; full Deno rerun also exercises three real browser boundary proofs |
| SQL lint/advisors | No schema errors; no issues | Author logs inspected, `/tmp/model-sql-lint.log`, `/tmp/model-advisors.log` |
| Unexpected persistence failure | Reproduced incorrect running state | Independent real-adapter check, `/tmp/listings-verifier-repro.log` |

Recorded pre-refactor Deno baseline: 75 tests (15 unit and 60 integration scenarios, `execution.md`). Final independent count: 79, delta +4; no skipped tests. Legacy parser/upgrade/persisted-match tests were deliberately replaced with fresh-install identity/observation/current-criteria tests under the approved reset model. No assertion weakening was used to explain the discovered failure. MODEL09's corrected HTTP 204 expectation matches a void PostgREST RPC and passes the full final suite.

## Discrimination sensor

Sensor depth: lightweight, three behavior mutations. A copy of backend/src, shared, tests and Deno config was created under `/tmp/listings-sensor-*`. Its unmutated unit baseline passed 15/15. No real source, tests, SQL definitions or git state were mutated. Each mutation was restored inside the scratch before the next; scratch was deleted at the end.

| Mutation | Production location | Behavior fault | Evidence and result |
| --- | --- | --- | --- |
| 1 | `backend/src/property/domain/matches-profile.ts:12` | Inclusive minimum-centavo bound `>=` becomes exclusive `>` | Killed by `tests/unit/worker_test.ts:237`, expected matching true but got false. 14 passed, 1 failed. `/tmp/listings-sensor-exclusive-price-bound.log` |
| 2 | `backend/src/property/providers/parse-property-html.ts:42` | Parse numeric price with multiplier 10 instead of 100 | Killed by `tests/unit/worker_test.ts:186`, expected 120000000 but got 12000000. 14 passed, 1 failed. `/tmp/listings-sensor-wrong-price-unit.log` |
| 3 | `backend/src/property/application/collect-properties.ts:73` | Invert new-listing profile match | Killed by exact email-count assertions at `tests/unit/worker_test.ts:213` and `:226`. 13 passed, 2 failed. `/tmp/listings-sensor-inverted-new-matches.log` |

**Result:** 3 injected, 3 killed, 0 survived. `git status --porcelain` matched exactly before/after all sensor work, before the report and implementer's requested follow-up edits. Baseline status saved at `/tmp/listings-sensor-status-before.txt`; results at `/tmp/listings-sensor-results.json`. No stash was used.

## UAT and traceability

No new interactive UAT was run by this verifier. Existing Playwright outcomes provide reproducible browser evidence; human review remains available for subjective presentation choices.

REQ-001: verified. REQ-002: verified. REQ-003: needs fix for job failure workflow. The spec/source/tests were left unchanged by the verifier. Reverify finding 1 and the complete gate after the implementing agent adds its fix. The deterministic completion validator must reject this FAIL report until then.
