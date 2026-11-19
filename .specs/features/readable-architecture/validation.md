# Readable architecture validation

**Verdict: PASS.** All five acceptance criteria match the preserved baseline and
approved module boundaries. No open regression or architecture gap remains.

**Date:** 2026-11-18
**Spec:** `.specs/features/readable-architecture/spec.md`
**Diff range:** `077bef1..00d1c86f435bfd5c18d8c0c7b570491fee4fc9e5`
**Initial review range:** `077bef1..a79d110`; final review includes T6/T7.
**Verifier:** independent sub-agent, author != verifier.

## Task completion

| Task                            | Result | Evidence                                                                                                                          |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| T1: backend/database relocation | PASS   | Root task paths, CLI assertions, identical migration bytes                                                                        |
| T2: frontend features           | PASS   | Feature APIs, acyclic import graph, preserved browser assertions                                                                  |
| T3: backend/shared boundaries   | PASS   | Pure shared modules, ports, explicit runtime composition                                                                          |
| T4: separate flows              | PASS   | Collection/validation/notification modules, preserved outcomes                                                                    |
| T5: tests/styles/docs           | PASS   | Assertion counts, formatting, current documentation                                                                               |
| T6: mobile dashboard spacing    | PASS   | `frontend/src/features/dashboard/dashboard.css:59` restores 20px mobile padding; author reports four baseline PNGs byte-identical |
| T7: execution types             | PASS   | `backend/src/property/ports.ts:3` defines separate RunKind/CommandKind and closed run/email/result types; final checks pass       |

## Spec-anchored acceptance criteria

“Preserve” is anchored to the `077bef1` observable assertions and approved
`docs/architecture-proposal.md`. Structural requirements use direct dependency,
path and byte comparisons. No criterion requires a newly invented product outcome.

| Criterion                                                                                                                      | Expected outcome                                                                                                                                                                 | Exact evidence and assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Result |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| ARCH-01: root tasks load relocated backend/config and retain task names                                                        | `run`, `validate`, `worker`, `test`, `lint` remain; CLI exits/summaries and local scheduling still work                                                                          | `deno.json:7`, `deno.json:8`, `deno.json:11` point to `backend/src`; `tests/support/local.ts:5` resolves `backend/`; `frontend/playwright.config.ts:5` resolves the same stack. `tests/integration/worker_test.ts:448`: `assert.equal(result.code, code, result.out + result.err)`; line 449 asserts the expected state; `tests/integration/schedule_test.ts:158`: `assert.equal(rows[0].state, 'succeeded')`.                                                                                                                                                                                                                                                                                                                                                                                                                                     | PASS   |
| ARCH-02: frontend retains routes, filters, marks, profiles, auth and queued collection; feature-local queries; no import cycle | Same URLs, exact persisted fields/order, owner login callback and durable queue behavior                                                                                         | `frontend/src/app/routes.tsx:11` retains dashboard/list/detail/search/run routes. `frontend/tests/interface.spec.ts:464`: `expect(p).toHaveURL('http://127.0.0.1:5174' + target)`; line 302 checks mark status after reload; line 312 checks the exact note; lines 814/847 use `expect(stored).toMatchObject({...})` for every search field; line 603 checks exact filtered titles; line 1001 checks queued state. `frontend/src/features/listings/listings.api.ts:9` owns list queries; `listings.queries.ts:1` owns query coordination. Independent import inspection: 31 modules, 54 local edges, zero cycles or backend imports; all Supabase operations are in feature APIs.                                                                                                                                                                  | PASS   |
| ARCH-03: separate use cases preserve partial results, deduplication, cancellation, fencing, scheduling and email failures      | Mixed sources yield partial with retained rows; fresh identities mail once; abort/lease behavior and scheduling order unchanged; mail failure does not fail committed collection | `tests/unit/worker_test.ts:66`: `assert.equal(r.state, 'partial')`; line 207 asserts exactly one email across two runs; line 222 asserts `{state: 'succeeded', email: 'failed'}`. `tests/integration/worker_test.ts:147` checks retained listing link; line 153 checks exact source outcomes. `tests/integration/database_test.ts:226` asserts expired-token save status 400 and line 227 zero saved rows; lines 697–701 reject stale writes and preserve all durable rows. `tests/unit/schedule_poll_test.ts:52`: `assert.deepEqual(events, ['schedule', 'claim'])`, including scheduler failure. `execute-run.ts:29` retains AbortController renewal/abort, lines 41–50 pass its signal to separate flows, and lines 72–74 clear/await renewal in finally. The extraction matches baseline cancellation semantics; no new timer test is claimed. | PASS   |
| ARCH-04: pure shared contracts and separate provider/diagnostic/HTTP/persistence/notification boundaries                       | Shared has no runtime dependency; application uses contracts/rules; composition wires concrete adapters; frontend has no backend dependency                                      | `shared/property.ts:1` defines contracts; `shared/money.ts:2` is pure conversion. `backend/src/property/ports.ts:21` defines Store and line 46 Provider; `runtime/dependencies.ts:9` wires concrete integrations; `application/execute-run.ts:8` imports the distinct flows. Independent checks reject external adapter imports from application, application/runtime imports from providers, runtime APIs/imports in shared, or backend imports in frontend. `tests/unit/worker_test.ts:180`: `assert.equal(p.price_cents, 120000000)`, lines 181–188 preserve parsed attributes, source and canonical link; line 200 asserts unknown attributes null. Final Deno/frontend typechecks pass.                                                                                                                                                       | PASS   |
| ARCH-05: assertions/migrations preserved, current docs and readable formatting                                                 | No assertion or test reduction; identical historical SQL/types; current paths/invariants documented; consistent formatting                                                       | Independent baseline/current comparison finds 238 Deno `assert.*` calls with identical method multiset and 152 browser matchers with identical method multiset; review of moved test diff finds fixture/import/path relocation, not weakened expected outcomes. Both migration SHA-256 values match exactly (below). `docs/architecture.md:31` maps concrete entrypoints; `docs/database.md:25` maps RPC invariants; `docs/property-interface.md:7` describes local/test origins and sequential disposable-data proofs. `deno.json:16` checks backend/shared/frontend/tests; independent formatter passes all 85 files.                                                                                                                                                                                                                            | PASS   |

**Spec-anchored result:** 5/5 criteria matched; zero spec-precision gaps.

## Edge cases

- Mixed/all-failed sources: `tests/unit/worker_test.ts:66`, `:75`, `:76` assert partial/failed states and zero saves when all fail.
- Claim failure: `tests/unit/worker_test.ts:91` rejects; `:106` asserts zero provider contacts.
- 404/410/removal versus transient verification failure: `tests/support/provider_boundary.ts:59` and `:63` assert removed versus active/unknown; `:67`/`:68` preserve history and marks.
- Missing attributes and centavo inclusivity: `tests/unit/worker_test.ts:200` asserts null; `:231` asserts boundary match.
- Expired fencing and scheduler failure: exact rejection/preservation/order assertions cited under ARCH-03.
- Loading/error/empty/missing listing states: `frontend/tests/interface.spec.ts:208`, `:224`, `:239`, `:242`, `:249` assert the rendered outcomes.
- Email failure: unit assertions plus `tests/integration/worker_test.ts:391`/`:392` preserve successful collection and failed email separately.

## Gates and test integrity

| Gate                                              | Observer                                                | Result                                                |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Build gate: `rtk deno task lint`                  | Independent verifier, final HEAD                        | PASS; 78 files                                        |
| Build gate: `rtk pnpm --dir frontend run build`   | Independent verifier, final HEAD                        | PASS; TypeScript and Vite, 141 modules                |
| `rtk deno task check`                             | Independent verifier, final HEAD                        | PASS; all three production entrypoints                |
| `rtk deno task fmt:check`                         | Independent verifier, final HEAD                        | PASS; 85 files                                        |
| Quick gate: `rtk deno test -A tests/unit/`        | Independent verifier, isolated clean copy of final HEAD | PASS; 15 passed, 0 failed, 0 skipped                  |
| Full Deno suite                                   | Author-observed, recorded in execution evidence         | 75 passed: 15 unit + 60 integration; 0 failed/skipped |
| Browser suite                                     | Author-observed after T6 CSS correction                 | 48 passed; 0 failed/skipped                           |
| Four desktop/mobile dashboard/listing screenshots | Author-observed after T6                                | SHA-256 byte-identical to pre-split baseline          |
| Test consumer typecheck following T7              | Author-observed                                         | PASS; unit/integration/CLI consumers                  |

The verifier did not rerun shared-data database/browser suites. The final T7 diff
only narrows types and annotates consumers; runtime logic/assertions are unchanged.
Database and browser proofs were sequential. Production `.env` was never copied
or loaded by this verification. Vite emits its existing >500kB chunk advisory;
the build succeeds and bundle optimization is outside this refactor.

Baseline and final suite counts remain 75 Deno and 48 browser tests. The Deno
source has 30 test declarations in both trees; loops/helpers expand those to the
runtime count. No skips, weakened assertions or deleted test cases were found.

Historical migration SHA-256 values, identical before/after:

- `20261117235107_property_interface.sql`:
  `d8984081e25494c37ca0df26479c2e48776e7070f75880d39d0308277bf3d129`
- `20261118223050_property_worker_schedule.sql`:
  `3dffb6361288eb928bdd78957297909a4a851d18de288fbaf13cfa73749bfce1`

Generated `shared/database.types.ts` and historical setup SQL are also
byte-identical to their baseline sources.

## Discrimination sensor

Depth: lightweight, three targeted behavior faults in the extracted flows.
Each test run used the Quick gate. Each failure was an outcome assertion,
not a typecheck, import or setup failure.

| Mutation                                                                 | Source                                                         | Expected detecting assertion                                          | Result                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| M1: mixed successful/failed sources return succeeded instead of partial  | `backend/src/property/application/execute-run.ts:51`           | `tests/unit/worker_test.ts:66`, expected partial, received succeeded  | KILLED; 14 passed / 1 failed; exit 1 |
| M2: consider every observation fresh instead of the store's fresh subset | `backend/src/property/application/collect-properties.ts:52`    | `tests/unit/worker_test.ts:207`, expected one email, received two     | KILLED; 14 passed / 1 failed; exit 1 |
| M3: failed mail delivery records sent                                    | `backend/src/property/application/notify-new-properties.ts:16` | `tests/unit/worker_test.ts:222`, expected email failed, received sent | KILLED; 14 passed / 1 failed; exit 1 |

**Isolation:** source/config/unit/fixture copies only under
`/private/tmp/architecture-sensor-v04rc_ca`; no Supabase config/data or `.env`
was copied. Clean copy first passed 15/15. Each mutation was restored in that
copy before the next. Scratch directory was deleted. Real-tree porcelain was
captured before sensor work and compared byte-for-byte after cleanup, before
writing this report: **identical**.

Preserved status entries were the two preexisting provider request-header edits,
deleted `frontend/package-lock.json`, untracked `frontend/pnpm-lock.yaml`, and
untracked `.specs/codebase/`, `.specs/project/`, `.specs/features/flight-search/`.
No stash, staging, commit, remote operation or real-tree source mutation occurred.

**Sensor result:** 3 injected, 3 killed, 0 survived. PASS.

## Code quality and scope

PASS: changes stay within the approved architecture/docs/dead-code scope; no new product behavior, framework, generic flight abstraction, injection framework or barrel layer. APIs own queries; shared modules are pure; application depends on contracts; runtime wires adapters; transactional SQL remains authoritative. Existing tests map to preserved behavior, extraction boundaries or test integrity. Guidance: user AGENTS.md RTK commands, approved architecture proposal/tasks and skill coding principles.

Existing browser assertions and author-observed baseline screenshots provide user-facing checks. No fresh human UAT is claimed. Both reviewed omissions were resolved before the final gates: T6 restores mobile CSS precedence, T7 separates command/run/result types.

## Ranked gaps and traceability

**Open gaps:** none. T6 restores the original mobile CSS cascade. T7 resolves
the initially observed command/run typing omission. Provider verification and
source-outcome strings preserve their existing boundary contract; no broader
state-model redesign is required for the approved separation.

| Requirement | Validation status |
| ----------- | ----------------- |
| ARCH-01     | Verified          |
| ARCH-02     | Verified          |
| ARCH-03     | Verified          |
| ARCH-04     | Verified          |
| ARCH-05     | Verified          |

The orchestrator can mark spec traceability verified when committing this report. Final validation has no failed gate, uncovered AC, surviving mutant, spec-precision gap or SPEC_DEVIATION; no new lesson is recorded.
