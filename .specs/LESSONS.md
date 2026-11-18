# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
