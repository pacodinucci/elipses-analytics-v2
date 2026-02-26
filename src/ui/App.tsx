import { useEffect, useMemo, useState } from "react";
import "./App.css";

// Layout + UI
import AppLayout from "./components/layout/app-layout";
import { SelectProjectModal } from "./components/project/select-project-modal";
import { NewProjectModal } from "./components/project/new-project-modal";
import { ProyectoCapasBar } from "./components/project/project-capas-bar";
import { DatosMapaFloatingWindow } from "./components/mapa/datos-mapa-floating-window";
import { FullScreenLoader } from "./components/layout/fullscreen-loader";

// ✅ Import modal (v2: capas/maps)
import { ImportModal } from "./components/import/import-modal";

// Viewer floating window (WebGL test)
import { ViewerFloatingWindow } from "./components/viewer/viewer-floating-window";

// Producción floating window
import { ProduccionFloatingWindow } from "./components/produccion/produccion-floating-window";

// Hooks / Store
import { useProyectos } from "./hooks/use-proyectos";
import { useSelectionStore } from "./store/selection-store";
import { useViewerElipsesStore } from "./store/viewer-elipses-store";
import { useCapas } from "./hooks/use-capas";

// Start screen (v2: solo proyecto)
import { ProjectYacimientoStartScreen } from "./components/project/project-yacimiento-start-screen";

type CapasBarPosition = "top" | "left";

// ⚠️ v2: elipses ahora dependen de simulación. Hasta conectar el flujo simulation→ellipse,
// NO bloqueamos la UI por el estado de elipses.
const ENABLE_ELIPSES_LOADING_BLOCK = false;

function App() {
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(
    null,
  );

  const [selectedCapaName, setSelectedCapaName] = useState<string | null>(null);

  const [activeWindow, setActiveWindow] = useState<
    "mapa" | "tabla" | "datosMapa" | "viewer" | null
  >("tabla");

  const [isSelectProjectModalOpen, setIsSelectProjectModalOpen] =
    useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [showWindowMapa, setShowWindowMapa] = useState(true);
  const [showWindowTabla, setShowWindowTabla] = useState(true);
  const [showWindowDatosMapa, setShowWindowDatosMapa] = useState(true);

  // ✅ toggle de la barra de capas
  const [showCapasBar, setShowCapasBar] = useState(true);

  // ✅ posición (top | left)
  const [capasBarPosition, setCapasBarPosition] =
    useState<CapasBarPosition>("top");

  const [isBootLoading, setIsBootLoading] = useState(true);

  // ✅ selection store (solo proyecto)
  const setProyectoId = useSelectionStore((s) => s.setSelectedProyectoId);

  // ---- Global elipses store ----
  // (lo mantenemos, pero no bloqueamos UI aún)
  const loadAllElipses = useViewerElipsesStore((s) => s.loadAll);
  const resetElipses = useViewerElipsesStore((s) => s.reset);

  const elipsesLoading = useViewerElipsesStore((s) => s.loading);
  const elipsesError = useViewerElipsesStore((s) => s.error);
  const elipsesIsReady = useViewerElipsesStore((s) => s.isReady());

  const elipsesByCapa = useViewerElipsesStore((s) => s.byCapa);
  const totalCapas = useViewerElipsesStore((s) => s.totalCapas);
  const loadedCapas = useViewerElipsesStore((s) => s.loadedCapas);

  // ---- Capas del proyecto (v2) ----
  const proyectoId = selectedProyecto?.id ?? null;

  const {
    capas,
    loading: capasLoading,
    error: capasError,
  } = useCapas(proyectoId);

  // UI windows setup
  useEffect(() => {
    if (selectedProyecto) {
      setShowWindowMapa(true);
      setShowWindowTabla(true);
      setShowWindowDatosMapa(true);

      setShowCapasBar(true);
      setCapasBarPosition("top");

      setActiveWindow("mapa");
    }
  }, [selectedProyecto?.id]);

  const { proyectos, loading, error, fetchProyectos } = useProyectos();

  const handleAbrirProyecto = async () => {
    await fetchProyectos();
    setIsSelectProjectModalOpen(true);
  };

  const handleCrearProyecto = () => {
    setIsNewProjectModalOpen(true);
  };

  const handleSelectProyecto = (proyecto: Proyecto) => {
    setSelectedProyecto(proyecto);
    setSelectedCapaName(null);
    setIsSelectProjectModalOpen(false);

    setProyectoId(proyecto.id);

    // ✅ limpiar estado de elipses (placeholder/compat)
    resetElipses();
  };

  // (Opcional) auto-selección de capa si no hay
  useEffect(() => {
    if (!selectedProyecto) return;
    if (capasLoading) return;
    if (capasError) return;
    if (!capas || capas.length === 0) return;

    if (!selectedCapaName) {
      setSelectedCapaName(capas[0].nombre);
    }
  }, [selectedProyecto?.id, capasLoading, capasError, capas, selectedCapaName]);

  // ⚠️ Placeholder elipses (NO bloquea UI).
  // En v2 real van por simulacionId. Por ahora el store las deja vacías, pero "ready".
  useEffect(() => {
    if (!selectedProyecto) return;
    if (capasLoading) return;
    if (capasError) return;
    if (!capas || capas.length === 0) return;

    const capasNames = capas
      .map((c: any) => String(c?.nombre ?? "").trim())
      .filter(Boolean);

    if (capasNames.length === 0) return;

    // ✅ v2: el store ya no recibe yacimientoId, recibe proyectoId.
    loadAllElipses({
      proyectoId: selectedProyecto.id,
      capas: capasNames,
    });
  }, [
    selectedProyecto?.id,
    capasLoading,
    capasError,
    capas,
    loadAllElipses,
    selectedProyecto,
  ]);

  // Log (solo debug)
  useEffect(() => {
    if (!selectedProyecto) return;
    if (!elipsesIsReady) return;

    const keys = Object.keys(elipsesByCapa);
    const firstKey = keys[0];
    const firstElipses = firstKey ? (elipsesByCapa[firstKey] ?? []) : [];

    console.log("✅ [viewer-elipses-store] READY", {
      proyectoId: selectedProyecto.id,
      capasCargadas: keys.length,
      firstKey,
      firstCount: firstElipses.length,
    });
  }, [selectedProyecto?.id, elipsesIsReady, elipsesByCapa, selectedProyecto]);

  // Boot: cargar proyectos
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await fetchProyectos();
      } finally {
        if (!cancelled) setIsBootLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProyectos]);

  if (isBootLoading) {
    return <FullScreenLoader label="Inicializando Elipses..." />;
  }

  const hasCapas = !!capas && capas.length > 0;

  const shouldBlockForElipses =
    ENABLE_ELIPSES_LOADING_BLOCK &&
    hasCapas &&
    (elipsesLoading || !elipsesIsReady);

  const isWorkspaceReady = !!selectedProyecto;

  return (
    <div className="app-root">
      <AppLayout
        onAbrirProyecto={handleAbrirProyecto}
        onOpenImportar={() => setIsImportModalOpen(true)}
        selectedProyecto={selectedProyecto}
        onToggleMapaWindow={() => setShowWindowMapa((v) => !v)}
        onToggleProduccionWindow={() => setShowWindowTabla((v) => !v)}
        onToggleDatosMapaWindow={() => setShowWindowDatosMapa((v) => !v)}
        isMapaWindowOpen={showWindowMapa}
        isProduccionWindowOpen={showWindowTabla}
        isDatosMapaWindowOpen={showWindowDatosMapa}
        isCapasBarOpen={showCapasBar}
        onToggleCapasBar={() => setShowCapasBar((v) => !v)}
        capasBarPosition={capasBarPosition}
        onChangeCapasBarPosition={setCapasBarPosition}
      >
        {!isWorkspaceReady ? (
          <ProjectYacimientoStartScreen
            proyectos={proyectos}
            proyectosLoading={loading}
            proyectosError={error}
            selectedProyecto={selectedProyecto}
            onSelectProyecto={handleSelectProyecto}
            onCrearProyecto={handleCrearProyecto}
          />
        ) : capasLoading ? (
          <FullScreenLoader label="Cargando capas..." />
        ) : capasError ? (
          <FullScreenLoader label={`Error cargando capas: ${capasError}`} />
        ) : !hasCapas ? (
          <FullScreenLoader label="Este proyecto no tiene capas." />
        ) : shouldBlockForElipses ? (
          <FullScreenLoader
            label={
              elipsesError
                ? `Error cargando: ${elipsesError}`
                : `Cargando (${loadedCapas}/${totalCapas})...`
            }
          />
        ) : (
          <div
            className={`app-workspace app-workspace--capas-${capasBarPosition}`}
          >
            {showCapasBar && selectedProyecto && (
              <ProyectoCapasBar
                proyectoId={selectedProyecto.id}
                selectedCapaName={selectedCapaName}
                onSelectCapa={setSelectedCapaName}
                position={capasBarPosition}
              />
            )}

            <div className="app-canvas">
              {showWindowMapa && (
                <ViewerFloatingWindow
                  capa={selectedCapaName}
                  initialPosition={{ x: 80, y: 80 }}
                  initialSize={{ width: 900, height: 500 }}
                  isActive={activeWindow === "viewer"}
                  onFocus={() => setActiveWindow("viewer")}
                  onClose={() => setShowWindowMapa(false)}
                />
              )}

              {showWindowDatosMapa && (
                <DatosMapaFloatingWindow
                  initialPosition={{ x: 800, y: 30 }}
                  initialSize={{ width: 520, height: 360 }}
                  isActive={activeWindow === "datosMapa"}
                  onFocus={() => setActiveWindow("datosMapa")}
                  onClose={() => setShowWindowDatosMapa(false)}
                />
              )}

              {showWindowTabla && (
                <ProduccionFloatingWindow
                  proyectoId={selectedProyecto?.id ?? null}
                  capa={selectedCapaName}
                  initialPosition={{ x: 900, y: 20 }}
                  initialSize={{ width: 520, height: 500 }}
                  isActive={activeWindow === "tabla"}
                  onFocus={() => setActiveWindow("tabla")}
                  onClose={() => setShowWindowTabla(false)}
                />
              )}
            </div>
          </div>
        )}
      </AppLayout>

      <SelectProjectModal
        isOpen={isSelectProjectModalOpen}
        onClose={() => setIsSelectProjectModalOpen(false)}
        proyectos={proyectos}
        loading={loading}
        error={error}
        onSelect={handleSelectProyecto}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreated={async () => {
          await fetchProyectos();
          setIsNewProjectModalOpen(false);
        }}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

export default App;
