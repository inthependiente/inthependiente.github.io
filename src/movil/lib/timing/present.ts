import { wallClock } from './time';
import type { Plan, Status, Warning } from './types';

/** Tipo semántico del estado; el color de la UI sale de aquí, nunca del texto. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'danger';

/** Minutos con redondeo al más cercano, alejándose de cero en el .5. */
export function toMinutes(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined) return null;
  const value = ms / 60_000;
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** "HH:mm" en la zona dada, redondeando al minuto más cercano. */
export function formatClock(instantMs: number, timeZone: string): string {
  const wall = wallClock(instantMs + 30_000, timeZone);
  return `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}`;
}

/** "2026-11-12" → "12/11". */
export function formatDayKey(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

function pluralMinutes(n: number): string {
  const abs = Math.abs(n);
  return abs === 1 ? '1 MINUTO' : `${abs} MINUTOS`;
}

/** Texto canónico del estado (§9.2 de la especificación). */
export function statusText(status: Status): string {
  switch (status.situation) {
    case 'noPlan':
      return 'SIN PLANOS CARGADOS';
    case 'scheduled':
      return `PROGRAMADO PARA ${formatDayKey(status.calledDay)}`;
    case 'concludedDay':
      return `CONCLUIDO: ${formatDayKey(status.calledDay)}`;
    case 'notStarted': {
      const remaining = status.minutesUntilStart ?? 0;
      return remaining <= 0 ? 'INICIA AHORA' : `INICIA EN ${pluralMinutes(remaining)}`;
    }
    case 'inProgress': {
      if (status.deviation === null || status.isOnTime) return 'RODAJE A TIEMPO';
      const m = toMinutes(status.deviation) ?? 0;
      return `${pluralMinutes(m)} ${m > 0 ? 'ATRASADO' : 'ADELANTADO'}`;
    }
    case 'finished': {
      if (status.deviation === null) return 'RODAJE FINALIZADO';
      if (status.isOnTime) return 'FINALIZADO A TIEMPO';
      const m = toMinutes(status.deviation) ?? 0;
      return `FINALIZADO: ${pluralMinutes(m)} ${m > 0 ? 'ATRASADO' : 'ADELANTADO'}`;
    }
    case 'finishedWithoutCompletion':
      return 'FINALIZADO SIN HORA DE CIERRE';
    default:
      return '';
  }
}

/**
 * Texto del banner del modo "ver en vivo" del plan de rodaje.
 *
 * En curso usa la forma pedida por producción ("X MINUTOS ATRASADOS /
 * ADELANTADOS / A TIEMPO"); el resto de situaciones conserva el texto canónico.
 */
export function bannerCopy(status: Status): { eyebrow: string; headline: string } {
  switch (status.situation) {
    case 'inProgress': {
      const eyebrow = 'AL INICIAR EL PLANO ACTUAL VAMOS:';
      if (status.deviation === null || status.isOnTime) return { eyebrow, headline: 'A TIEMPO' };

      const m = toMinutes(status.deviation) ?? 0;
      const singular = Math.abs(m) === 1;
      const estado = m > 0 ? (singular ? 'ATRASADO' : 'ATRASADOS') : singular ? 'ADELANTADO' : 'ADELANTADOS';
      return { eyebrow, headline: `${pluralMinutes(m)} ${estado}` };
    }
    case 'notStarted': {
      const remaining = status.minutesUntilStart ?? 0;
      return {
        eyebrow: 'EL RODAJE AÚN NO COMIENZA',
        headline: remaining <= 0 ? 'INICIA AHORA' : `INICIA EN ${pluralMinutes(remaining)}`,
      };
    }
    case 'scheduled':
      return { eyebrow: 'PRÓXIMO RODAJE', headline: `PROGRAMADO PARA ${formatDayKey(status.calledDay)}` };
    case 'concludedDay':
      return { eyebrow: 'JORNADA CONCLUIDA', headline: `CONCLUIDO: ${formatDayKey(status.calledDay)}` };
    case 'finished':
      return { eyebrow: 'JORNADA FINALIZADA', headline: statusText(status) };
    case 'finishedWithoutCompletion':
      return { eyebrow: 'JORNADA FINALIZADA', headline: statusText(status) };
    case 'noPlan':
    default:
      return { eyebrow: 'PLAN DE RODAJE', headline: 'SIN PLANOS CARGADOS' };
  }
}

/** Color semántico derivado del estado tipado (§9.3). */
export function statusTone(status: Status): StatusTone {
  switch (status.situation) {
    case 'inProgress':
      if (status.deviation === null || status.isOnTime) return 'info';
      return status.deviation > 0 ? 'danger' : 'success';
    case 'finished':
      if (status.deviation === null) return 'neutral';
      return status.isOnTime || status.deviation < 0 ? 'success' : 'danger';
    case 'scheduled':
    case 'notStarted':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Minutos transcurridos de la toma activa (desde el ancla, no desde un botón). */
export function elapsedMinutes(plan: Plan, now: number): number | null {
  if (plan.status.situation !== 'inProgress' || plan.status.activeStartedAt === null) return null;
  return Math.max(0, Math.floor((now - plan.status.activeStartedAt) / 60_000));
}

export function warningText(warning: Warning): string {
  switch (warning) {
    case 'defaultCalledTime':
      return 'La hora de llamado no es válida; usamos las 08:00.';
    case 'duplicateOrder':
      return 'Hay planos con el mismo orden en el plan.';
    case 'pendingBeforeCompleted':
      return 'Hay un plano pendiente antes de uno terminado.';
    case 'completionBeforeCalled':
      return 'Hay una hora de cierre anterior al llamado.';
    case 'completionInFuture':
      return 'Hay una hora de cierre en el futuro.';
    case 'unreadableCompletion':
      return 'Hay un cierre que no pudimos interpretar.';
    default:
      return '';
  }
}
