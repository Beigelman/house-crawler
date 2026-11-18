# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Prove persisted membership updates through the production store, including an observation that stops matching.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `properties` · harmful: 0
- features: property-interface
- evidence: verification.md:C31 (properties)
- last seen: 2026-11-18T00:25:00Z

### L-002 - Exercise duplicate identities across differently matching profiles before asserting run-wide notification deduplication.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `properties` · harmful: 0
- features: property-interface
- evidence: verification.md:C63 (properties)
- last seen: 2026-11-18T00:25:00Z

### L-003 - Apply length limits to the persisted representation, including leading and trailing padding.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `properties` · harmful: 0
- features: property-interface
- evidence: verification.round2.md:C28 (properties)
- last seen: 2026-11-18T01:05:24Z

### L-004 - Prove authorization denial against populated records and valid mutation requests so another guard cannot mask missing access control.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `authorization` · harmful: 0
- features: property-interface
- evidence: verification.round1.md:C3 (authorization)
- last seen: 2026-11-18T01:13:28Z

### L-005 - Scan every emitted build asset for harmless server-secret values supplied to the build, rather than checking variable names alone.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `frontend` · harmful: 0
- features: property-interface
- evidence: verification.round1.md:C4 (frontend)
- last seen: 2026-11-18T01:13:28Z

### L-006 - Exercise migrations from the actual legacy schema and compare the entire preserved projection after repeated application.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `database` · harmful: 0
- features: property-interface
- evidence: verification.round1.md:C5 (database)
- last seen: 2026-11-18T01:13:28Z

### L-007 - Assert every saved configuration field after reload; visible form controls do not prove persisted values.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `frontend` · harmful: 0
- features: property-interface
- evidence: verification.round1.md:C27 (frontend)
- last seen: 2026-11-18T01:13:28Z

### L-008 - Test scheduled profile selection with at least two enabled searches and one disabled search, asserting every persisted profile UUID.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: worker-schedule
- evidence: .specs/features/worker-schedule/validation.md: historical LIMIT 1 mutant (worker)
- last seen: 2026-11-18T22:53:38Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
