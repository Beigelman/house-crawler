# Execution evidence

Baseline implementation: `077bef1`. Existing local provider header changes and
package-lock → pnpm-lock changes are excluded from architecture commits.
The approved proposal is `docs/architecture-proposal.md`.

## Baseline and per-task gates

Baseline lint and frontend build passed. Initial Deno run had 72 passes and three
browser failures because 5173 was occupied. The test server now uses 5174, and
local Auth allows both development/test origins. No active developer server was
terminated. The local Supabase stack was restarted with persisted volumes to
reload this test-only callback configuration.

T1, T2, T3 and T4 each passed 75 Deno tests, 48 browser tests, lint and frontend
build before their separate local commits. T5 preserves the assertions while
separating 15 unit tests from 60 integration tests; unit tests now run without a
Supabase connection. Generated database types were moved without hand editing.

## Coverage and adequacy

| Requirement | Assertion / verification evidence                                                                                                                                                                                                                       | Required outcome                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ARCH-01     | `tests/integration/worker_test.ts:448`: `assert.equal(result.code, code, result.out + result.err)`; `tests/integration/schedule_test.ts:158`: `assert.equal(rows[0].state, 'succeeded')`                                                                | Root task entrypoints and scheduled worker retain CLI outcomes and durable success                                                    |
| ARCH-02     | `frontend/tests/interface.spec.ts:464`: magic-link `toHaveURL`; original browser suite unchanged except local test origin / helper paths                                                                                                                | Auth, routes, filters, notes, profile fields, runs and responsive controls retain original behavior                                   |
| ARCH-03     | `tests/integration/worker_test.ts:142`: `assert.equal(r.state, 'partial')`; `tests/integration/worker_test.ts:392`: `assert.equal(run.email_state, 'failed')`; `tests/unit/schedule_poll_test.ts:52`: `assert.deepEqual(events, ['schedule', 'claim'])` | Partial source retention, separate email status and scheduler-before-claim ordering                                                   |
| ARCH-04     | `tests/unit/worker_test.ts:180`: `assert.equal(p.price_cents, 120000000)`; typecheck; dependency search                                                                                                                                                 | Providers still parse observed prices; frontend never imports backend; providers never import application; shared modules remain pure |
| ARCH-05     | SHA-256 equality for both original migration files; before/after assertion method counts; formatter and diff whitespace check                                                                                                                           | Migration bytes unchanged; no tests or assertions removed; docs match actual paths                                                    |

Reverse mapping: all existing assertions remain claimed by the approved
behavior-preserving refactor (ARCH-01–03), parsing/domain boundary (ARCH-04), and
test-integrity criterion (ARCH-05). No speculative new tests were added. Existing
state/payload assertions, rather than only callback counts, cover the integration
boundary. New structural layout and docs use direct file/dependency/hash inspection.

Test-integrity inspection compared `077bef1` with the final test tree: all 238
`assert.*` expressions and all 152 Playwright matcher expressions remain present
by method count. The browser test count remains 48; Deno count remains 75.

## Scope

No remote writes, deployment, schema changes or migration-history rewriting.
Historical setup SQL is explicitly labeled as obsolete, outside executable
source. Root Deno task names and the root worker environment remain stable.
Independent feature-level validation is recorded in `validation.md`.
