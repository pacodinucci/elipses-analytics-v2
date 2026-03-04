# Backend v2 (Electron + DuckDB) - Estado actual

## Objetivo

Backend local embebido en Electron que:

- Persiste el dominio en DuckDB (`data/backend-v2.duckdb`)
- Expone operaciones al renderer por IPC seguro
- Organiza el dominio por modulos
- Gestiona esquema por migraciones versionadas (`src/electron/shared/db/migrations.ts`)

---

## Arquitectura

### Runtime

- `src/electron/main.ts`: crea `BrowserWindow`, carga UI y registra handlers.
- `src/electron/backend/ipc.ts`: registra handlers de modulos y bootstrap.

### Seguridad IPC

Archivo: `src/electron/util.ts`

- `validateEventFrame(frame)`:
  - Dev: permite `localhost:5123`
  - Prod: permite `file://<uiPath>`
  - Caso contrario: error

---

## Modelo de dominio actual

Archivo: `src/electron/backend/models.ts`

### Proyecto

`Proyecto` no tiene `unidadesId`.

### GrupoVariable / Variable

- `GrupoVariable` incluye:
  - `id, proyectoId, nombre, orden, scope, createdAt, updatedAt`
- `Variable` incluye:
  - `id, grupoVariableId, nombre, codigo, tipoDato, configJson, createdAt, updatedAt`

Scopes soportados:

- `PROYECTO | POZO | CAPA | ELIPSE | ESCENARIO | SIMULACION | UNIDADES | MAPA`

### Unidades

`Unidades` es tabla por proyecto:

- `id, proyectoId, unidad, configJson, createdAt, updatedAt`

No depende de `variableId`.

### Simulacion / SetEstadoPozos

- `Simulacion` mantiene `setEstadoPozosId` (legacy/transicional).
- `SetEstadoPozos` tiene `simulacionId` nullable (puede no estar asignado temporalmente).

### Mapa / VariableMapa

- `Mapa` (1:1 por capa) incluye:
  - `id, proyectoId, capaId, variableMapaId, grupoVariableId?, xedges, yedges, grid, createdAt, updatedAt`
- `variableMapaId` es la relacion formal del mapa.
- `grupoVariableId` se mantiene para compatibilidad.
- `VariableMapa` existe y se usa para catalogo de variables de mapa.

### Elipses

- `Elipse`: geometria por proyecto/capa y `simulacionId` nullable.
- `ElipseValor`: valores por `elipseId` + `elipseVariableId`.

---

## Bootstrap por proyecto

Al crear proyecto (`coreProyectoInitialize` / `coreProyectoCreate`):

1. Se crea `Proyecto`.
2. Se crean los `GrupoVariable` de ese proyecto (`proyectoId`).
3. Se crean `Variable` para cada grupo.
4. Para variables de scope `MAPA`, tambien se crean registros en `VariableMapa`.
5. Se asegura al menos una fila inicial en `Unidades`.

Implementacion principal:

- `src/electron/modules/core-data/application/coreDataService.ts`
- `src/electron/modules/variables/application/variablesService.ts`

---

## Canales IPC actuales

### Backend / bootstrap

- `backendGetTruthRegistry`
- `backendInitSchema`
- `backendSeedInitialData`
- `backendGetBootstrapStatus`

### Core data

- `coreProyectoInitialize`
- `coreProyectoCreate`
- `coreProyectoList`
- `coreCapaCreate`
- `coreCapaListByProject`
- `corePozoCreate`
- `corePozoListByProject`
- `corePozoCapaCreate`
- `corePozoCapaListByProject`

### Variables

- `grupoVariableCreate`
- `grupoVariableList` (acepta `{ proyectoId? }`)
- `variableCreate`
- `variableListByGrupoVariable`
- `unidadesListByProyecto`
- `unidadesUpsert`

Legacy que falla explicitamente:

- `variableListByUnidades`

### Maps

- `mapsGetByLayer`
- `mapsUpsert` (acepta `variableMapaId` o `grupoVariableId`; resuelve/asegura `VariableMapa`)
- `legacyVisualizerGetMap`

### Scenarios / simulations / values / well-states / ellipse / imports / dynamic-fields

Se mantienen activos en `src/electron/backend/ipc.ts` por sus respectivos modulos.

---

## Migraciones (estado)

Archivo: `src/electron/shared/db/migrations.ts`

- v1: baseline de dominio
- v2: import pipeline
- v3: indices de hardening
- v4: columnas/adaptaciones transicionales (`simulacionId`, `grupoVariableId`, etc.)
- v5: precision de escenarios
- v6: geometria de elipses
- v7: elipses por simulacion
- v8: `extrasJson` + `DynamicFieldDef`
- v9: noop (reservada)
- v10: grupos por proyecto + refactor de `Unidades`
- v11: noop (reservada)
- v12: restaura `VariableMapa` y normaliza `Mapa.variableMapaId`

---

## Deuda tecnica vigente

- `Simulacion.setEstadoPozosId` y `SetEstadoPozos.simulacionId` coexisten por compatibilidad.
- `Mapa` mantiene `grupoVariableId` ademas de `variableMapaId`.
- Modulo IPC de `variable-mapa` existe en codigo, pero no esta registrado en `backend/ipc.ts`.

