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

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  backendGetTruthRegistry: BackendTruthRegistry;
  backendInitSchema: BackendBootstrapStatus;
  backendSeedInitialData: BackendBootstrapStatus;
  backendGetBootstrapStatus: BackendBootstrapStatus;
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
  };
}
