# Project handoff

Project decisions remain authoritative in [project/STATE.md](project/STATE.md).

## Handoff

**Feature**: listings-model

**Where**: COMPLETE for local delivery. Fresh-install database refactor and all backend/frontend consumers are implemented in `9f52c3e`; independently discovered failed-job finalization is fixed in `d398263`.

**Model**: Eight application tables: listings, listing_price_history, listing_marks, saved_searches, crawl_jobs, crawl_source_runs, private.worker_state and private.app_owner. UUID listing relationships, typed search criteria, immutable job snapshots, private fenced worker state and read-time security-invoker comparisons replace the legacy contract. Detail URLs retain their canonical-URL route format.

**Evidence**: Independent Deno 80/80, browser 48/48, backend type checking, frontend production build, lint, formatting, SQL lint and advisors pass. Four isolated behavior mutations are killed. Full claim-time snapshot immutability, post-takeover stale-owner rejection and exact worker RPC grants are independently verified. Report: `features/listings-model/validation.md`.

**In progress**: None.

**Next step**: Review `docs/database.md` and `docs/property-interface.md` before separate deployment work. The new baseline requires an empty application database; it is not an incremental upgrade of the old schema. Future deployed changes must use new migrations.

**Remote operations**: None. Only disposable local Supabase was reset and tested.

**Uncommitted**: Preexisting provider-header changes, hourly worker polling and heartbeat changes, related README/operation-guide/unit-test edits, frontend package-lock deletion and pnpm lockfile, and unrelated .specs/codebase, .specs/project and .specs/features/flight-search remain outside these commits.

**Branch**: main
