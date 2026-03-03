# Backend v2 (Electron + DuckDB) — Estado actual (actualizado)

## Objetivo

Backend local embebido en Electron que:

- Persiste el dominio en **DuckDB** (`data/backend-v2.duckdb`)
- Expone operaciones al renderer vía **IPC seguro** (validación de frame)
- Organiza el dominio por **módulos**
- Gestiona el esquema mediante **migraciones versionadas** (`src/electron/shared/db/migrations.ts`)
- Soporta flujo inicial: **crear proyecto** + **importar capas desde TXT**
- ✅ Soporta elipses:
  - **geometría** persistida (`Elipse`)
  - **valores** asociados a una elipse (`ElipseValor`)
- ✅ **Dynamic Fields** + `extrasJson` para extender entidades desde UI
- ✅ **Nuevo (v9)**: **Unidades** como **parámetros por proyecto** (settings por `(proyectoId, variableId)`), sin `unidadesId` en `Proyecto`/`Variable`

---

## Arquitectura

### Runtime

- `src/electron/main.ts`: crea `BrowserWindow`, carga UI y registra handlers.
- `src/electron/backend/ipc.ts`: registra handlers de módulos + bootstrap:
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
- `ipcMainHandleWithPayload(key, handler)` — con payload tipado (usa `Window["electron"]` como contrato)

---

## Dominio (modelo actual)

Archivo: `src/electron/backend/models.ts`

### Unidades (✅ actualizado v9)

**Objetivo**: que las unidades “rijan” el proyecto como parámetros configurables.

- Se elimina el patrón legacy:
  - `Proyecto.unidadesId` (✅ removido)
  - `Variable.unidadesId` y `Variable.unidad` (✅ removidos)
  - `Unidades` como 1:1 con proyecto (✅ removido)

- Nuevo patrón (v9):
  - `Unidades` pasa a representar **settings por proyecto + variable**:
    - `Unidades: { id, proyectoId, variableId, unidad, configJson, createdAt, updatedAt, extrasJson }`
  - `Variable` define la “variable conceptual” (ej: `FLOW_RATE_UNIT`) y pertenece a un `GrupoVariable`.
  - `GrupoVariable` agrega `scope` para clasificar variables por ámbito:
    - `PROYECTO | POZO | CAPA | ELIPSE | ESCENARIO`

> Consecuencia: para resolver unidades globales del proyecto, el renderer consulta `unidadesListByProyecto(proyectoId)` y construye un mapa `{ [variableId]: unidad }`.

### Escenarios / Valores de escenario (producción histórica)

- La “producción” se modela como **Escenario + ValorEscenario** (no como tabla `Produccion` en el dominio v2).
- `ValorEscenario` pertenece a un `Escenario` vía `escenarioId`.
- `ValorEscenario` se identifica de forma única por:
  - `(escenarioId, pozoId, capaId, fecha)`
- **Métricas NULLABLE** (según `TipoEscenario`):
  - `petroleo`, `agua`, `gas`, `inyeccionGas`, `inyeccionAgua` pueden ser `NULL`.

> Nota: la tabla legacy `Produccion` puede seguir existiendo en schema viejo, pero se considera **deuda técnica** y no es la fuente de verdad del dominio v2.

### Simulación / Set de estados

- `SetEstadoPozos` pertenece a `Simulacion` vía `simulacionId` (conceptualmente 1:1).
- Cualquier referencia legacy `Simulacion.setEstadoPozosId` se considera deuda.

### Elipses (✅ actualizado)

El dominio separa **geometría** de **valores**:

- **`Elipse`**: geometría (polígono sampleado) por `proyectoId` + `capaId`, con vínculos opcionales a pozos y con `simulacionId` (por ahora nullable para compat).
  - `id, proyectoId, simulacionId?, capaId, pozoInyectorId?, pozoProductorId?, x[], y[]`
- **`ElipseValor`**: valores **referenciando una elipse**:
  - `id, elipseId, elipseVariableId, valor, createdAt, updatedAt`

> Consecuencia: el renderer debe unir geometría (`Elipse`) + valores (`ElipseValor`) por `elipseId`.
>
> Nota importante: `ElipseValor` ya **no** depende de `simulacionId` (la simulación queda implícita por `Elipse.simulacionId`).

### Mapas (decisión A: 1 mapa por capa)

- `Mapa` referencia `GrupoVariable` vía `grupoVariableId`.
- `mapsGetByLayer` se consulta solo por `capaId`.
- Adapter legacy devuelve `variableMapaId = grupoVariableId`.

### Extensibilidad (✅ Dynamic Fields + extrasJson)

- Todas las tablas core incluyen una columna `extrasJson JSON` (default `{}`) para almacenar propiedades arbitrarias definidas desde UI.
- Existe una tabla `DynamicFieldDef` para registrar definiciones de campos dinámicos por entidad:
  - `(entity, key)` es única.
  - Define `dataType`, `label`, `unit`, `configJson`, timestamps.
- Este enfoque permite:
  - Agregar campos desde UI **sin migraciones**
  - Persistirlos en `extrasJson` por entidad
  - Postergar indexado/filtrado rápido para una iteración posterior (con `DynamicFieldValue`)

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

- `coreProyectoInitialize(payload: CreateProyectoBootstrapInput)` → `{ proyecto: Proyecto; unidades: Unidades }` _(legacy: ver nota v9)_
- `coreProyectoCreate(payload: CreateProyectoInput)` → `Proyecto`
- `coreProyectoList()` → `Proyecto[]`

- `coreUnidadesCreate(payload: CreateUnidadesInput)` → `Unidades` _(legacy: ver nota v9)_
- `coreUnidadesListByProject(payload: { proyectoId: string })` → `Unidades[]` _(legacy: ver nota v9)_

- `coreCapaCreate(payload: CreateCapaInput)` → `Capa`
- `coreCapaListByProject(payload: { proyectoId: string })` → `Capa[]`

- `corePozoCreate(payload: CreatePozoInput)` → `Pozo`
- `corePozoListByProject(payload: { proyectoId: string })` → `Pozo[]`

- `corePozoCapaCreate(payload: CreatePozoCapaInput)` → `PozoCapa`
- `corePozoCapaListByProject(payload: { proyectoId: string })` → `PozoCapa[]`

> **Nota v9 (importante):**
>
> - Los canales `coreUnidades*` fueron diseñados para el modelo legacy (Unidades 1:1 por proyecto).
> - Con v9, **Unidades** es settings por `(proyectoId, variableId)`.
> - Recomendación: migrar el módulo `core-data` a exponer `unidadesListByProyecto` / `unidadesUpsert` como fuente de verdad y tratar `coreUnidades*` como deuda técnica temporal, o directamente eliminarlo en el cleanup.

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

> Nota: si se requiere precisión 100% determinística, se recomienda evolucionar `TipoEscenario` con `configJson` o flags explícitos.

### Imports

- `importCapasDryRun(payload: CapaTxtImportPayload)` → `ImportJobResult`
- `importCapasCommit(payload: CapaTxtImportPayload)` → `ImportJobResult`

- `importMapsDryRun(payload: MapImportPayload)` → `ImportJobResult`
- `importMapsCommit(payload: MapImportPayload)` → `ImportJobResult`

> Nota: aún no existe un import oficial para `Elipse` (geometría). Se crea vía IPC `ellipseCreate` o se agregará un import dedicado (`importEllipses*`) en una iteración futura.

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

### Variables (✅ actualizado v9)

- `grupoVariableCreate(payload: CreateGrupoVariableInput)` → `GrupoVariable`
- `grupoVariableList()` → `GrupoVariable[]`

- `variableCreate(payload: CreateVariableInput)` → `Variable`
- `variableListByGrupoVariable(payload: { grupoVariableId: string })` → `Variable[]`
- `variableListByUnidades(payload: { unidadesId: string })` → `Variable[]` _(LEGACY: falla explícitamente; eliminar cuando el front migre)_

#### Unidades (settings por proyecto + variable) ✅ v9

- `unidadesListByProyecto(payload: { proyectoId: string })` → `Unidades[]`
- `unidadesUpsert(payload: { proyectoId, variableId, unidad, configJson?, extrasJson? })` → `{ id: string }`

### Ellipse (✅ actualizado)

#### Variables de elipse

- `ellipseVariableCreate(payload: CreateElipseVariableInput)` → `ElipseVariable`
- `ellipseVariableList()` → `ElipseVariable[]`

#### Geometría (tabla `Elipse`)

- `ellipseCreate(payload: CreateElipseInput)` → `Elipse`
- `ellipseListByLayer(payload: { simulacionId: string; capaId: string })` → `Elipse[]`
- `ellipseListByProject(payload: { proyectoId: string })` → `Elipse[]`

#### Valores (por elipse + variable)

- `ellipseValueCreate(payload: CreateElipseValorInput)` → `ElipseValor`  
  **Requiere** `elipseId`.
- `ellipseValueListBySimulacion(payload: { simulacionId: string })` → `ElipseValor[]`

#### Normalización

- `elipsesNormalizationAll(payload: ElipsesNormalizationAllPayload)` →  
  `{ ok: true; ranges } | { ok: false; error }`  
  Donde `ranges` devuelve min/max por `elipseVariableId` (se calcula con `JOIN ElipseValor ⨝ Elipse`).

### Dynamic Fields (✅ nuevo)

Módulo: `src/electron/modules/dynamic-fields`

- `dynamicFieldsListDefs(payload: { entity: DynamicEntity })`
  → `DynamicFieldsListDefsResponse`
- `dynamicFieldsCreateDef(payload: { entity, key, dataType, label?, unit?, configJson? })`
  → `DynamicFieldsCreateDefResponse`
- `dynamicFieldsUpdateEntityExtras(payload: { entity, entityId, patch, unsetKeys? })`
  → `DynamicFieldsUpdateEntityExtrasResponse`

Semántica:

- `DynamicFieldDef` es la definición (catálogo) por entidad.
- `extrasJson` en cada fila guarda los valores reales para esa entidad.

---

## Módulos y responsabilidades (resumen)

### Core Data (`src/electron/modules/core-data`)

CRUD base del dominio y bootstrap de proyecto.

> **Nota v9:** el módulo `core-data` todavía menciona `coreUnidades*` como si fuera 1:1 por proyecto.
> Se recomienda migrar ese módulo para que use el nuevo modelo de `Unidades` (settings) o declararlo legacy.

### Scenarios (`src/electron/modules/scenarios`)

CRUD de `TipoEscenario` y `Escenario`.

### Scenario Values (`src/electron/modules/scenario-values`)

Persistencia y consulta de `ValorEscenario` (valores por escenario). Incluye:

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
- elipses con geometría persistida (`Elipse`) + valores (`ElipseValor`)
- simulación sin `setEstadoPozosId` como fuente de verdad

### Variables (✅ actualizado v9)

- Variables definidas por `GrupoVariable` (scope incluido)
- Unidades como settings por proyecto + variable (`Unidades`)
- IPC: `unidadesListByProyecto` + `unidadesUpsert`

### Dynamic Fields (`src/electron/modules/dynamic-fields`) ✅

Extensión del esquema sin migraciones:

- `DynamicFieldDef` (definiciones)
- `extrasJson` (valores por entidad)

---

## Migraciones

Archivo: `src/electron/shared/db/migrations.ts`

- v1: esquema inicial (legacy)
- v2: import pipeline
- v3: índices hardening
- v4: refactor additive:
  - agrega columnas nuevas (`simulacionId`, `grupoVariableId`)
  - backfills determinísticos donde se puede
  - índices de soporte
- v5: **scenario precision**:
  - `TipoEscenario.nombre` único
  - `Escenario` único por `(proyectoId, nombre)`
  - reconstruye `ValorEscenario` para permitir métricas NULLABLE
  - agrega índices de consulta para `ValorEscenario`
- v6: **elipses geometry**:
  - crea tabla `Elipse`
  - agrega `ElipseValor.elipseId`
  - agrega índices para `Elipse` y `ElipseValor`
- v7: **elipses por simulación**:
  - `Elipse` agrega `simulacionId` + índices típicos
  - reconstruye `ElipseValor` para que dependa de `Elipse` y tenga `createdAt/updatedAt`
  - elimina dependencia de `simulacionId` en `ElipseValor`
- v8: **dynamic fields + extrasJson**:
  - agrega `extrasJson JSON DEFAULT '{}'` a tablas core
  - crea tabla `DynamicFieldDef` + índices
- ✅ v9: **unidades como settings por proyecto**:
  - agrega `GrupoVariable.scope`
  - refactor de `Unidades`:
    - `Unidades` legacy → `Unidades__legacy`
    - nueva `Unidades(proyectoId, variableId, unidad, configJson, extrasJson, timestamps)`
    - `UNIQUE(proyectoId, variableId)`
  - elimina columnas legacy:
    - `Proyecto.unidadesId`
    - `Variable.unidadesId`
    - `Variable.unidad`

---

## Smoke Test (E2E)

Flujo recomendado (renderer):

1. `backendInitSchema()`
2. `backendSeedInitialData()`
3. `coreProyectoInitialize(...)`
4. `importCapasDryRun({ proyectoId, content })`
5. `importCapasCommit({ proyectoId, content })`
6. `coreCapaListByProject({ proyectoId })`

Smoke adicional (variables + unidades v9):

7. `grupoVariableCreate(...)` (con `scope`)
8. `variableCreate(...)` (sin unidadesId/unidad)
9. `variableListByGrupoVariable({ grupoVariableId })`
10. `unidadesUpsert({ proyectoId, variableId, unidad })`
11. `unidadesListByProyecto({ proyectoId })` → map `{ [variableId]: unidad }`

Smoke adicional (escenarios):

12. `scenarioTypeCreate(...)` / `scenarioTypeList()`
13. `scenarioCreate(...)` / `scenarioListByProject({ proyectoId })`
14. `scenarioValueCreate(...)` (UPSERT) + `scenarioValueListByEscenario({ escenarioId })`

Smoke adicional (elipses):

15. `ellipseCreate(...)` (crear geometría)
16. `ellipseListByLayer({ simulacionId, capaId })`
17. `ellipseVariableCreate(...)` / `ellipseVariableList()`
18. `ellipseValueCreate(...)` (requiere `elipseId`)
19. `ellipseValueListBySimulacion({ simulacionId })`
20. `elipsesNormalizationAll(...)`

Smoke adicional (dynamic fields):

21. `dynamicFieldsCreateDef({ entity: "Pozo", key: "api", dataType: "number" })`
22. `dynamicFieldsListDefs({ entity: "Pozo" })`
23. `dynamicFieldsUpdateEntityExtras({ entity: "Pozo", entityId, patch: { api: 123 } })`

---

## Legacy / pendiente (deuda técnica controlada)

### Legacy aún presente por compat con schema v1

- Tabla/módulo `VariableMapa` (deprecado)
- Tabla legacy `Produccion` (deprecada; el dominio v2 usa `Escenario/ValorEscenario`)
- Columnas legacy (a remover en rebuild final):
  - `Simulacion.setEstadoPozosId`
  - `SetEstadoPozos.proyectoId` (si existió en schema inicial)
  - `Mapa.variableMapaId` (adapter legacy)

### Legacy nuevo (v9) — Unidades 1:1 por proyecto

- `Unidades__legacy` (preservada por migración v9 para inspección/rollback manual)
- Canales `coreUnidades*` y `coreProyectoInitialize` aún pueden asumir el modelo viejo (1:1).
  - Recomendación: migrarlos o eliminarlos en cleanup final.

### Cleanup final (futuro)

Migración de rebuild (v10+) para eliminar legacy + endurecer constraints:

- `UNIQUE(SetEstadoPozos.simulacionId)` (enforce 1:1)
- endurecer `Elipse.simulacionId NOT NULL` cuando se corte legacy
- drop `VariableMapa`
- drop `Produccion`
- drop columnas legacy restantes
- drop `Unidades__legacy` (cuando ya no se necesite)
- (opcional) evolución a `DynamicFieldValue` para indexado/búsqueda rápida
