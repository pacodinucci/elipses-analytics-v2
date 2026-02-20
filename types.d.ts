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

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  backendGetTruthRegistry: BackendTruthRegistry;
  backendInitSchema: BackendBootstrapStatus;
  backendSeedInitialData: BackendBootstrapStatus;
  backendGetBootstrapStatus: BackendBootstrapStatus;
  mapsGetByLayer: Mapa | null;
  mapsUpsert: Mapa;
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
  };
}
