export type ProduccionPozo = {
  id: string;
  nombre: string;
  x: number;
  y: number;

  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  agua_iny: number | null;
};
