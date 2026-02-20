# Domain coverage matrix (diagram table -> module/IPC)

This matrix tracks implementation coverage from the Mermaid domain truth to backend modules and IPC channels.

Legend:
- **Done**: table has DB schema + module service/repository + IPC channel(s) usable from renderer.
- **Partial**: table has DB schema but still lacks full module and/or IPC coverage.
- **Missing**: table not implemented in DB schema (currently none from the Mermaid diagram).

| Table (Mermaid) | In DB schema (migration v1) | Module | IPC channels | Coverage |
|---|---|---|---|---|
| `Proyecto` | Yes | `core-data` | `coreProyectoCreate`, `coreProyectoList` | Done |
| `Unidades` | Yes | `core-data` | `coreUnidadesCreate`, `coreUnidadesListByProject` | Done |
| `GrupoVariable` | Yes | - | - | Partial |
| `Variable` | Yes | - | - | Partial |
| `Capa` | Yes | `core-data` | `coreCapaCreate`, `coreCapaListByProject` | Done |
| `Pozo` | Yes | `core-data` | `corePozoCreate`, `corePozoListByProject` | Done |
| `PozoCapa` | Yes | `core-data` | `corePozoCapaCreate`, `corePozoCapaListByProject` | Done |
| `TipoSimulacion` | Yes | `simulations` | `simulationTypeCreate`, `simulationTypeList` | Done |
| `TipoEstadoPozo` | Yes | - | - | Partial |
| `SetEstadoPozos` | Yes | - | - | Partial |
| `SetEstadoPozosDetalle` | Yes | - | - | Partial |
| `TipoEscenario` | Yes | `scenarios` | `scenarioTypeCreate`, `scenarioTypeList` | Done |
| `Escenario` | Yes | `scenarios` | `scenarioCreate`, `scenarioListByProject` | Done |
| `ValorEscenario` | Yes | - | - | Partial |
| `ElipseVariable` | Yes | - | - | Partial |
| `ElipseValor` | Yes | - | - | Partial |
| `Simulacion` | Yes | `simulations` | `simulationCreate`, `simulationListByProject` | Done |
| `Produccion` | Yes | `production` | `productionCreate`, `productionListByProject` | Done |
| `VariableMapa` | Yes | `maps` (implicit FK support) | - | Partial |
| `Mapa` | Yes | `maps` | `mapsGetByLayer`, `mapsUpsert`, `legacyVisualizerGetMap` | Done |

## Notes

- Import pipeline (`imports`) currently covers map imports (`importMapsDryRun`, `importMapsCommit`) and tracks execution in `import_jobs` / `import_job_errors` (supporting tables, not part of the Mermaid domain list).
- The next high-value coverage gaps are `ValorEscenario` and state-set entities (`SetEstadoPozos`, `SetEstadoPozosDetalle`, `TipoEstadoPozo`).
