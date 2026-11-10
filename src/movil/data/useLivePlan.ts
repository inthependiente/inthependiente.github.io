import { useMemo } from 'react';
import type { LlamadoData, PdrRow } from '../types';
import { computePlan, type Plan, type RowInput } from '../lib/timing';
import { useNow } from './useNow';

/**
 * Una fila de PDR vista por el motor de tiempos.
 * `status` es "terminada" y `inicio_reg` guarda el instante de CIERRE
 * (la columna conserva el nombre por compatibilidad con la app iOS).
 */
function toRowInput(fila: PdrRow): RowInput {
  const cierre = fila.inicio_reg?.trim() || null;
  return {
    id: fila.id,
    order: fila.orden ?? 0,
    plannedDurationMinutes: fila.duracion_min ?? 0,
    isCompleted: fila.status ?? Boolean(cierre),
    completedAt: cierre,
  };
}

/** Plan de tiempos en vivo, recalculado cada segundo mientras el modo está activo. */
export function useLivePlan(data: LlamadoData, activo = true): { plan: Plan; now: number } {
  const now = useNow(activo ? 1000 : null);

  const plan = useMemo(
    () =>
      computePlan({
        rows: (data.pdr ?? []).map(toRowInput),
        date: data.llamado.fecha,
        callTime: data.llamado.llamado_hora,
        timeZone: data.llamado.proyectos?.zona_horaria ?? null,
        now,
      }),
    [data, now],
  );

  return { plan, now };
}
