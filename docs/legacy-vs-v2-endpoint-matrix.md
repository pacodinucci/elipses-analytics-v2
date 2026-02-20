# Legacy -> v2 endpoint matrix

Use this matrix to preserve frontend compatibility while backend internals evolve.

## Implemented compatibility adapters (current)

| Priority | Legacy flow | Legacy endpoint/channel | v2 endpoint/channel | Request diff | Response diff | Compatibility strategy | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| P0 | Visualizer map load | `legacyVisualizerGetMap({ capaId, variableMapaId? })` | `mapsGetByLayer({ capaId, variableMapaId? })` | Same fields | Legacy strips extra v2 fields (`id`, `proyectoId`, timestamps) and preserves `xedges`, `yedges`, `grid` | Legacy adapter in IPC layer (`legacyAdapter.ts`) | backend | Implemented |

## Pending compatibility rows

| Priority | Legacy flow | Legacy endpoint/channel | v2 endpoint/channel | Request diff | Response diff | Compatibility strategy | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| P0 | Visualizer overlays | TBD | TBD | TBD | TBD | Adapter + contract test | backend | Pending |
| P0 | Production time-series | TBD | TBD | TBD | TBD | Backward-compatible response fields | backend | Pending |
| P1 | Scenario value query | TBD | scenario module handlers | TBD | TBD | New v2 route + legacy alias | backend | Pending |
| P1 | Simulation run/status | TBD | simulation module handlers | New | New | Canonical v2 + optional compatibility facade | backend | Pending |

## Completion criteria

- Every P0 row has a concrete legacy channel and mapped v2 channel.
- Every non-identical response has explicit adapter strategy.
- Every P0 row has contract test coverage.
