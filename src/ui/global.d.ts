// src/ui/global.d.ts
export {};

declare global {
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
}
