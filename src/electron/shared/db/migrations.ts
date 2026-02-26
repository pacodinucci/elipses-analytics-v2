export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

const initialSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS Proyecto (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    alias VARCHAR NOT NULL,
    limitesTemporalDesde DATE NOT NULL,
    limitesTemporalHasta DATE NOT NULL,
    arealMinX DOUBLE NOT NULL,
    arealMinY DOUBLE NOT NULL,
    arealMaxX DOUBLE NOT NULL,
    arealMaxY DOUBLE NOT NULL,
    arealCRS VARCHAR NOT NULL,
    grillaNx INTEGER NOT NULL,
    grillaNy INTEGER NOT NULL,
    grillaCellSizeX DOUBLE NOT NULL,
    grillaCellSizeY DOUBLE NOT NULL,
    grillaUnidad VARCHAR NOT NULL,
    unidadesId VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Unidades (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS GrupoVariable (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    orden INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Variable (
    id VARCHAR PRIMARY KEY,
    grupoVariableId VARCHAR NOT NULL REFERENCES GrupoVariable(id),
    unidadesId VARCHAR NOT NULL REFERENCES Unidades(id),
    nombre VARCHAR NOT NULL,
    codigo VARCHAR NOT NULL,
    tipoDato VARCHAR NOT NULL,
    unidad VARCHAR NOT NULL,
    configJson JSON NOT NULL,
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
    xedges JSON NOT NULL,
    yedges JSON NOT NULL,
    grid JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
];

const relationalHardeningStatements = [
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_unidades_proyectoId ON Unidades(proyectoId)`,
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

/**
 * v4: transición al nuevo dominio (additive)
 * - SetEstadoPozos: agrega simulacionId
 * - ElipseValor: agrega simulacionId
 * - Mapa: agrega grupoVariableId
 * - Backfills determinísticos donde se puede
 */
const domainRefactorV4Statements = [
  `ALTER TABLE SetEstadoPozos ADD COLUMN simulacionId VARCHAR`,
  `ALTER TABLE ElipseValor ADD COLUMN simulacionId VARCHAR`,
  `ALTER TABLE Mapa ADD COLUMN grupoVariableId VARCHAR`,

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

  `ALTER TABLE ElipseValor ADD COLUMN elipseId VARCHAR`,

  `CREATE INDEX IF NOT EXISTS ix_elipse_proyecto_capa ON Elipse(proyectoId, capaId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_capaId ON Elipse(capaId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_pozoInyectorId ON Elipse(pozoInyectorId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_pozoProductorId ON Elipse(pozoProductorId)`,

  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_elipseId ON ElipseValor(elipseId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_sim_var ON ElipseValor(simulacionId, elipseVariableId)`,
];

/**
 * v7: Elipses por simulación
 * - Elipse: agrega simulacionId (NULLABLE por ahora; se endurece en v8)
 * - ElipseValor: se reconstruye para depender de Elipse (sin simulacionId)
 *   y agrega createdAt/updatedAt (consistencia con el resto del dominio).
 */
const elipsesBySimulacionV7Statements = [
  // 1) Elipse ahora pertenece a una simulación
  `ALTER TABLE Elipse ADD COLUMN simulacionId VARCHAR`,

  // índices nuevos para consultas típicas
  `CREATE INDEX IF NOT EXISTS ix_elipse_simulacionId ON Elipse(simulacionId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipse_sim_capa ON Elipse(simulacionId, capaId)`,

  // 2) Rebuild ElipseValor sin simulacionId (depende de elipseId)
  `CREATE TABLE IF NOT EXISTS ElipseValor__v2 (
    id VARCHAR PRIMARY KEY,
    elipseId VARCHAR NOT NULL REFERENCES Elipse(id),
    elipseVariableId VARCHAR NOT NULL REFERENCES ElipseVariable(id),
    valor DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    UNIQUE(elipseId, elipseVariableId)
  )`,

  // Copiamos lo que se pueda desde la tabla vieja:
  // - elipseId ya existe desde v6 (puede ser NULL para legacy; esas filas no se copian)
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

  // índices útiles
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_elipseId ON ElipseValor(elipseId)`,
  `CREATE INDEX IF NOT EXISTS ix_elipsevalor_var ON ElipseValor(elipseVariableId)`,
];

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_domain_schema",
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

  // ✅ NUEVO
  {
    version: 7,
    name: "elipses_by_simulacion_v7",
    statements: elipsesBySimulacionV7Statements,
  },
];
