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

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  backendGetTruthRegistry: BackendTruthRegistry;
  backendInitSchema: BackendBootstrapStatus;
  backendSeedInitialData: BackendBootstrapStatus;
  backendGetBootstrapStatus: BackendBootstrapStatus;
  mapsGetByLayer: Mapa | null;
  mapsUpsert: Mapa;
  scenarioTypeCreate: TipoEscenario;
  scenarioTypeList: TipoEscenario[];
  scenarioCreate: Escenario;
  scenarioListByProject: Escenario[];
  simulationTypeCreate: TipoSimulacion;
  simulationTypeList: TipoSimulacion[];
  simulationCreate: Simulacion;
  simulationListByProject: Simulacion[];
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
    scenarioTypeCreate: (payload: CreateTipoEscenarioInput) => Promise<TipoEscenario>;
    scenarioTypeList: () => Promise<TipoEscenario[]>;
    scenarioCreate: (payload: CreateEscenarioInput) => Promise<Escenario>;
    scenarioListByProject: (payload: { proyectoId: string }) => Promise<Escenario[]>;
    simulationTypeCreate: (payload: CreateTipoSimulacionInput) => Promise<TipoSimulacion>;
    simulationTypeList: () => Promise<TipoSimulacion[]>;
    simulationCreate: (payload: CreateSimulacionInput) => Promise<Simulacion>;
    simulationListByProject: (payload: { proyectoId: string }) => Promise<Simulacion[]>;
  };
}
