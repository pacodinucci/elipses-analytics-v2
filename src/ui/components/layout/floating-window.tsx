// src/components/layout/floating-window.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./floating-window.css";

type Position = { x: number; y: number };
type Size = { width: number; height: number };

type FloatingWindowProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  initialPosition?: Position;
  initialSize?: Size;
  isActive?: boolean;
  onFocus?: () => void;

  // ancho adicional dinámico
  extraWidth?: number;

  // ✅ NUEVO: footer opcional (barra inferior)
  footer?: ReactNode;
};

type DragState = {
  mouseX: number;
  mouseY: number;
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

const VIEWPORT_MARGIN = 16;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 160;
const FOOTER_HEIGHT = 28;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getViewportSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function FloatingWindow({
  title,
  children,
  onClose,
  initialPosition = { x: 40, y: 40 },
  initialSize = { width: 500, height: 320 },
  isActive = false,
  onFocus,
  extraWidth,
  footer, // ✅
}: FloatingWindowProps) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const dragStateRef = useRef<DragState>(null);
  const lastExtraWidthRef = useRef(0);

  // Clamp inicial para que no nazca fuera del viewport o más grande que la pantalla
  useEffect(() => {
    const { w: vpW, h: vpH } = getViewportSize();

    const nextWidth = clamp(
      size.width,
      MIN_WIDTH,
      Math.max(MIN_WIDTH, vpW - VIEWPORT_MARGIN),
    );
    const nextHeight = clamp(
      size.height,
      MIN_HEIGHT,
      Math.max(MIN_HEIGHT, vpH - VIEWPORT_MARGIN),
    );

    const maxX = Math.max(0, vpW - nextWidth - VIEWPORT_MARGIN);
    const maxY = Math.max(0, vpH - nextHeight - VIEWPORT_MARGIN);

    const nextX = clamp(position.x, 0, maxX);
    const nextY = clamp(position.y, 0, maxY);

    if (nextWidth !== size.width || nextHeight !== size.height) {
      setSize({ width: nextWidth, height: nextHeight });
    }
    if (nextX !== position.x || nextY !== position.y) {
      setPosition({ x: nextX, y: nextY });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentExtra = extraWidth ?? 0;
    const prevExtra = lastExtraWidthRef.current;

    const diff = currentExtra - prevExtra;
    if (diff !== 0) {
      const { w: vpW } = getViewportSize();

      setSize((prev) => {
        const nextWidth = prev.width + diff;
        const maxWidth = Math.max(
          MIN_WIDTH,
          vpW - position.x - VIEWPORT_MARGIN,
        );
        return { ...prev, width: clamp(nextWidth, MIN_WIDTH, maxWidth) };
      });

      lastExtraWidthRef.current = currentExtra;
    }
  }, [extraWidth, position.x]);

  const handleHeaderMouseDown = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault();
    setDragging(true);
    dragStateRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    };
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    onFocus?.();
    dragStateRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    };
  };

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const dx = e.clientX - state.mouseX;
      const dy = e.clientY - state.mouseY;

      const { w: vpW, h: vpH } = getViewportSize();

      if (dragging) {
        const maxX = Math.max(0, vpW - state.width - VIEWPORT_MARGIN);
        const maxY = Math.max(0, vpH - state.height - VIEWPORT_MARGIN);

        const nextX = clamp(state.x + dx, 0, maxX);
        const nextY = clamp(state.y + dy, 0, maxY);

        setPosition({ x: nextX, y: nextY });
      }

      if (resizing) {
        const maxWidth = Math.max(MIN_WIDTH, vpW - state.x - VIEWPORT_MARGIN);
        const maxHeight = Math.max(MIN_HEIGHT, vpH - state.y - VIEWPORT_MARGIN);

        const nextWidth = clamp(state.width + dx, MIN_WIDTH, maxWidth);
        const nextHeight = clamp(state.height + dy, MIN_HEIGHT, maxHeight);

        setSize({ width: nextWidth, height: nextHeight });

        const maxX = Math.max(0, vpW - nextWidth - VIEWPORT_MARGIN);
        const maxY = Math.max(0, vpH - nextHeight - VIEWPORT_MARGIN);

        setPosition((prev) => ({
          x: clamp(prev.x, 0, maxX),
          y: clamp(prev.y, 0, maxY),
        }));
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, resizing]);

  const handleMouseDown = () => {
    onFocus?.();
  };

  return (
    <div
      className={`floatingWindow ${isActive ? "floatingWindow--active" : ""}`}
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="floatingWindow__header"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="floatingWindow__title" title={title}>
          {title}
        </span>

        <button
          type="button"
          onClick={onClose}
          className="floatingWindow__close"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="floatingWindow__body">{children}</div>

      {/* ✅ Barra inferior fija (zona “segura” + futura info) */}
      <div className="floatingWindow__footer" style={{ height: FOOTER_HEIGHT }}>
        {footer ?? null}
      </div>

      {/* ✅ Handle arriba de todo y clickeable */}
      <div
        className="floatingWindow__resizeHandle"
        onMouseDown={handleResizeMouseDown}
        aria-hidden="true"
      />
    </div>
  );
}
