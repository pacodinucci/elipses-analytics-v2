// src/hooks/use-proyectos.ts
import { useProyectosStore } from "../store/proyectos-store";

export function useProyectos() {
  const proyectos = useProyectosStore((s) => s.proyectos);
  const loading = useProyectosStore((s) => s.loading);
  const error = useProyectosStore((s) => s.error);
  const fetchProyectos = useProyectosStore((s) => s.fetchProyectos);
  const createProyecto = useProyectosStore((s) => s.createProyecto);

  return { proyectos, loading, error, fetchProyectos, createProyecto };
}
