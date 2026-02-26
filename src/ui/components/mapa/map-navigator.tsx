// src/ui/components/mapa/map-navigator.tsx
import * as React from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import "./map-navigator.css";

type MapNavigatorProps = {
  showNavigator: boolean;

  showMapa: boolean;
  showPozos: boolean;
  showElipses: boolean;

  toggleMapa: () => void;
  togglePozos: () => void;
  toggleElipses: () => void;

  // ✅ opcional: lista dinámica (viene de elipses)
  elipseVariables?: string[];

  // ✅ opcional: si querés elegir “variable activa” desde el nav
  selectedElipsesVar?: string;
  onChangeElipsesVar?: (value: string) => void;
};

type VariableGroupProps = {
  label: string;
  isOpen: boolean;
  onToggleOpen: () => void;

  checked: boolean;
  onToggleChecked: () => void;

  options?: string[];
  selected?: string;
  onSelect?: (value: string) => void;

  disabled?: boolean;
};

function VariableGroup({
  label,
  isOpen,
  onToggleOpen,
  checked,
  onToggleChecked,
  options = [],
  selected,
  onSelect,
  disabled = false,
}: VariableGroupProps) {
  const hasOptions = options.length > 0 && !!onSelect;

  return (
    <div className="nav__group">
      <div
        className={[
          "nav__row",
          "nav__row--hover",
          disabled ? "is-disabled" : "",
        ].join(" ")}
      >
        <input
          type="checkbox"
          className="nav__checkbox"
          checked={checked}
          onChange={() => !disabled && onToggleChecked()}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={() => !disabled && onToggleOpen()}
          className="nav__toggleBtn"
          disabled={disabled}
        >
          <span className="nav__label">{label}</span>
          {isOpen ? (
            <FaChevronDown className="nav__chev" />
          ) : (
            <FaChevronRight className="nav__chev" />
          )}
        </button>
      </div>

      {isOpen && hasOptions && (
        <div className="nav__submenu">
          <div className="nav__tree">
            <div className="nav__treeLine" />
            <div className="nav__options">
              {options.map((opt) => (
                <label key={opt} className="nav__option nav__row--hover">
                  <input
                    type="checkbox"
                    className="nav__checkbox"
                    checked={selected === opt}
                    onChange={() => onSelect?.(opt)}
                  />
                  <span className="nav__optionText">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapNavigator({
  showNavigator,

  showMapa,
  showPozos,
  showElipses,

  toggleMapa,
  togglePozos,
  toggleElipses,

  elipseVariables = [],

  selectedElipsesVar,
  onChangeElipsesVar,
}: MapNavigatorProps) {
  const [isGeneralOpen, setIsGeneralOpen] = React.useState(true);

  const [isMapasOpen, setIsMapasOpen] = React.useState(true);
  const [isPozosOpen, setIsPozosOpen] = React.useState(true);
  const [isElipsesOpen, setIsElipsesOpen] = React.useState(true);

  if (!showNavigator) return null;

  const hasElipsesVars = (elipseVariables?.length ?? 0) > 0;
  const canSelectElipsesVar = !!onChangeElipsesVar && hasElipsesVars;

  return (
    <aside className="nav" aria-label="Navegador del mapa">
      <button
        type="button"
        onClick={() => setIsGeneralOpen((v) => !v)}
        className="nav__sectionBtn nav__row--hover"
      >
        <span className="nav__sectionTitle">General</span>
        {isGeneralOpen ? (
          <FaChevronDown className="nav__chev" />
        ) : (
          <FaChevronRight className="nav__chev" />
        )}
      </button>

      {isGeneralOpen && (
        <div className="nav__content">
          <VariableGroup
            label="Mapa"
            isOpen={isMapasOpen}
            onToggleOpen={() => setIsMapasOpen((v) => !v)}
            checked={showMapa}
            onToggleChecked={toggleMapa}
            // v2: sin opciones hardcodeadas
            options={[]}
            disabled={false}
          />

          <VariableGroup
            label="Pozos"
            isOpen={isPozosOpen}
            onToggleOpen={() => setIsPozosOpen((v) => !v)}
            checked={showPozos}
            onToggleChecked={togglePozos}
            options={[]}
            disabled={false}
          />

          <VariableGroup
            label="Elipses"
            isOpen={isElipsesOpen}
            onToggleOpen={() => setIsElipsesOpen((v) => !v)}
            checked={showElipses}
            onToggleChecked={toggleElipses}
            options={canSelectElipsesVar ? elipseVariables : []}
            selected={selectedElipsesVar}
            onSelect={onChangeElipsesVar}
            disabled={false}
          />

          {/* Hint liviano si querés seleccionar variable pero no hay data */}
          {!!onChangeElipsesVar && !hasElipsesVars && (
            <div className="nav__hint">
              No hay variables de elipses disponibles para esta capa.
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
