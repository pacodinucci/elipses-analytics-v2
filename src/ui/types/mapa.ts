// src/types/ui/mapa.ts
import type { PozoEstado } from "../store/pozos-style";

export type PozoPoint = {
  id: string;
  nombre?: string;
  x: number;
  y: number;
  estado?: PozoEstado;
};

export type ElipseVariableSeries = Record<string, number | null>;
export type ElipseVariables = Record<string, ElipseVariableSeries>;

export type Elipse = {
  id_elipse: string;
  capa: string;
  inyector: string;
  productor: string;
  x: number[];
  y: number[];
  variables: ElipseVariables;
};
