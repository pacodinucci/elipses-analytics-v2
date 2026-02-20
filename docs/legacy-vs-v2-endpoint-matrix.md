# Legacy -> v2 endpoint matrix (starter)

Use this matrix to preserve frontend compatibility while backend internals evolve.

## Important sequencing note

This matrix is defined early, but implementation depends on Phase 0/Phase 1 backend bootstrap (schema, migrations, and core persistence APIs) before visualizer adapters are finalized.

| Priority | Legacy flow | Legacy endpoint | v2 endpoint | Request diff | Response diff | Compatibility strategy | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| P0 | Visualizer map load | TBD | TBD | TBD | TBD | Adapter + contract test | TBD | Pending |
| P0 | Visualizer overlays | TBD | TBD | TBD | TBD | Adapter + contract test | TBD | Pending |
| P0 | Production time-series | TBD | TBD | TBD | TBD | Backward-compatible response fields | TBD | Pending |
| P1 | Scenario value query | TBD | TBD | TBD | TBD | New v2 route + legacy alias | TBD | Pending |
| P1 | Simulation run/status | N/A (or legacy custom) | TBD | New | New | Introduce canonical v2 + optional compatibility facade | TBD | Pending |

## Completion criteria

- Every P0 row has an owner and mapped endpoints.
- Every non-identical response has an explicit adapter/mapping strategy.
- Every P0 row has a contract test case reference.
