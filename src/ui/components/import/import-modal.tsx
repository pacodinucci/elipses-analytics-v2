// src/components/import/import-modal.tsx
import { useEffect, useMemo, useState } from "react";
import {
  OptionsShellModal,
  type OptionsNavItem,
} from "../mapa/options-shell-modal";
import { TbFileImport, TbDatabase, TbInfoCircle } from "react-icons/tb";
import "./import-modal.css";

import { useSelectionStore } from "../../store/selection-store";
import { invalidateCapasCache } from "../../hooks/use-capas";

type TabKey = "capas" | "maps" | "database" | "help";
type ImportKind = "capas" | "maps";

export type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// v2: resultado genérico (no acoplamos types del backend todavía)
type ImportJobResultUI = any;

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const proyectoId = useSelectionStore((s) => s.selectedProyectoId);

  const items = useMemo<OptionsNavItem<TabKey>[]>(
    () => [
      {
        key: "capas",
        title: "Capas",
        subtitle: "Import TXT",
        icon: <TbFileImport />,
      },
      {
        key: "maps",
        title: "Maps",
        subtitle: "Import rows (JSON)",
        icon: <TbFileImport />,
      },
      {
        key: "database",
        title: "Resultado",
        subtitle: "Último job",
        icon: <TbDatabase />,
      },
      {
        key: "help",
        title: "Ayuda",
        subtitle: "Formato esperado",
        icon: <TbInfoCircle />,
      },
    ],
    [],
  );

  const [activeKey, setActiveKey] = useState<TabKey>("capas");

  // Inputs
  const [capasTxt, setCapasTxt] = useState<string>("");
  const [mapsJson, setMapsJson] = useState<string>("");

  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [lastKind, setLastKind] = useState<ImportKind>("capas");
  const [lastDryRun, setLastDryRun] = useState<ImportJobResultUI | null>(null);
  const [lastCommit, setLastCommit] = useState<ImportJobResultUI | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setActiveKey("capas");
    setCapasTxt("");
    setMapsJson("");
    setIsRunning(false);
    setError(null);

    setLastKind("capas");
    setLastDryRun(null);
    setLastCommit(null);
  }, [isOpen]);

  const kind: ImportKind = activeKey === "maps" ? "maps" : "capas";

  const panelTitle =
    activeKey === "capas"
      ? "Importar Capas"
      : activeKey === "maps"
        ? "Importar Maps"
        : activeKey === "database"
          ? "Resultado"
          : "Ayuda y formato";

  const panelSubtitle =
    activeKey === "capas" ? (
      <>Import TXT de capas (dry-run / commit) por proyecto.</>
    ) : activeKey === "maps" ? (
      <>Import de mapas por filas (pegá JSON del payload) (dry-run / commit).</>
    ) : activeKey === "database" ? (
      <>Últimos resultados del dry-run y del commit.</>
    ) : (
      <>Formato esperado según el tipo de importación.</>
    );

  const canRunCapas = !!proyectoId && !!capasTxt.trim() && !isRunning;
  const canRunMaps = !!proyectoId && !!mapsJson.trim() && !isRunning;

  const canRun = kind === "capas" ? canRunCapas : canRunMaps;

  const handleDryRun = async () => {
    setError(null);

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastDryRun(null);

      if (kind === "capas") {
        const res = await window.electron.importCapasDryRun({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastDryRun(res);
        setActiveKey("database");
      } else {
        // maps: JSON payload (sin proyectoId) -> merge
        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          return;
        }

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsDryRun(payload as any);

        setLastDryRun(res);
        setActiveKey("database");
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCommit = async () => {
    setError(null);

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastCommit(null);

      if (kind === "capas") {
        const res = await window.electron.importCapasCommit({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastCommit(res);

        // ✅ importante: refrescar capas en UI
        invalidateCapasCache(proyectoId);

        setActiveKey("database");
      } else {
        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          return;
        }

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsCommit(payload as any);

        setLastCommit(res);
        setActiveKey("database");
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => onClose();

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      title="Importar"
      onClose={handleClose}
      items={items}
      activeKey={activeKey}
      onChangeKey={setActiveKey}
      widthClassName="osm__wDefault"
      heightClassName="osm__hDefault"
      sidebarWidthClassName="osm__gridDefault"
      panelTitle={panelTitle}
      panelSubtitle={panelSubtitle}
      footer={
        <div className="importModal__footer">
          <button
            className="osm__footerBtn"
            onClick={handleClose}
            type="button"
          >
            Cerrar
          </button>

          <div style={{ flex: 1 }} />

          {activeKey === "capas" || activeKey === "maps" ? (
            <>
              <button
                className="osm__footerBtn"
                onClick={handleDryRun}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Dry-run"}
              </button>

              <button
                className="osm__footerBtn"
                onClick={handleCommit}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Commit"}
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {activeKey === "capas" ? (
        <CapasTab
          proyectoId={proyectoId}
          value={capasTxt}
          setValue={setCapasTxt}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "maps" ? (
        <MapsTab
          proyectoId={proyectoId}
          value={mapsJson}
          setValue={setMapsJson}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "database" ? (
        <DatabaseTab
          proyectoId={proyectoId}
          lastKind={lastKind}
          lastDryRun={lastDryRun}
          lastCommit={lastCommit}
          error={error}
        />
      ) : null}

      {activeKey === "help" ? <HelpTab /> : null}
    </OptionsShellModal>
  );
}

function CapasTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Pegá el TXT de capas en el textarea y ejecutá <b>Dry-run</b> o{" "}
          <b>Commit</b>.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">TXT de capas</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder="Pegá acá el contenido TXT..."
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function MapsTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Pegá un <b>JSON</b> con el payload de Maps (sin{" "}
          <code>proyectoId</code>
          ). El modal lo agrega automáticamente.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Payload JSON (Maps)</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder={`Ejemplo (ajustá a tu MapImportPayload real):
{
  "rows": [
    { "capaId": "…", "grupoVariableId": "…", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function DatabaseTab(props: {
  proyectoId: string | null;
  lastKind: "capas" | "maps";
  lastDryRun: any | null;
  lastCommit: any | null;
  error: string | null;
}) {
  const { proyectoId, lastKind, lastDryRun, lastCommit, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Contexto</div>

        <div className="importModal__p">
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span style={{ opacity: 0.7 }}>(no seleccionado)</span>
          )}
        </div>

        <div className="importModal__p">
          <b>Último tipo:</b> <code>{lastKind}</code>
        </div>
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}

      <div className="importModal__box">
        <div className="importModal__boxTitle">Dry-run</div>
        {lastDryRun ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastDryRun, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">
            Todavía no ejecutaste dry-run.
          </div>
        )}
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Commit</div>
        {lastCommit ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastCommit, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">Todavía no ejecutaste commit.</div>
        )}
      </div>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Capas (TXT)</div>

        <div className="importModal__p">
          Pegá el TXT completo tal como lo consumen tus importers v2. Ejemplo
          genérico:
        </div>

        <pre className="importModal__pre">{`CAPA\tALIAS\t...
ACU-MO5\tAcuifero Mo5\t...
MOL-01\tMolasa 01\t...`}</pre>

        <div className="importModal__p" style={{ opacity: 0.85 }}>
          El formato exacto depende del importer de v2. Si me pasás el parser de
          `importCapas*` te dejo el ejemplo 100% correcto.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Maps (JSON payload)</div>

        <div className="importModal__p">
          En v2 el import de maps viene “por filas”. Desde UI lo más estable es
          pegar un JSON con el payload.
        </div>

        <pre className="importModal__pre">{`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}</pre>
      </div>
    </div>
  );
}
