// src/components/mapa/options-shell-modal.tsx
import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";
import "./options-shell-modal.css";

export type OptionsNavItem<K extends string> = {
  key: K;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

function DefaultNavItem({
  active,
  title,
  subtitle,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={["osm__navItem", active ? "is-active" : ""].join(" ")}
    >
      <div className="osm__navItemInner">
        <div className="osm__navIconWrap">
          <div
            className={["osm__navAccent", active ? "is-active" : ""].join(" ")}
          />
          <div className="osm__navIcon">
            {icon ?? <div className="osm__navIconFallback" />}
          </div>
        </div>

        <div className="osm__navText">
          <div className="osm__navTitle">{title}</div>
          {subtitle ? <div className="osm__navSubtitle">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}

export type OptionsShellModalProps<K extends string> = {
  isOpen: boolean;
  title: string;
  onClose: () => void;

  items: OptionsNavItem<K>[];
  activeKey: K;
  onChangeKey: (key: K) => void;

  widthClassName?: string;
  heightClassName?: string;
  sidebarWidthClassName?: string;

  // ✅ v2: aceptar string o JSX
  panelTitle?: React.ReactNode;
  panelSubtitle?: React.ReactNode;
  children: React.ReactNode;

  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
};

export function OptionsShellModal<K extends string>({
  isOpen,
  title,
  onClose,

  items,
  activeKey,
  onChangeKey,

  widthClassName = "osm__wDefault",
  heightClassName = "osm__hDefault",
  sidebarWidthClassName = "osm__gridDefault",

  panelTitle,
  panelSubtitle,
  children,

  headerRight,
  footer,
}: OptionsShellModalProps<K>) {
  // ✅ ESC para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ✅ click afuera para cerrar
  const onOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="osm__overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={onOverlayMouseDown}
    >
      <div
        className={["osm__modal", widthClassName, heightClassName].join(" ")}
      >
        <div className="osm__frame">
          <header className="osm__header">
            <div className="osm__headerLeft">
              <div className="osm__headerTitle">{title}</div>
              {headerRight ? (
                <div className="osm__headerRight">{headerRight}</div>
              ) : null}
            </div>

            <button
              className="osm__closeBtn"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
              type="button"
            >
              <IoClose />
            </button>
          </header>

          <div className={["osm__bodyGrid", sidebarWidthClassName].join(" ")}>
            <aside className="osm__sidebar">
              <div className="osm__sidebarCaption">Secciones</div>
              <div className="osm__sidebarList">
                {items.map((it) => (
                  <DefaultNavItem
                    key={it.key}
                    active={it.key === activeKey}
                    title={it.title}
                    subtitle={it.subtitle}
                    icon={it.icon}
                    onClick={() => onChangeKey(it.key)}
                  />
                ))}
              </div>
            </aside>

            <main className="osm__panel">
              <div className="osm__panelScroll">
                {panelTitle ? (
                  <div className="osm__panelHead">
                    <div className="osm__panelTitle">{panelTitle}</div>
                    {panelSubtitle ? (
                      <div className="osm__panelSubtitle">{panelSubtitle}</div>
                    ) : null}
                    <div className="osm__divider" />
                  </div>
                ) : null}

                {children}
              </div>

              <div className="osm__footer">
                {footer ?? (
                  <button
                    className="osm__footerBtn"
                    onClick={onClose}
                    type="button"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
