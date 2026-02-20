import type {
  BackendBootstrapStatus,
  BackendTruthRegistry,
  Capa,
  Escenario,
  Mapa,
  Proyecto,
  Simulacion,
} from "./models.js";

function nowISO() {
  return new Date().toISOString();
}

class BackendStore {
  private seeded = false;
  private proyectos = new Map<string, Proyecto>();
  private capas = new Map<string, Capa>();
  private escenarios = new Map<string, Escenario>();
  private simulaciones = new Map<string, Simulacion>();
  private mapas = new Map<string, Mapa>();

  getTruthRegistry(): BackendTruthRegistry {
    return {
      entities: [
        "Proyecto",
        "Unidades",
        "GrupoVariable",
        "Variable",
        "Capa",
        "Pozo",
        "PozoCapa",
        "TipoSimulacion",
        "TipoEstadoPozo",
        "SetEstadoPozos",
        "SetEstadoPozosDetalle",
        "TipoEscenario",
        "Escenario",
        "ValorEscenario",
        "ElipseVariable",
        "ElipseValor",
        "Simulacion",
        "Produccion",
        "VariableMapa",
        "Mapa",
      ],
      notes: [
        "Mermaid class diagram is treated as source of truth.",
        "Mapa is DB-backed in v2 (replacing legacy JSON file reads).",
        "Scenario/simulation entities are first-class in v2 backend bootstrap.",
      ],
    };
  }

  seedInitialData(): BackendBootstrapStatus {
    if (this.seeded) {
      return this.getBootstrapStatus();
    }

    const createdAt = nowISO();
    const updatedAt = createdAt;
    const proyecto: Proyecto = {
      id: "proj-demo",
      nombre: "Proyecto Demo",
      alias: "DEMO",
      limitesTemporalDesde: "2020-01-01",
      limitesTemporalHasta: "2030-01-01",
      arealMinX: 0,
      arealMinY: 0,
      arealMaxX: 100,
      arealMaxY: 100,
      arealCRS: "EPSG:4326",
      grillaNx: 10,
      grillaNy: 10,
      grillaCellSizeX: 10,
      grillaCellSizeY: 10,
      grillaUnidad: "m",
      unidadesId: "units-demo",
      createdAt,
      updatedAt,
    };
    this.proyectos.set(proyecto.id, proyecto);

    const capa: Capa = {
      id: "capa-a",
      proyectoId: proyecto.id,
      nombre: "Capa A",
      createdAt,
      updatedAt,
    };
    this.capas.set(capa.id, capa);

    const escenario: Escenario = {
      id: "esc-base",
      proyectoId: proyecto.id,
      tipoEscenarioId: "tipo-esc-base",
      nombre: "Escenario Base",
      createdAt,
      updatedAt,
    };
    this.escenarios.set(escenario.id, escenario);

    const simulacion: Simulacion = {
      id: "sim-base",
      proyectoId: proyecto.id,
      tipoSimulacionId: "tipo-sim-base",
      escenarioSimulacionId: escenario.id,
      setEstadoPozosId: "set-estados-base",
      createdAt,
      updatedAt,
    };
    this.simulaciones.set(simulacion.id, simulacion);

    const mapa: Mapa = {
      id: "mapa-capa-a",
      proyectoId: proyecto.id,
      capaId: capa.id,
      variableMapaId: "var-mapa-1",
      xedges: [0, 10, 20],
      yedges: [0, 10, 20],
      grid: [
        [1, 2],
        [3, 4],
      ],
      createdAt,
      updatedAt,
    };

    this.ensureSingleMapPerLayer(mapa);
    this.mapas.set(mapa.id, mapa);

    this.seeded = true;
    return this.getBootstrapStatus();
  }

  getBootstrapStatus(): BackendBootstrapStatus {
    return {
      seeded: this.seeded,
      entityCounts: {
        proyectos: this.proyectos.size,
        capas: this.capas.size,
        escenarios: this.escenarios.size,
        simulaciones: this.simulaciones.size,
        mapas: this.mapas.size,
      },
    };
  }

  private ensureSingleMapPerLayer(candidate: Mapa): void {
    const duplicated = Array.from(this.mapas.values()).find(
      (mapa) => mapa.capaId === candidate.capaId
    );

    if (duplicated) {
      throw new Error(`A map already exists for layer ${candidate.capaId}`);
    }
  }
}

export const backendStore = new BackendStore();
