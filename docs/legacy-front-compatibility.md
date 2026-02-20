# Legacy front compatibility notes

This project will keep backward compatibility with the previous application hosted at:

- https://github.com/pacodinucci/elipses-analytics

## Goal

Allow the new backend (`elipses-analytics-v2`) to connect to the current front with minimum breakage, preserving the existing visualizer behavior as the core experience.


## Confirmed migration deltas

1. New backend scope is primarily driven by `Escenario`/`Simulacion` capabilities.
2. `Mapa` data source changes from JSON files (legacy) to database table persistence in v2.
3. Front payload compatibility remains required while internals evolve.

## Immediate alignment rules

1. Keep endpoint paths and payload shape compatible wherever possible.
2. Preserve key identifiers (`proyectoId`, `pozoId`, `capaId`, `escenarioId`) in API contracts.
3. Treat the visualizer-related endpoints as high-priority and avoid non-versioned breaking changes.
4. Preserve map payload parity while moving map reads from JSON files to DB-backed `Mapa` records.
5. Introduce new fields in a backward-compatible way (optional fields first, strict validation later).
6. If a breaking change is required, expose a compatibility adapter route or API version.

## Suggested next step

Create a contract matrix (`legacy endpoint` -> `v2 endpoint`) with:

- request shape diff,
- response shape diff,
- mapping strategy,
- migration risk,
- owner and due date.

This document is a reminder and source of truth for the integration direction until the full migration matrix is completed.
