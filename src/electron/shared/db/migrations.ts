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
  // Proyecto <-> Unidades expected as 1:1 in the domain: one Unidades row per Proyecto.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_unidades_proyectoId ON Unidades(proyectoId)`,
  // Prevent duplicated layer assignment rows for the same pozo/capa inside one proyecto.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_pozocapa_project_pozo_capa ON PozoCapa(proyectoId, pozoId, capaId)`,
  // Prevent duplicated daily production rows for same project/pozo/capa/date tuple.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_produccion_project_pozo_capa_fecha ON Produccion(proyectoId, pozoId, capaId, fecha)`,
  // Prevent duplicated scenario values for the same scenario/pozo/capa/date tuple.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_valorescenario_escenario_pozo_capa_fecha ON ValorEscenario(escenarioId, pozoId, capaId, fecha)`,
  // Prevent duplicated state entries per set + pozo.
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
];
