# Legacy to v2 migration scope (confirmed)

This document records the migration context confirmed by product to avoid ambiguity while implementing backend v2.

## Confirmed reasons for rebuilding backend

1. Add and formalize `Simulacion` and `Escenario` flows in a clean model.
2. Keep previously working capabilities from the legacy app.
3. Move map persistence from file-based JSON reads to relational database storage.

## Scope baseline

- Legacy repository reference: `https://github.com/pacodinucci/elipses-analytics`
- Frontend compatibility remains mandatory during migration.
- Visualizer behavior is still the critical acceptance criterion.

## Key deltas vs legacy

### Delta A — Simulation/scenario domain becomes first-class

The new backend must treat these entities as core domain modules:

- `TipoEscenario`
- `Escenario`
- `ValorEscenario`
- `TipoSimulacion`
- `Simulacion`
- `SetEstadoPozos` and `SetEstadoPozosDetalle`

Implementation implication:

- Do not expose these as ad-hoc tables only; provide explicit use cases and APIs for create/run/query.

### Delta B — Maps move from JSON files to DB table

Legacy behavior read maps from JSON artifacts; v2 persists them in `Mapa` records.

Implementation implication:

- Visualizer contracts must stay stable even if backend source changes.
- Add mapping/adapters so response shape expected by front remains compatible (`xedges`, `yedges`, `grid`).

## Immediate implementation order

1. Build the visualizer endpoint compatibility matrix first (legacy -> v2).
2. Implement read paths for DB-backed maps with payload parity checks.
3. Implement scenario/simulation APIs with contract tests.
4. Add import flow for map/scenario/simulation-related data.

## Non-goals (for now)

- Frontend redesign.
- Breaking renames in endpoint payloads without versioning/adapter.
