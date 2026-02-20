# Backend v2 architecture proposal

## Objective

Define a backend architecture that:

1. Keeps compatibility with the legacy frontend (`https://github.com/pacodinucci/elipses-analytics`) during migration.
2. Preserves visualizer flows as first-class use cases.
3. Supports incremental expansion of the data model without "patch" growth.
4. Explicitly includes the new `Simulacion`/`Escenario` domain and DB-backed `Mapa` persistence (replacing legacy JSON map reads).

---


## Confirmed migration context

- Coverage tracking matrix (diagram table -> module/IPC): `docs/domain-coverage-matrix.md`.
- Main functional change driver: add robust `Simulacion` + `Escenario` flows as first-class backend capabilities.
- Main persistence change driver: move maps from legacy JSON file reads to relational storage in `Mapa`.
- Constraint: keep frontend (especially visualizer) behavior compatible during transition.

---
## Architectural principles

1. **Domain-first contracts**
   - The ER/class diagram is the source of truth for entities and relationships.
   - API contracts are derived from use cases, not from raw table exposure.

2. **Backward-compatible evolution**
   - Prefer additive changes (new optional fields, new endpoints) before breaking changes.
   - Any breaking contract must be versioned (`/api/v2`) or wrapped with compatibility adapters.

3. **Vertical slices over technical silos**
   - Organize by business capability (projects, wells, scenarios, simulation, maps, imports) with internal layers.

4. **Importability and traceability by design**
   - Bulk import is a core capability, not a side utility.
   - Every import execution must be auditable.

---

## Suggested module structure

```text
src/
  modules/
    projects/
    units/
    variables/
    wells/
    layers/
    scenarios/
    well-states/
    simulations/
    production/
    maps/
    ellipse-values/
    imports/
  shared/
    db/
    http/
    validation/
    errors/
    auth/
    observability/
```

Each module should include:

- `domain/` entities, value objects, invariants.
- `application/` use cases (commands/queries).
- `infrastructure/` repositories, ORM mappings, external integrations.
- `interfaces/http/` controllers, DTOs, route definitions.

---

## API strategy for legacy front compatibility

1. **Compatibility layer (short-term)**
   - Keep legacy endpoint shapes where feasible.
   - Add endpoint adapters when backend internals change but front remains unchanged.

2. **Canonical v2 contracts (mid-term)**
   - Define clean v2 DTOs by module.
   - Document mapping from legacy responses to v2 responses.

3. **Deprecation policy (long-term)**
   - Mark legacy-compatible routes as deprecated once front is migrated.
   - Remove only after agreed deprecation window.

---

## Data and persistence guidelines

1. **Migrations as the only schema change path**.
2. **FK and uniqueness constraints must reflect domain rules** (example: one `Mapa` per `Capa`).
3. **Idempotent import writes** where domain allows natural keys.
4. **Read-optimized queries for visualizer** (materialized views or precomputed projections if needed).

---

## Import pipeline architecture

### Current implementation status (v2 bootstrap)

- Implemented first import vertical for `Mapa` with two backend operations:
  - `importMapsDryRun(payload)`
  - `importMapsCommit(payload)`
- Both operations persist import jobs and row-level errors in DB tables (`import_jobs`, `import_job_errors`).
- This provides traceability and a safe dry-run path before write execution.

For high-volume entities (`Produccion`, `ValorEscenario`, `Mapa`):

1. Upload file (CSV/XLSX/JSON).
2. Parse + structural validation.
3. Domain validation (foreign keys, ranges, uniqueness, dates).
4. Dry-run preview (no persistence).
5. Commit execution.
6. Result report (inserted, updated, rejected rows with reasons).

Recommended persistence support:

- `import_jobs`
- `import_job_rows` (optional, for deep diagnostics)
- `import_job_errors`

---

## Visualizer-first requirements

Because visualizer is the app core, prioritize:

1. Low-latency read endpoints for maps/ellipses/scenarios/production series.
2. Stable payload schemas for map grids (`xedges`, `yedges`, `grid`) and overlays.
3. Query filters that match current front behavior (project, well, layer, date range, scenario).
4. Contract tests to prevent accidental schema drift.

---

## Delivery roadmap (recommended, adjusted for backend-first bootstrap)

### Phase 0 — Backend bootstrap (must happen first)
- Implement DB baseline: migrations, constraints and seed strategy for core entities.
- Set module skeleton, repository abstraction and shared error handling.
- Freeze entity contracts and DTO naming rules.
- Create OpenAPI baseline for existing and planned routes.

### Phase 1 — Core master data APIs
- `Proyecto`, `Pozo`, `Capa`, `PozoCapa`, `Unidades`, `Variable`.
- CRUD/read endpoints with persistence fully backed by DB.
- Legacy compatibility endpoints for current front reads.

### Phase 2 — Time-series and scenarios
- `Produccion`, `Escenario`, `ValorEscenario`, `SetEstadoPozos`.
- Include `Simulacion` orchestration contracts early (create/run/status/read).
- Import pipeline v1 for production and scenario values.

### Phase 3 — Simulation and visualizer optimization
- Complete `Simulacion` execution/read APIs and map projections.
- Migrate map reads from JSON-source assumptions to DB-backed `Mapa` queries.
- Caching strategy and contract tests for visualizer payloads.

### Phase 4 — Migration closure
- Front migration to canonical v2 routes.
- Deprecation of compatibility adapters.

---

## Definition of done per module

A module is done only when it has:

1. DB migration + constraints.
2. Domain validation.
3. API endpoints + OpenAPI docs.
4. Unit tests for use cases.
5. Integration tests for critical read/write flows.
6. (If applicable) import support + error reporting.
7. Legacy compatibility mapping documented.

---

## Immediate next action

1. Execute Phase 0 first (schema + module bootstrap).
2. Then complete Phase 1 core APIs on top of persisted DB models.
3. In parallel with Phase 1, fill the `legacy -> v2 endpoint matrix` for visualizer-critical routes to avoid late compatibility surprises.
