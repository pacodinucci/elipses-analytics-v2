import React from "react";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="elipsesOpt__h11">{children}</div>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <div className="elipsesOpt__p10">{children}</div>;
}

export const IconFill = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M4 20h16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M7 10l5-5 5 5-5 5-5-5z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconContour = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect
      x="5"
      y="5"
      width="14"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export const IconAxis = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M5 19L19 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M7 5h12v12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function toHexColor(v: unknown, fallback = "#000000"): string {
  if (typeof v !== "string") return fallback;

  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;

  return fallback;
}

export function toNumberOrNull(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const v = Number(s.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return v;
}
