// src/electron/shared/db/migrations.ts
export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/**
 * ✅ v1 (nuevo baseline):
 * - Proyecto: SIN unidadesId
 * - GrupoVariable: incluye proyectoId + scope desde el inicio
 * - Variable: SIN unidadesId y SIN unidad
 * - Unidades: entidad por proyecto (sin variableId)
 *
 * IMPORTANTE:
 * - Proyecto.areal* + arealCRS + grillaCellSize* nacen NULLABLE en el baseline.
 * - Esto evita migraciones destructivas sobre Proyecto (DuckDB no deja ALTER/DROP con deps).
 */
const initialSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS Proyecto (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    alias VARCHAR NOT NULL,
    limitesTemporalDesde DATE NOT NULL,
    limitesTemporalHasta DATE NOT NULL,

    arealMinX DOUBLE,
    arealMinY DOUBLE,
    arealMaxX DOUBLE,
    arealMaxY DOUBLE,
    arealCRS VARCHAR,

    grillaNx INTEGER NOT NULL,
    grillaNy INTEGER NOT NULL,
    grillaCellSizeX DOUBLE,
    grillaCellSizeY DOUBLE,
    grillaUnidad VARCHAR NOT NULL,

    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS GrupoVariable (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    orden INTEGER NOT NULL,
    scope VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Variable (
    id VARCHAR PRIMARY KEY,
    grupoVariableId VARCHAR NOT NULL REFERENCES GrupoVariable(id),
    nombre VARCHAR NOT NULL,
    codigo VARCHAR NOT NULL,
    tipoDato VARCHAR NOT NULL,
    configJson JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  /**
   * ✅ Unidades: entidad de catálogo por proyecto.
   */
  `CREATE TABLE IF NOT EXISTS Unidades (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    unidad VARCHAR NOT NULL,
    configJson JSON NOT NULL DEFAULT '{}',
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Capa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Pozo (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    x DOUBLE NOT NULL,
    y DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS PozoCapa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    tope DOUBLE NOT NULL,
    base DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS TipoSimulacion (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS TipoEstadoPozo (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS SetEstadoPozos (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS SetEstadoPozosDetalle (
    id VARCHAR PRIMARY KEY,
    setEstadoPozosId VARCHAR NOT NULL REFERENCES SetEstadoPozos(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    tipoEstadoPozoId VARCHAR NOT NULL REFERENCES TipoEstadoPozo(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS TipoEscenario (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Escenario (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    tipoEscenarioId VARCHAR NOT NULL REFERENCES TipoEscenario(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS ValorEscenario (
    id VARCHAR PRIMARY KEY,
    escenarioId VARCHAR NOT NULL REFERENCES Escenario(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    fecha DATE NOT NULL,
    petroleo DOUBLE NOT NULL,
    agua DOUBLE NOT NULL,
    gas DOUBLE NOT NULL,
    inyeccionGas DOUBLE NOT NULL,
    inyeccionAgua DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS ElipseVariable (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  /**
   * ⚠️ ElipseValor legacy (se refactoriza luego a ElipseValor v7 real)
   * lo mantenemos como venías.
   */
  `CREATE TABLE IF NOT EXISTS ElipseValor (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    elipseVariableId VARCHAR NOT NULL REFERENCES ElipseVariable(id),
    valor DOUBLE NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Simulacion (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    tipoSimulacionId VARCHAR NOT NULL REFERENCES TipoSimulacion(id),
    escenarioSimulacionId VARCHAR NOT NULL REFERENCES Escenario(id),
    setEstadoPozosId VARCHAR NOT NULL REFERENCES SetEstadoPozos(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,

  /**
   * Legacy Produccion
   */
  `CREATE TABLE IF NOT EXISTS Produccion (
    id BIGINT PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    fecha DATE NOT NULL,
    petroleo DOUBLE NOT NULL,
    agua DOUBLE NOT NULL,
    gas DOUBLE NOT NULL,
    agua_iny DOUBLE NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS VariableMapa (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS Mapa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    capaId VARCHAR NOT NULL UNIQUE REFERENCES Capa(id),
    variableMapaId VARCHAR NOT NULL REFERENCES VariableMapa(id),
    grupoVariableId VARCHAR,
    xedges JSON NOT NULL,
    yedges JSON NOT NULL,
    grid JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
];

const relationalHardeningStatements = [
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_pozocapa_project_pozo_capa ON PozoCapa(proyectoId, pozoId, capaId)`,

  `CREATE UNIQUE INDEX IF NOT EXISTS ux_produccion_project_pozo_capa_fecha ON Produccion(proyectoId, pozoId, capaId, fecha)`,

  `CREATE UNIQUE INDEX IF NOT EXISTS ux_valorescenario_escenario_pozo_capa_fecha ON ValorEscenario(escenarioId, pozoId, capaId, fecha)`,

  `CREATE UNIQUE INDEX IF NOT EXISTS ux_setestadopozosdetalle_set_pozo ON SetEstadoPozosDetalle(setEstadoPozosId, pozoId)`,
];

const importPipelineStatements = [
  `CREATE TABLE IF NOT EXISTS import_jobs (
    id VARCHAR PRIMARY KEY,
    entity VARCHAR NOT NULL,
    mode VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    finishedAt TIMESTAMP,
    summaryJson JSON NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS import_job_errors (
    id VARCHAR PRIMARY KEY,
    jobId VARCHAR NOT NULL REFERENCES import_jobs(id),
    rowNumber INTEGER NOT NULL,
    field VARCHAR,
    severity VARCHAR NOT NULL,
    message VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL
  )`,
];

const domainRefactorV4Statements = [
  `ALTER TABLE SetEstadoPozos ADD COLUMN IF NOT EXISTS simulacionId VARCHAR`,
  `ALTER TABLE ElipseValor ADD COLUMN IF NOT EXISTS simulacionId VARCHAR`,
  `ALTER TABLE Mapa ADD COLUMN IF NOT EXISTS grupoVariableId VARCHAR`,

  `UPDATE SetEstadoPozos s
   SET simulacionId = sim.id
   FROM Simulacion sim
   WHERE sim.setEstadoPozosId = s.id`,

  `UPDATE Mapa
   SET grupoVariableId = variableMapaId
   WHERE grupoVariableId IS NULL`,

  `CREATE INDEX IF NOT EXISTS ix_setestadopozos_simulacionId ON SetEstadoPozos(simulacionId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_simulacionId ON ElipseValor(simulacionId)`,
  `CREATE INDEX IF NOT EXISTS ix_mapa_grupoVariableId ON Mapa(grupoVariableId)`,
];

const scenarioPrecisionV5Statements = [
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_tipoescenario_nombre ON TipoEscenario(nombre)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_escenario_proyecto_nombre ON Escenario(proyectoId, nombre)`,

  `CREATE TABLE IF NOT EXISTS ValorEscenario__v2 (
    id VARCHAR PRIMARY KEY,
    escenarioId VARCHAR NOT NULL REFERENCES Escenario(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    fecha DATE NOT NULL,

    petroleo DOUBLE,
    agua DOUBLE,
    gas DOUBLE,
    inyeccionGas DOUBLE,
    inyeccionAgua DOUBLE,

    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,

    UNIQUE(escenarioId, pozoId, capaId, fecha)
  )`,

  `INSERT INTO ValorEscenario__v2
   (id, escenarioId, pozoId, capaId, fecha, petroleo, agua, gas, inyeccionGas, inyeccionAgua, createdAt, updatedAt)
   SELECT id, escenarioId, pozoId, capaId, fecha, petroleo, agua, gas, inyeccionGas, inyeccionAgua, createdAt, updatedAt
   FROM ValorEscenario`,

  `DROP TABLE ValorEscenario`,
  `ALTER TABLE ValorEscenario__v2 RENAME TO ValorEscenario`,

  `CREATE INDEX IF NOT EXISTS ix_valorescenario_escenario_capa_fecha ON ValorEscenario(escenarioId, capaId, fecha)`,
  `CREATE INDEX IF NOT EXISTS ix_valorescenario_escenario_pozo ON ValorEscenario(escenarioId, pozoId)`,
];

const elipsesGeometryV6Statements = [
  `CREATE TABLE IF NOT EXISTS Elipse (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    pozoInyectorId VARCHAR REFERENCES Pozo(id),
    pozoProductorId VARCHAR REFERENCES Pozo(id),

    x DOUBLE[] NOT NULL,
    y DOUBLE[] NOT NULL,

    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,

    CHECK (array_length(x) = array_length(y)),
    CHECK (array_length(x) >= 3)
  )`,

  `ALTER TABLE ElipseValor ADD COLUMN IF NOT EXISTS elipseId VARCHAR`,

  `CREATE INDEX IF NOT EXISTS ix_elipse_proyecto_capa ON Elipse(proyectoId, capaId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_capaId ON Elipse(capaId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_pozoInyectorId ON Elipse(pozoInyectorId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_pozoProductorId ON Elipse(pozoProductorId)`,

  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_elipseId ON ElipseValor(elipseId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_sim_var ON ElipseValor(simulacionId, elipseVariableId)`,
];

const elipsesBySimulacionV7Statements = [
  `ALTER TABLE Elipse ADD COLUMN IF NOT EXISTS simulacionId VARCHAR`,

  `CREATE INDEX IF NOT EXISTS ix_elipse_simulacionId ON Elipse(simulacionId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_sim_capa ON Elipse(simulacionId, capaId)`,

  `CREATE TABLE IF NOT EXISTS ElipseValor__v2 (
    id VARCHAR PRIMARY KEY,
    elipseId VARCHAR NOT NULL REFERENCES Elipse(id),
    elipseVariableId VARCHAR NOT NULL REFERENCES ElipseVariable(id),
    valor DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    UNIQUE(elipseId, elipseVariableId)
  )`,

  `INSERT INTO ElipseValor__v2 (id, elipseId, elipseVariableId, valor, createdAt, updatedAt)
   SELECT
     id,
     elipseId,
     elipseVariableId,
     valor,
     NOW() AS createdAt,
     NOW() AS updatedAt
   FROM ElipseValor
   WHERE elipseId IS NOT NULL`,

  `DROP TABLE ElipseValor`,
  `ALTER TABLE ElipseValor__v2 RENAME TO ElipseValor`,

  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_elipseId ON ElipseValor(elipseId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_var ON ElipseValor(elipseVariableId)`,
];

const dynamicFieldsV8Statements = [
  `ALTER TABLE Proyecto ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Unidades ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE GrupoVariable ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Variable ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Capa ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Pozo ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE PozoCapa ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `ALTER TABLE TipoEscenario ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Escenario ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE ValorEscenario ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `ALTER TABLE TipoSimulacion ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Simulacion ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE TipoEstadoPozo ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE SetEstadoPozos ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE SetEstadoPozosDetalle ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `ALTER TABLE VariableMapa ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Mapa ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `ALTER TABLE ElipseVariable ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Elipse ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE ElipseValor ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE import_job_errors ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,

  `CREATE TABLE IF NOT EXISTS DynamicFieldDef (
    id VARCHAR PRIMARY KEY,
    entity VARCHAR NOT NULL,
    key VARCHAR NOT NULL,
    dataType VARCHAR NOT NULL,
    label VARCHAR,
    unit VARCHAR,
    configJson JSON NOT NULL DEFAULT '{}',
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    UNIQUE(entity, key)
  )`,

  `CREATE INDEX IF NOT EXISTS ix_dynamicfielddef_entity ON DynamicFieldDef(entity)`,
];

/**
 * ✅ v9 ahora es NO-OP
 */
const unidadesRefactorV9Statements: string[] = [];

const projectScopedVariablesV10Statements = [
  `ALTER TABLE GrupoVariable ADD COLUMN IF NOT EXISTS proyectoId VARCHAR`,
  `ALTER TABLE GrupoVariable ADD COLUMN IF NOT EXISTS createdAt TIMESTAMP`,
  `ALTER TABLE GrupoVariable ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP`,

  `UPDATE GrupoVariable
   SET proyectoId = (
     SELECT id FROM Proyecto ORDER BY createdAt ASC LIMIT 1
   )
   WHERE proyectoId IS NULL`,

  `UPDATE GrupoVariable
   SET createdAt = NOW()
   WHERE createdAt IS NULL`,

  `UPDATE GrupoVariable
   SET updatedAt = NOW()
   WHERE updatedAt IS NULL`,

  `CREATE TABLE IF NOT EXISTS Unidades__v10 (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    unidad VARCHAR NOT NULL,
    configJson JSON NOT NULL DEFAULT '{}',
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    extrasJson JSON NOT NULL DEFAULT '{}',
    UNIQUE(proyectoId, unidad)
  )`,

  `INSERT INTO Unidades__v10 (id, proyectoId, unidad, configJson, createdAt, updatedAt, extrasJson)
   SELECT
     id,
     proyectoId,
     unidad,
     configJson,
     COALESCE(createdAt, NOW()) AS createdAt,
     COALESCE(updatedAt, NOW()) AS updatedAt,
     COALESCE(extrasJson, '{}') AS extrasJson
   FROM (
     SELECT
       id,
       proyectoId,
       unidad,
       configJson,
       createdAt,
       updatedAt,
       extrasJson,
       ROW_NUMBER() OVER (PARTITION BY proyectoId, unidad ORDER BY updatedAt DESC, createdAt DESC, id DESC) AS rn
     FROM Unidades
   ) t
   WHERE t.rn = 1`,

  `DROP TABLE Unidades`,
  `ALTER TABLE Unidades__v10 RENAME TO Unidades`,

  `CREATE INDEX IF NOT EXISTS ix_grupovariable_proyectoId ON GrupoVariable(proyectoId)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_grupovariable_proyecto_scope_orden ON GrupoVariable(proyectoId, scope, orden)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_unidades_proyecto_unidad ON Unidades(proyectoId, unidad)`,
];

const removeVariableMapaV11Statements: string[] = [];

const restoreVariableMapaV12Statements = [
  `CREATE TABLE IF NOT EXISTS VariableMapa (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,

  `ALTER TABLE VariableMapa ADD COLUMN IF NOT EXISTS extrasJson JSON DEFAULT '{}'`,
  `ALTER TABLE Mapa ADD COLUMN IF NOT EXISTS variableMapaId VARCHAR`,

  `UPDATE Mapa
   SET variableMapaId = COALESCE(variableMapaId, grupoVariableId, id)
   WHERE variableMapaId IS NULL`,

  `INSERT INTO VariableMapa (id, nombre)
   SELECT DISTINCT m.variableMapaId, m.variableMapaId
   FROM Mapa m
   LEFT JOIN VariableMapa vm ON vm.id = m.variableMapaId
   WHERE m.variableMapaId IS NOT NULL AND vm.id IS NULL`,

  `CREATE TABLE IF NOT EXISTS Mapa__v12 (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    capaId VARCHAR NOT NULL UNIQUE REFERENCES Capa(id),
    variableMapaId VARCHAR NOT NULL REFERENCES VariableMapa(id),
    grupoVariableId VARCHAR,
    xedges JSON NOT NULL,
    yedges JSON NOT NULL,
    grid JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    extrasJson JSON NOT NULL DEFAULT '{}'
  )`,

  `INSERT INTO Mapa__v12 (
    id, proyectoId, capaId, variableMapaId, grupoVariableId, xedges, yedges, grid, createdAt, updatedAt, extrasJson
  )
   SELECT
    id,
    proyectoId,
    capaId,
    variableMapaId,
    grupoVariableId,
    xedges,
    yedges,
    grid,
    createdAt,
    updatedAt,
    COALESCE(extrasJson, '{}')
   FROM Mapa`,

  `DROP TABLE Mapa`,
  `ALTER TABLE Mapa__v12 RENAME TO Mapa`,
];

/**
 * ✅ v13: NO-OP
 * DuckDB no permite ALTER/DROP de columnas NOT NULL en tablas con dependencias/FKs.
 * El baseline (v1) ya nace con Proyecto.areal* y grillaCellSize* NULLABLE,
 * así que no necesitamos tocar nada acá.
 */
const proyectoArealNullableV13Statements: string[] = [];

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_domain_schema_v9_baseline",
    statements: initialSchemaStatements,
  },
  {
    version: 2,
    name: "import_pipeline_schema",
    statements: importPipelineStatements,
  },
  {
    version: 3,
    name: "relational_hardening_indexes",
    statements: relationalHardeningStatements,
  },
  {
    version: 4,
    name: "domain_refactor_additive_v4",
    statements: domainRefactorV4Statements,
  },
  {
    version: 5,
    name: "scenario_precision_v5",
    statements: scenarioPrecisionV5Statements,
  },
  {
    version: 6,
    name: "elipses_geometry_v6",
    statements: elipsesGeometryV6Statements,
  },
  {
    version: 7,
    name: "elipses_by_simulacion_v7",
    statements: elipsesBySimulacionV7Statements,
  },
  {
    version: 8,
    name: "dynamic_fields_extras_json_v8",
    statements: dynamicFieldsV8Statements,
  },
  {
    version: 9,
    name: "unidades_refactor_v9_noop",
    statements: unidadesRefactorV9Statements,
  },
  {
    version: 10,
    name: "project_scoped_variables_v10",
    statements: projectScopedVariablesV10Statements,
  },
  {
    version: 11,
    name: "remove_variable_mapa_v11",
    statements: removeVariableMapaV11Statements,
  },
  {
    version: 12,
    name: "restore_variable_mapa_v12",
    statements: restoreVariableMapaV12Statements,
  },
  {
    version: 13,
    name: "project_areal_nullable_v13_noop",
    statements: proyectoArealNullableV13Statements,
  },
];
