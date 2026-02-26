# Backend v2 (Electron + DuckDB) — Estado actual (actualizado)

## Objetivo

Backend local embebido en Electron que:

- Persiste el dominio en **DuckDB** (`data/backend-v2.duckdb`)
- Expone operaciones al renderer vía **IPC seguro** (validación de frame)
- Organiza el dominio por **módulos**
- Gestiona el esquema mediante **migraciones versionadas** (`shared/db/migrations.ts`)
- Soporta flujo inicial: **crear proyecto** + **importar capas desde TXT**

---

## Arquitectura

### Runtime

- `src/electron/main.ts`: crea `BrowserWindow`, carga UI y registra handlers.
- `src/electron/backend/interface/ipc.ts`: registra handlers de módulos + bootstrap:
  - `backendGetTruthRegistry`
  - `backendInitSchema`
  - `backendSeedInitialData`
  - `backendGetBootstrapStatus`

### IPC y seguridad

Archivo: `src/electron/util.ts`

- `validateEventFrame(frame)`:
  - Dev: permite `localhost:5123`
  - Prod: permite `file://<uiPath>`
  - Si no coincide: `throw new Error("Malicious event")`

Helpers:

- `ipcMainHandle(key, handler)` — sin payload
- `ipcMainHandleWithPayload(key, handler)` — con payload tipado

---

## Dominio (modelo actual)

Archivo: `src/electron/backend/models.ts`

### Escenarios / Valores de escenario (producción histórica)

- La “producción” se modela como **Escenario + ValorEscenario** (no como tabla `Produccion` en el dominio v2).
- `ValorEscenario` pertenece a un `Escenario` vía `escenarioId`.
- `ValorEscenario` se identifica de forma única por:
  - `(escenarioId, pozoId, capaId, fecha)`
- **Métricas NULLABLE** (según `TipoEscenario`):
  - `petroleo`, `agua`, `gas`, `inyeccionGas`, `inyeccionAgua` pueden ser `NULL`.

> Nota: la tabla legacy `Produccion` puede seguir existiendo en schema viejo, pero se considera **deuda técnica** y no es la fuente de verdad del dominio v2.

### Simulación / Set de estados

- `Simulacion` **no** tiene `setEstadoPozosId` como fuente de verdad.
- `SetEstadoPozos` pertenece a `Simulacion` vía `simulacionId` (conceptualmente 1:1).

### Elipses

- `ElipseValor` pertenece a `Simulacion` vía `simulacionId`.

### Mapas (decisión A: 1 mapa por capa)

- `Mapa` referencia `GrupoVariable` vía `grupoVariableId`.
- `mapsGetByLayer` se consulta solo por `capaId`.
- Adapter legacy devuelve `variableMapaId = grupoVariableId`.

---

## Rutas IPC (canales) desarrolladas hasta ahora

> En este backend no hay HTTP routes; las “rutas” son **canales IPC** (renderer → main).
> Contrato tipado en `types.d.ts` (`Window.electron` + `EventPayloadMapping`).

### Backend / Bootstrap

- `backendGetTruthRegistry()` → `BackendTruthRegistry`
- `backendInitSchema()` → `BackendBootstrapStatus`
- `backendSeedInitialData()` → `BackendBootstrapStatus`
- `backendGetBootstrapStatus()` → `BackendBootstrapStatus`

### Core Data

- `coreProyectoInitialize(payload: CreateProyectoBootstrapInput)` → `{ proyecto: Proyecto; unidades: Unidades }`
- `coreProyectoCreate(payload: CreateProyectoInput)` → `Proyecto`
- `coreProyectoList()` → `Proyecto[]`

- `coreUnidadesCreate(payload: CreateUnidadesInput)` → `Unidades`
- `coreUnidadesListByProject(payload: { proyectoId: string })` → `Unidades[]`

- `coreCapaCreate(payload: CreateCapaInput)` → `Capa`
- `coreCapaListByProject(payload: { proyectoId: string })` → `Capa[]`

- `corePozoCreate(payload: CreatePozoInput)` → `Pozo`
- `corePozoListByProject(payload: { proyectoId: string })` → `Pozo[]`

- `corePozoCapaCreate(payload: CreatePozoCapaInput)` → `PozoCapa`
- `corePozoCapaListByProject(payload: { proyectoId: string })` → `PozoCapa[]`

### Scenarios (Tipos + Escenarios)

- `scenarioTypeCreate(payload: CreateTipoEscenarioInput)` → `TipoEscenario`
- `scenarioTypeList()` → `TipoEscenario[]`

- `scenarioCreate(payload: CreateEscenarioInput)` → `Escenario`
- `scenarioListByProject(payload: { proyectoId: string })` → `Escenario[]`

### Scenario Values (Valores del escenario)

- `scenarioValueCreate(payload: CreateValorEscenarioInput)` → `ValorEscenario`  
  **Semántica actual**: _UPSERT_ por llave compuesta `(escenarioId, pozoId, capaId, fecha)`:
  - si existe: actualiza métricas y `updatedAt`, preserva `createdAt`
  - si no existe: inserta nueva fila
- `scenarioValueListByEscenario(payload: { escenarioId: string })` → `ValorEscenario[]`

#### Validación por tipo (server-side)

Al crear/upsertear `ValorEscenario`, el service:

- resuelve `Escenario` y su `TipoEscenario`
- aplica validaciones por convención de `TipoEscenario.nombre`:
  - tipos “inyección” requieren al menos un valor en `inyeccionAgua`/`inyeccionGas`
  - tipos “producción/histórico” requieren al menos un valor en `petroleo`/`agua`/`gas`
  - en todos los casos, se exige **al menos una métrica no-null**

> Nota: si se requiere precisión 100% determinística, se recomienda evolucionar `TipoEscenario` con `configJson` o flags explícitos (v6+).

### Imports

- `importCapasDryRun(payload: CapaTxtImportPayload)` → `ImportJobResult`
- `importCapasCommit(payload: CapaTxtImportPayload)` → `ImportJobResult`

- `importMapsDryRun(payload: MapImportPayload)` → `ImportJobResult`
- `importMapsCommit(payload: MapImportPayload)` → `ImportJobResult`

### Maps

- `mapsGetByLayer(params: { capaId: string })` → `Mapa | null`
- `mapsUpsert(payload: UpsertMapInput)` → `Mapa`

- `legacyVisualizerGetMap(params: { capaId: string })` → `LegacyVisualizerMapResponse | null`

### Simulations

- `simulationTypeCreate(payload: CreateTipoSimulacionInput)` → `TipoSimulacion`
- `simulationTypeList()` → `TipoSimulacion[]`
- `simulationCreate(payload: CreateSimulacionInput)` → `Simulacion`
- `simulationListByProject(payload: { proyectoId: string })` → `Simulacion[]`

### Well States

- `wellStateTypeCreate(payload: CreateTipoEstadoPozoInput)` → `TipoEstadoPozo`
- `wellStateTypeList()` → `TipoEstadoPozo[]`

- `wellStateSetCreate(payload: CreateSetEstadoPozosInput)` → `SetEstadoPozos`
- `wellStateSetListByProject(payload: { proyectoId: string })` → `SetEstadoPozos[]`  
  _(compat: deriva por JOIN SetEstadoPozos → Simulacion → Proyecto)_

- `wellStateSetDetailCreate(payload: CreateSetEstadoPozosDetalleInput)` → `SetEstadoPozosDetalle`
- `wellStateSetDetailList(payload: { setEstadoPozosId: string })` → `SetEstadoPozosDetalle[]`

### Variables

- `grupoVariableCreate(payload: CreateGrupoVariableInput)` → `GrupoVariable`
- `grupoVariableList()` → `GrupoVariable[]`

- `variableCreate(payload: CreateVariableInput)` → `Variable`
- `variableListByUnidades(payload: { unidadesId: string })` → `Variable[]`

### Ellipse

- `ellipseVariableCreate(payload: CreateElipseVariableInput)` → `ElipseVariable`
- `ellipseVariableList()` → `ElipseVariable[]`

- `ellipseValueCreate(payload: CreateElipseValorInput)` → `ElipseValor`
- `ellipseValueListBySimulacion(payload: { simulacionId: string })` → `ElipseValor[]`

---

## Módulos y responsabilidades (resumen)

### Core Data (`src/electron/modules/core-data`)

CRUD base del dominio y bootstrap de proyecto.

### Scenarios (`src/electron/modules/scenarios`)

CRUD de `TipoEscenario` y `Escenario`.

### Scenario Values (`src/electron/modules/scenario-values`)

Persistencia y consulta de `ValorEscenario` (valores por escenario).  
Incluye:

- UPSERT por llave compuesta
- soporte de métricas nullable
- validación por tipo (server-side)

### Imports (`src/electron/modules/imports`)

Import TXT de capas + import de mapas desde filas.  
Persistencia de jobs en `import_jobs` / `import_job_errors`.

### Maps (`src/electron/modules/maps`)

Mapa 1:1 por capa, con `grupoVariableId` (+ adapter legacy).

### Simulations / Well States / Ellipse

Dominio migrado a:

- set estados por simulación
- elipses por simulación
- simulación sin `setEstadoPozosId` como fuente de verdad

---

## Migraciones

Archivo: `src/electron/shared/db/migrations.ts`

- v1: esquema inicial (legacy)
- v2: import pipeline
- v3: índices hardening
- v4: refactor additive:
  - agrega columnas nuevas (`simulacionId`, `grupoVariableId`)
  - backfills determinísticos
  - índices de soporte
- v5: **scenario precision**:
  - `TipoEscenario.nombre` único
  - `Escenario` único por `(proyectoId, nombre)`
  - reconstruye `ValorEscenario` para permitir métricas NULLABLE
  - agrega índices de consulta para `ValorEscenario`

---

## Smoke Test (E2E)

Flujo recomendado (renderer):

1. `backendInitSchema()`
2. `backendSeedInitialData()`
3. `coreProyectoInitialize(...)`
4. `importCapasDryRun({ proyectoId, content })`
5. `importCapasCommit({ proyectoId, content })`
6. `coreCapaListByProject({ proyectoId })`

Smoke adicional (escenarios):

7. `scenarioTypeCreate(...)` / `scenarioTypeList()`
8. `scenarioCreate(...)` / `scenarioListByProject({ proyectoId })`
9. `scenarioValueCreate(...)` (UPSERT) + `scenarioValueListByEscenario({ escenarioId })`

---

## Legacy / pendiente (deuda técnica controlada)

### Legacy aún presente por compat con schema v1

- Tabla/módulo `VariableMapa` (deprecado)
- Tabla legacy `Produccion` (deprecada; el dominio v2 usa `Escenario/ValorEscenario`)
- Columnas legacy:
  - `Simulacion.setEstadoPozosId`
  - `SetEstadoPozos.proyectoId`
  - `ElipseValor.proyectoId`
  - `Mapa.variableMapaId`

### Cleanup final (futuro)

Migración de rebuild (v6) para eliminar legacy + enforce real:

- `UNIQUE(SetEstadoPozos.simulacionId)` (enforce 1:1)
- drop `VariableMapa`
- drop `Produccion`
- drop columnas legacy
