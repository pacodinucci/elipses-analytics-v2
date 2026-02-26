export type ID = string;

export interface Proyecto {
  id: ID;
  nombre: string;
  alias: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;
  arealMinX: number;
  arealMinY: number;
  arealMaxX: number;
  arealMaxY: number;
  arealCRS: string;
  grillaNx: number;
  grillaNy: number;
  grillaCellSizeX: number;
  grillaCellSizeY: number;
  grillaUnidad: string;
  unidadesId: ID;
  createdAt: string;
  updatedAt: string;
}

export interface Unidades {
  id: ID;
  proyectoId: ID;
  createdAt: string;
  updatedAt: string;
}

export interface GrupoVariable {
  id: ID;
  nombre: string;
  orden: number;
}

export interface Variable {
  id: ID;
  grupoVariableId: ID;
  unidadesId: ID;
  nombre: string;
  codigo: string;
  tipoDato: string;
  unidad: string;
  configJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Capa {
  id: ID;
  proyectoId: ID;
  nombre: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pozo {
  id: ID;
  proyectoId: ID;
  nombre: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
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
}

export interface TipoSimulacion {
  id: ID;
  nombre: string;
}

export interface TipoEstadoPozo {
  id: ID;
  nombre: string;
}

export interface SetEstadoPozos {
  id: ID;
  simulacionId: ID;
  nombre: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetEstadoPozosDetalle {
  id: ID;
  setEstadoPozosId: ID;
  pozoId: ID;
  tipoEstadoPozoId: ID;
  createdAt: string;
  updatedAt: string;
}

export interface TipoEscenario {
  id: ID;
  nombre: string;
}

export interface Escenario {
  id: ID;
  proyectoId: ID;
  tipoEscenarioId: ID;
  nombre: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValorEscenario {
  id: ID;
  escenarioId: ID;
  pozoId: ID;
  capaId: ID;
  fecha: string;

  /**
   * ✅ v5+ (scenario_precision): métricas pueden ser NULL según tipoEscenario.
   */
  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  inyeccionGas: number | null;
  inyeccionAgua: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface ElipseVariable {
  id: ID;
  nombre: string;
}

/**
 * ✅ NUEVO (dominio v2): Geometría de elipses por proyecto/capa.
 * x/y representan el contorno sampleado (polígono) en coordenadas del mapa.
 */
export interface Elipse {
  id: ID;
  proyectoId: ID;
  capaId: ID;
  pozoInyectorId: ID | null;
  pozoProductorId: ID | null;
  x: number[];
  y: number[];
  createdAt: string;
  updatedAt: string;
}

/**
 * ✅ MODIFICADO (dominio v2): ElipseValor ahora referencia a Elipse por elipseId.
 * Nota: la tabla en DB todavía puede contener columnas legacy (proyectoId, etc.)
 * pero el dominio v2 usa estas.
 */
export interface ElipseValor {
  id: ID;
  simulacionId: ID;
  elipseId: ID;
  elipseVariableId: ID;
  valor: number;
}

export interface Simulacion {
  id: ID;
  proyectoId: ID;
  tipoSimulacionId: ID;
  escenarioSimulacionId: ID;
  createdAt: string;
  updatedAt: string;
}

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

/**
 * ⚠️ Legacy (se elimina cuando removamos el módulo variable-mapa y la tabla VariableMapa)
 */
export interface VariableMapa {
  id: ID;
  nombre: string;
}

export interface Mapa {
  id: ID;
  proyectoId: ID;
  capaId: ID;
  grupoVariableId: ID;
  xedges: number[];
  yedges: number[];

  /**
   * Recomendado si tu grid puede tener nulls.
   * Si estás 100% seguro que nunca hay null, podés dejar number[][].
   */
  grid: (number | null)[][];

  createdAt: string;
  updatedAt: string;
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
