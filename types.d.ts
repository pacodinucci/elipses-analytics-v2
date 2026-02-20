type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageUsage: number;
};

type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

type BackendTruthRegistry = import("./src/electron/backend/models.js").BackendTruthRegistry;
type BackendBootstrapStatus = import("./src/electron/backend/models.js").BackendBootstrapStatus;
type Mapa = import("./src/electron/backend/models.js").Mapa;
type UpsertMapInput = import("./src/electron/modules/maps/domain/map.js").UpsertMapInput;
type CreateEscenarioInput = import("./src/electron/modules/scenarios/domain/scenario.js").CreateEscenarioInput;
type CreateTipoEscenarioInput = import("./src/electron/modules/scenarios/domain/scenario.js").CreateTipoEscenarioInput;
type CreateSimulacionInput = import("./src/electron/modules/simulations/domain/simulation.js").CreateSimulacionInput;
type CreateTipoSimulacionInput = import("./src/electron/modules/simulations/domain/simulation.js").CreateTipoSimulacionInput;
type Escenario = import("./src/electron/backend/models.js").Escenario;
type TipoEscenario = import("./src/electron/backend/models.js").TipoEscenario;
type Simulacion = import("./src/electron/backend/models.js").Simulacion;
type TipoSimulacion = import("./src/electron/backend/models.js").TipoSimulacion;
type LegacyVisualizerMapResponse = import("./src/electron/modules/maps/interfaces/legacyAdapter.js").LegacyVisualizerMapResponse;
type MapImportPayload = import("./src/electron/modules/imports/domain/importJob.js").MapImportPayload;
type ImportJobResult = import("./src/electron/modules/imports/domain/importJob.js").ImportJobResult;
type Proyecto = import("./src/electron/backend/models.js").Proyecto;
type Unidades = import("./src/electron/backend/models.js").Unidades;
type Capa = import("./src/electron/backend/models.js").Capa;
type Pozo = import("./src/electron/backend/models.js").Pozo;
type PozoCapa = import("./src/electron/backend/models.js").PozoCapa;
type CreateProyectoInput = import("./src/electron/modules/core-data/domain/coreData.js").CreateProyectoInput;
type CreateUnidadesInput = import("./src/electron/modules/core-data/domain/coreData.js").CreateUnidadesInput;
type CreateCapaInput = import("./src/electron/modules/core-data/domain/coreData.js").CreateCapaInput;
type CreatePozoInput = import("./src/electron/modules/core-data/domain/coreData.js").CreatePozoInput;
type CreatePozoCapaInput = import("./src/electron/modules/core-data/domain/coreData.js").CreatePozoCapaInput;

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  backendGetTruthRegistry: BackendTruthRegistry;
  backendInitSchema: BackendBootstrapStatus;
  backendSeedInitialData: BackendBootstrapStatus;
  backendGetBootstrapStatus: BackendBootstrapStatus;
  mapsGetByLayer: Mapa | null;
  mapsUpsert: Mapa;
  legacyVisualizerGetMap: LegacyVisualizerMapResponse | null;
  scenarioTypeCreate: TipoEscenario;
  scenarioTypeList: TipoEscenario[];
  scenarioCreate: Escenario;
  scenarioListByProject: Escenario[];
  simulationTypeCreate: TipoSimulacion;
  simulationTypeList: TipoSimulacion[];
  simulationCreate: Simulacion;
  simulationListByProject: Simulacion[];
  importMapsDryRun: ImportJobResult;
  importMapsCommit: ImportJobResult;
  coreUnidadesCreate: Unidades;
  coreUnidadesListByProject: Unidades[];
  coreProyectoCreate: Proyecto;
  coreProyectoList: Proyecto[];
  coreCapaCreate: Capa;
  coreCapaListByProject: Capa[];
  corePozoCreate: Pozo;
  corePozoListByProject: Pozo[];
  corePozoCapaCreate: PozoCapa;
  corePozoCapaListByProject: PozoCapa[];
};

type UnsuscribeFunction = () => void;

interface Window {
  electron: {
    subscribeStatistics: (
      callback: (statistics: Statistics) => void
    ) => UnsuscribeFunction;
    getStaticData: () => Promise<StaticData>;
    backendGetTruthRegistry: () => Promise<BackendTruthRegistry>;
    backendInitSchema: () => Promise<BackendBootstrapStatus>;
    backendSeedInitialData: () => Promise<BackendBootstrapStatus>;
    backendGetBootstrapStatus: () => Promise<BackendBootstrapStatus>;
    mapsGetByLayer: (params: { capaId: string; variableMapaId?: string }) => Promise<Mapa | null>;
    mapsUpsert: (payload: UpsertMapInput) => Promise<Mapa>;
    legacyVisualizerGetMap: (params: { capaId: string; variableMapaId?: string }) => Promise<LegacyVisualizerMapResponse | null>;
    scenarioTypeCreate: (payload: CreateTipoEscenarioInput) => Promise<TipoEscenario>;
    scenarioTypeList: () => Promise<TipoEscenario[]>;
    scenarioCreate: (payload: CreateEscenarioInput) => Promise<Escenario>;
    scenarioListByProject: (payload: { proyectoId: string }) => Promise<Escenario[]>;
    simulationTypeCreate: (payload: CreateTipoSimulacionInput) => Promise<TipoSimulacion>;
    simulationTypeList: () => Promise<TipoSimulacion[]>;
    simulationCreate: (payload: CreateSimulacionInput) => Promise<Simulacion>;
    simulationListByProject: (payload: { proyectoId: string }) => Promise<Simulacion[]>;
    importMapsDryRun: (payload: MapImportPayload) => Promise<ImportJobResult>;
    importMapsCommit: (payload: MapImportPayload) => Promise<ImportJobResult>;
    coreUnidadesCreate: (payload: CreateUnidadesInput) => Promise<Unidades>;
    coreUnidadesListByProject: (payload: { proyectoId: string }) => Promise<Unidades[]>;
    coreProyectoCreate: (payload: CreateProyectoInput) => Promise<Proyecto>;
    coreProyectoList: () => Promise<Proyecto[]>;
    coreCapaCreate: (payload: CreateCapaInput) => Promise<Capa>;
    coreCapaListByProject: (payload: { proyectoId: string }) => Promise<Capa[]>;
    corePozoCreate: (payload: CreatePozoInput) => Promise<Pozo>;
    corePozoListByProject: (payload: { proyectoId: string }) => Promise<Pozo[]>;
    corePozoCapaCreate: (payload: CreatePozoCapaInput) => Promise<PozoCapa>;
    corePozoCapaListByProject: (payload: { proyectoId: string }) => Promise<PozoCapa[]>;
  };
}
