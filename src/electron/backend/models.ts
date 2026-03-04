// src/electron/backend/models.ts
export type ID = string;

export type ExtrasJson = Record<string, unknown>;

export interface Proyecto {
  id: ID;
  nombre: string;
  alias: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;

  /**
   * ✅ Ahora nullable:
   * Se calcula luego de cargar pozos (min/max x/y + margen).
   */
  arealMinX: number | null;
  arealMinY: number | null;
  arealMaxX: number | null;
  arealMaxY: number | null;

  /**
   * ✅ CRS puede ser definido al crear o luego (si preferís).
   * Si querés forzarlo siempre, lo validamos en domain.
   */
  arealCRS: string | null;

  grillaNx: number;
  grillaNy: number;

  /**
   * ✅ Depende de areal. Nullable hasta que haya areal.
   */
  grillaCellSizeX: number | null;
  grillaCellSizeY: number | null;

  grillaUnidad: string;

  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

/**
 * Unidades es una entidad del proyecto.
 */
export interface Unidades {
  id: ID;
  proyectoId: ID;
  unidad: string;
  configJson: unknown;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export type GrupoVariableScope =
  | "PROYECTO"
  | "POZO"
  | "CAPA"
  | "ELIPSE"
  | "ESCENARIO"
  | "SIMULACION"
  | "UNIDADES"
  | "MAPA";

export interface GrupoVariable {
  id: ID;
  proyectoId: ID;
  nombre: string;
  orden: number;
  scope: GrupoVariableScope;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface Variable {
  id: ID;
  grupoVariableId: ID;
  nombre: string;
  codigo: string;
  tipoDato: string;
  configJson: unknown;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface Capa {
  id: ID;
  proyectoId: ID;
  nombre: string;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface Pozo {
  id: ID;
  proyectoId: ID;
  nombre: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface PozoCapa {
  id: ID;
  proyectoId: ID;
  pozoId: ID;
  capaId: ID;
  tope: number;
  base: number;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface TipoSimulacion {
  id: ID;
  nombre: string;

  extrasJson?: ExtrasJson;
}

export interface TipoEstadoPozo {
  id: ID;
  nombre: string;

  extrasJson?: ExtrasJson;
}

export interface SetEstadoPozos {
  id: ID;

  // ✅ existe en schema inicial
  proyectoId: ID;

  // ✅ v4 lo agrega nullable
  simulacionId: ID | null;

  nombre: string;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface SetEstadoPozosDetalle {
  id: ID;
  setEstadoPozosId: ID;
  pozoId: ID;
  tipoEstadoPozoId: ID;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface TipoEscenario {
  id: ID;
  nombre: string;

  extrasJson?: ExtrasJson;
}

export interface Escenario {
  id: ID;
  proyectoId: ID;
  tipoEscenarioId: ID;
  nombre: string;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface ValorEscenario {
  id: ID;
  escenarioId: ID;
  pozoId: ID;
  capaId: ID;
  fecha: string;

  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  inyeccionGas: number | null;
  inyeccionAgua: number | null;

  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface ElipseVariable {
  id: ID;
  nombre: string;

  extrasJson?: ExtrasJson;
}

/**
 * ✅ v7: Elipse por simulación (geometría depende de simulacionId)
 */
export interface Elipse {
  id: ID;
  proyectoId: ID;

  simulacionId: ID | null;

  capaId: ID;
  pozoInyectorId: ID | null;
  pozoProductorId: ID | null;
  x: number[];
  y: number[];
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

/**
 * ✅ v7: valores dependen de una elipse (simulación implícita)
 */
export interface ElipseValor {
  id: ID;
  elipseId: ID;
  elipseVariableId: ID;
  valor: number;
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface Simulacion {
  id: ID;
  proyectoId: ID;
  tipoSimulacionId: ID;
  escenarioSimulacionId: ID;

  setEstadoPozosId: ID;

  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

/**
 * Legacy
 */
export interface Produccion {
  id: number;
  proyectoId: ID;
  pozoId: ID;
  capaId: ID;
  fecha: string;
  petroleo: number;
  agua: number;
  gas: number;
  agua_iny: number;
}

export interface VariableMapa {
  id: ID;
  nombre: string;

  extrasJson?: ExtrasJson;
}

export interface Mapa {
  id: ID;
  proyectoId: ID;
  capaId: ID;
  variableMapaId: ID;
  grupoVariableId: ID | null;
  xedges: number[];
  yedges: number[];
  grid: (number | null)[][];
  createdAt: string;
  updatedAt: string;

  extrasJson?: ExtrasJson;
}

export interface BackendTruthRegistry {
  entities: string[];
  notes: string[];
}

export interface BackendBootstrapStatus {
  seeded: boolean;
  schemaInitialized: boolean;
  databasePath: string;
  entityCounts: Record<string, number>;
}
