// types.d.ts (v2) — IPC + backend types + globals UI mínimos
export {};

declare global {
  // ============================================================
  // ✅ UI legacy rows (DTOs del front) — para mantener DX de v1
  // ============================================================
  type ProyectoRow = {
    id: string;
    nombre: string;
    descripcion?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    alias?: string;
  };

  type YacimientoRow = {
    id: string;
    proyecto_id: string;
    nombre: string;
    descripcion?: string;
    area?: number | null;
  };

  type PozoRow = {
    id: string;
    yacimiento_id?: string;
    proyecto_id?: string;
    nombre: string;
    x: number;
    y: number;
  };

  type CapaRow = {
    id: string;
    nombre: string;
    yacimiento_id?: string;
    proyecto_id?: string;
  };

  type PozoCapaRow = {
    pozo_id: string;
    capa_id: string;
    tope: number;
    base: number;
  };

  // ============================================================
  // ✅ Backend domain types (globales para el front)
  // ============================================================
  type BackendTruthRegistry =
    import("./src/electron/backend/models.js").BackendTruthRegistry;
  type BackendBootstrapStatus =
    import("./src/electron/backend/models.js").BackendBootstrapStatus;

  type Proyecto = import("./src/electron/backend/models.js").Proyecto;
  type Unidades = import("./src/electron/backend/models.js").Unidades;
  type Capa = import("./src/electron/backend/models.js").Capa;
  type Pozo = import("./src/electron/backend/models.js").Pozo;
  type PozoCapa = import("./src/electron/backend/models.js").PozoCapa;

  type Mapa = import("./src/electron/backend/models.js").Mapa;
  type Produccion = import("./src/electron/backend/models.js").Produccion;

  type Escenario = import("./src/electron/backend/models.js").Escenario;
  type TipoEscenario = import("./src/electron/backend/models.js").TipoEscenario;

  type Simulacion = import("./src/electron/backend/models.js").Simulacion;
  type TipoSimulacion =
    import("./src/electron/backend/models.js").TipoSimulacion;

  type ValorEscenario =
    import("./src/electron/backend/models.js").ValorEscenario;

  type TipoEstadoPozo =
    import("./src/electron/backend/models.js").TipoEstadoPozo;
  type SetEstadoPozos =
    import("./src/electron/backend/models.js").SetEstadoPozos;
  type SetEstadoPozosDetalle =
    import("./src/electron/backend/models.js").SetEstadoPozosDetalle;

  type GrupoVariable = import("./src/electron/backend/models.js").GrupoVariable;
  type Variable = import("./src/electron/backend/models.js").Variable;

  type ElipseVariable =
    import("./src/electron/backend/models.js").ElipseVariable;
  type ElipseValor = import("./src/electron/backend/models.js").ElipseValor;

  type Elipse = import("./src/electron/backend/models.js").Elipse;
  type VariableMapa = import("./src/electron/backend/models.js").VariableMapa;


  // ============================================================
  // ✅ Imports domain (v2)
  // ============================================================
  type ImportSeverity =
    import("./src/electron/modules/imports/domain/importJob.js").ImportSeverity;
  type ImportJobError =
    import("./src/electron/modules/imports/domain/importJob.js").ImportJobError;
  type ImportJobSummary =
    import("./src/electron/modules/imports/domain/importJob.js").ImportJobSummary;

  type MapImportRow =
    import("./src/electron/modules/imports/domain/importJob.js").MapImportRow;
  type MapImportPayload =
    import("./src/electron/modules/imports/domain/importJob.js").MapImportPayload;

  type CapaTxtImportPayload =
    import("./src/electron/modules/imports/domain/importJob.js").CapaTxtImportPayload;

  type ImportJobResult =
    import("./src/electron/modules/imports/domain/importJob.js").ImportJobResult;

  // ============================================================
  // ✅ Otros inputs (v2)
  // ============================================================
  type UpsertMapInput =
    import("./src/electron/modules/maps/domain/map.js").UpsertMapInput;

  type CreateEscenarioInput =
    import("./src/electron/modules/scenarios/domain/scenario.js").CreateEscenarioInput;
  type CreateTipoEscenarioInput =
    import("./src/electron/modules/scenarios/domain/scenario.js").CreateTipoEscenarioInput;

  type CreateSimulacionInput =
    import("./src/electron/modules/simulations/domain/simulation.js").CreateSimulacionInput;
  type CreateTipoSimulacionInput =
    import("./src/electron/modules/simulations/domain/simulation.js").CreateTipoSimulacionInput;

  type CreateProduccionInput =
    import("./src/electron/modules/production/domain/production.js").CreateProduccionInput;

  type CreateProyectoInput =
    import("./src/electron/modules/core-data/domain/coreData.js").CreateProyectoInput;
  type CreateProyectoBootstrapInput =
    import("./src/electron/modules/core-data/domain/coreData.js").CreateProyectoBootstrapInput;

  // ❌ CreateUnidadesInput removido (ya no existe en core-data)
  type CreateCapaInput =
    import("./src/electron/modules/core-data/domain/coreData.js").CreateCapaInput;
  type CreatePozoInput =
    import("./src/electron/modules/core-data/domain/coreData.js").CreatePozoInput;
  type CreatePozoCapaInput =
    import("./src/electron/modules/core-data/domain/coreData.js").CreatePozoCapaInput;

  type CreateValorEscenarioInput =
    import("./src/electron/modules/scenario-values/domain/scenarioValue.js").CreateValorEscenarioInput;

  type CreateTipoEstadoPozoInput =
    import("./src/electron/modules/well-states/domain/wellStates.js").CreateTipoEstadoPozoInput;
  type CreateSetEstadoPozosInput =
    import("./src/electron/modules/well-states/domain/wellStates.js").CreateSetEstadoPozosInput;
  type CreateSetEstadoPozosDetalleInput =
    import("./src/electron/modules/well-states/domain/wellStates.js").CreateSetEstadoPozosDetalleInput;

  type CreateGrupoVariableInput =
    import("./src/electron/modules/variables/domain/variables.js").CreateGrupoVariableInput;
  type CreateVariableInput =
    import("./src/electron/modules/variables/domain/variables.js").CreateVariableInput;
  type UpsertUnidadInput =
    import("./src/electron/modules/variables/domain/variables.js").UpsertUnidadInput;

  type CreateElipseVariableInput =
    import("./src/electron/modules/ellipse/domain/ellipse.js").CreateElipseVariableInput;
  type CreateElipseValorInput =
    import("./src/electron/modules/ellipse/domain/ellipse.js").CreateElipseValorInput;

  type CreateElipseInput =
    import("./src/electron/modules/ellipse/domain/ellipse.js").CreateElipseInput;

  type ElipsesNormalizationAllPayload =
    import("./src/electron/modules/ellipse/interfaces/ipc.js").ElipsesNormalizationAllPayload;

  type Unsubscribe = () => void;

  // ============================================================
  // ✅ Dynamic Fields (defs + extrasJson)
  // ============================================================
  type DynamicEntity =
    | "Proyecto"
    | "Unidades"
    | "GrupoVariable"
    | "Variable"
    | "Capa"
    | "Pozo"
    | "PozoCapa"
    | "TipoEscenario"
    | "Escenario"
    | "ValorEscenario"
    | "TipoSimulacion"
    | "Simulacion"
    | "TipoEstadoPozo"
    | "SetEstadoPozos"
    | "SetEstadoPozosDetalle"
    | "VariableMapa"
    | "Mapa"
    | "ElipseVariable"
    | "Elipse"
    | "ElipseValor"
    | "import_jobs"
    | "import_job_errors";

  type DynamicFieldDataType =
    | "number"
    | "string"
    | "boolean"
    | "date"
    | "enum"
    | "json";

  type DynamicFieldDef = {
    id: string;
    entity: DynamicEntity;
    key: string;
    dataType: DynamicFieldDataType;
    label: string | null;
    unit: string | null;
    configJson: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };

  type DynamicFieldsListDefsPayload = { entity: DynamicEntity };

  type DynamicFieldsCreateDefPayload = {
    entity: DynamicEntity;
    key: string;
    dataType: DynamicFieldDataType;
    label?: string | null;
    unit?: string | null;
    configJson?: Record<string, unknown> | null;
  };

  type DynamicFieldsUpdateEntityExtrasPayload = {
    entity: DynamicEntity;
    entityId: string;
    patch: Record<string, unknown>;
    unsetKeys?: string[];
  };

  type DynamicFieldsListDefsResponse =
    | { ok: true; defs: DynamicFieldDef[] }
    | { ok: false; error: string };

  type DynamicFieldsCreateDefResponse =
    | { ok: true; def: DynamicFieldDef }
    | { ok: false; error: string };

  type DynamicFieldsUpdateEntityExtrasResponse =
    | {
        ok: true;
        entity: DynamicEntity;
        entityId: string;
        extrasJson: Record<string, unknown>;
      }
    | { ok: false; error: string };

  // ============================================================
  // ✅ Runtime stats + legacy response (se usan en EventPayloadMapping)
  // ============================================================
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

  type LegacyVisualizerMapResponse =
    import("./src/electron/modules/maps/interfaces/legacyAdapter.js").LegacyVisualizerMapResponse;

  // ============================================================
  // ✅ IPC mapping (tipos de retorno por canal)
  // ============================================================
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
    importCapasDryRun: ImportJobResult;
    importCapasCommit: ImportJobResult;

    productionCreate: Produccion;
    productionListByProject: Produccion[];

    scenarioValueCreate: ValorEscenario;
    scenarioValueListByEscenario: ValorEscenario[];

    wellStateTypeCreate: TipoEstadoPozo;
    wellStateTypeList: TipoEstadoPozo[];
    wellStateSetCreate: SetEstadoPozos;
    wellStateSetListByProject: SetEstadoPozos[];
    wellStateSetDetailCreate: SetEstadoPozosDetalle;
    wellStateSetDetailList: SetEstadoPozosDetalle[];

    grupoVariableCreate: GrupoVariable;
    grupoVariableList: GrupoVariable[];

    variableCreate: Variable;
    variableListByGrupoVariable: Variable[];

    // ✅ unidades (v9)
    unidadesListByProyecto: Unidades[];
    unidadesUpsert: { id: string };

    ellipseVariableCreate: ElipseVariable;
    ellipseVariableList: ElipseVariable[];

    ellipseCreate: Elipse;
    ellipseListByLayer: Elipse[];
    ellipseListByProject: Elipse[];

    ellipseValueCreate: ElipseValor;
    ellipseValueListBySimulacion: ElipseValor[];

    elipsesNormalizationAll:
      | { ok: true; ranges: Record<string, { min: number; max: number }> }
      | { ok: false; error: string };

    dynamicFieldsListDefs: DynamicFieldsListDefsResponse;
    dynamicFieldsCreateDef: DynamicFieldsCreateDefResponse;
    dynamicFieldsUpdateEntityExtras: DynamicFieldsUpdateEntityExtrasResponse;

    coreProyectoInitialize: { proyecto: Proyecto };
    coreProyectoCreate: Proyecto;
    coreProyectoList: Proyecto[];

    coreCapaCreate: Capa;
    coreCapaListByProject: Capa[];

    corePozoCreate: Pozo;
    corePozoListByProject: Pozo[];

    corePozoCapaCreate: PozoCapa;
    corePozoCapaListByProject: PozoCapa[];
  };

  // ============================================================
  // Window.electron (API expuesta por preload)
  // ============================================================
  interface Window {
    electron: {
      subscribeStatistics: (
        callback: (statistics: Statistics) => void,
      ) => Unsubscribe;
      getStaticData: () => Promise<StaticData>;

      backendGetTruthRegistry: () => Promise<BackendTruthRegistry>;
      backendInitSchema: () => Promise<BackendBootstrapStatus>;
      backendSeedInitialData: () => Promise<BackendBootstrapStatus>;
      backendGetBootstrapStatus: () => Promise<BackendBootstrapStatus>;

      mapsGetByLayer: (params: { capaId: string }) => Promise<Mapa | null>;
      mapsUpsert: (payload: UpsertMapInput) => Promise<Mapa>;

      legacyVisualizerGetMap: (params: {
        capaId: string;
      }) => Promise<LegacyVisualizerMapResponse | null>;

      scenarioTypeCreate: (
        payload: CreateTipoEscenarioInput,
      ) => Promise<TipoEscenario>;
      scenarioTypeList: () => Promise<TipoEscenario[]>;
      scenarioCreate: (payload: CreateEscenarioInput) => Promise<Escenario>;
      scenarioListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Escenario[]>;

      simulationTypeCreate: (
        payload: CreateTipoSimulacionInput,
      ) => Promise<TipoSimulacion>;
      simulationTypeList: () => Promise<TipoSimulacion[]>;
      simulationCreate: (payload: CreateSimulacionInput) => Promise<Simulacion>;
      simulationListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Simulacion[]>;

      importMapsDryRun: (payload: MapImportPayload) => Promise<ImportJobResult>;
      importMapsCommit: (payload: MapImportPayload) => Promise<ImportJobResult>;
      importCapasDryRun: (
        payload: CapaTxtImportPayload,
      ) => Promise<ImportJobResult>;
      importCapasCommit: (
        payload: CapaTxtImportPayload,
      ) => Promise<ImportJobResult>;

      productionCreate: (payload: CreateProduccionInput) => Promise<Produccion>;
      productionListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Produccion[]>;

      scenarioValueCreate: (
        payload: CreateValorEscenarioInput,
      ) => Promise<ValorEscenario>;
      scenarioValueListByEscenario: (payload: {
        escenarioId: string;
      }) => Promise<ValorEscenario[]>;

      wellStateTypeCreate: (
        payload: CreateTipoEstadoPozoInput,
      ) => Promise<TipoEstadoPozo>;
      wellStateTypeList: () => Promise<TipoEstadoPozo[]>;
      wellStateSetCreate: (
        payload: CreateSetEstadoPozosInput,
      ) => Promise<SetEstadoPozos>;
      wellStateSetListByProject: (payload: {
        proyectoId: string;
      }) => Promise<SetEstadoPozos[]>;
      wellStateSetDetailCreate: (
        payload: CreateSetEstadoPozosDetalleInput,
      ) => Promise<SetEstadoPozosDetalle>;
      wellStateSetDetailList: (payload: {
        setEstadoPozosId: string;
      }) => Promise<SetEstadoPozosDetalle[]>;

      grupoVariableCreate: (
        payload: CreateGrupoVariableInput,
      ) => Promise<GrupoVariable>;
      grupoVariableList: (payload?: {
        proyectoId?: string;
      }) => Promise<GrupoVariable[]>;

      variableCreate: (payload: CreateVariableInput) => Promise<Variable>;
      variableListByGrupoVariable: (payload: {
        grupoVariableId: string;
      }) => Promise<Variable[]>;

      unidadesListByProyecto: (payload: {
        proyectoId: string;
      }) => Promise<Unidades[]>;
      unidadesUpsert: (payload: UpsertUnidadInput) => Promise<{ id: string }>;

      ellipseVariableCreate: (
        payload: CreateElipseVariableInput,
      ) => Promise<ElipseVariable>;
      ellipseVariableList: () => Promise<ElipseVariable[]>;

      ellipseCreate: (payload: CreateElipseInput) => Promise<Elipse>;
      ellipseListByLayer: (payload: {
        simulacionId: string;
        capaId: string;
      }) => Promise<Elipse[]>;
      ellipseListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Elipse[]>;

      ellipseValueCreate: (
        payload: CreateElipseValorInput,
      ) => Promise<ElipseValor>;
      ellipseValueListBySimulacion: (payload: {
        simulacionId: string;
      }) => Promise<ElipseValor[]>;

      elipsesNormalizationAll: (
        payload: ElipsesNormalizationAllPayload,
      ) => Promise<
        | { ok: true; ranges: Record<string, { min: number; max: number }> }
        | { ok: false; error: string }
      >;

      dynamicFieldsListDefs: (
        payload: DynamicFieldsListDefsPayload,
      ) => Promise<DynamicFieldsListDefsResponse>;
      dynamicFieldsCreateDef: (
        payload: DynamicFieldsCreateDefPayload,
      ) => Promise<DynamicFieldsCreateDefResponse>;
      dynamicFieldsUpdateEntityExtras: (
        payload: DynamicFieldsUpdateEntityExtrasPayload,
      ) => Promise<DynamicFieldsUpdateEntityExtrasResponse>;

      coreProyectoInitialize: (
        payload: CreateProyectoBootstrapInput,
      ) => Promise<{ proyecto: Proyecto }>;
      coreProyectoCreate: (payload: CreateProyectoInput) => Promise<Proyecto>;
      coreProyectoList: () => Promise<Proyecto[]>;

      coreCapaCreate: (payload: CreateCapaInput) => Promise<Capa>;
      coreCapaListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Capa[]>;

      corePozoCreate: (payload: CreatePozoInput) => Promise<Pozo>;
      corePozoListByProject: (payload: {
        proyectoId: string;
      }) => Promise<Pozo[]>;

      corePozoCapaCreate: (payload: CreatePozoCapaInput) => Promise<PozoCapa>;
      corePozoCapaListByProject: (payload: {
        proyectoId: string;
      }) => Promise<PozoCapa[]>;
    };
  }
}
