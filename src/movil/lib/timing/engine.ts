import type { Plan, PlanInput, RowInput, RowProjection, Status, Warning } from './types';
import {
  parseAbsolute,
  parseDateOnly,
  parseTimeOfDay,
  resolveTimeZone,
  wallClock,
  zonedToInstant,
  type DateOnly,
  type TimeOfDay,
} from './time';

export const DEFAULT_TOLERANCE_MINUTES = 2;
/** Distancia desde la que un cierre con hora suelta se asume del día siguiente. */
export const MIDNIGHT_TOLERANCE_MS = 6 * 3600 * 1000;
/** Margen para no marcar como futura una hora recién registrada. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_CALL_HOUR = 8;

interface ResolvedCall {
  instant: number;
  usedDefaultTime: boolean;
}

/**
 * Instante del llamado: combina fecha (YYYY-MM-DD) y hora (HH:mm) en la zona.
 * Sin fecha válida usa el día de `now`; sin hora válida usa 08:00 y lo reporta.
 */
export function resolveCalledAt({
  date,
  callTime,
  timeZone,
  now,
}: {
  date: string | null;
  callTime: string | null;
  timeZone: string;
  now: number;
}): ResolvedCall {
  const parsedDate = parseDateOnly(date);
  const day = parsedDate ?? wallClock(now, timeZone);
  const time = parseTimeOfDay(callTime);

  const instant = zonedToInstant(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: time?.hour ?? DEFAULT_CALL_HOUR,
      minute: time?.minute ?? 0,
      second: 0,
    },
    timeZone,
  );

  return { instant, usedDefaultTime: time === null };
}

function shiftDay(day: DateOnly, time: TimeOfDay, days: number, timeZone: string): number {
  const probe = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return zonedToInstant(
    {
      year: probe.getUTCFullYear(),
      month: probe.getUTCMonth() + 1,
      day: probe.getUTCDate(),
      hour: time.hour,
      minute: time.minute,
      second: time.second,
    },
    timeZone,
  );
}

/**
 * Instante de cierre de una fila.
 * Acepta un timestamp absoluto o una hora suelta anclada al día del llamado;
 * si la hora suelta cae más de 6 h antes del llamado, se asume el día siguiente.
 */
export function parseCompletion(
  raw: string | null | undefined,
  calledAt: number,
  timeZone: string,
): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // La presencia de "T" o "-" indica valor absoluto; una hora suelta nunca los lleva.
  if (trimmed.includes('T') || trimmed.includes('-')) return parseAbsolute(trimmed, timeZone);

  const time = parseTimeOfDay(trimmed);
  if (!time) return null;

  const day = wallClock(calledAt, timeZone);
  const sameDay = zonedToInstant({ ...day, ...time }, timeZone);
  if (sameDay < calledAt && calledAt - sameDay > MIDNIGHT_TOLERANCE_MS) {
    return shiftDay(day, time, 1, timeZone);
  }
  return sameDay;
}

function dayKey(instantMs: number, timeZone: string): string {
  const wall = wallClock(instantMs, timeZone);
  const month = String(wall.month).padStart(2, '0');
  const day = String(wall.day).padStart(2, '0');
  return `${String(wall.year).padStart(4, '0')}-${month}-${day}`;
}

/** Plan completo: situación, desvío, proyección por fila y avisos de datos. */
export function computePlan({
  rows,
  date,
  callTime,
  timeZone,
  now,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
}: PlanInput): Plan {
  const tz = resolveTimeZone(timeZone);
  const called = resolveCalledAt({ date, callTime, timeZone: tz, now });
  const tolerance = Math.max(0, toleranceMinutes) * 60_000;

  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const inputs = sorted.map((row: RowInput) => {
    const raw = typeof row.completedAt === 'string' ? row.completedAt.trim() : '';
    const isCompleted = Boolean(row.isCompleted);
    const completedAt = isCompleted ? parseCompletion(row.completedAt, called.instant, tz) : null;
    return {
      id: row.id,
      order: row.order,
      durationMs: (Number.isFinite(row.plannedDurationMinutes) ? row.plannedDurationMinutes : 0) * 60_000,
      isCompleted,
      completedAt,
      parseFailed: isCompleted && raw !== '' && completedAt === null,
    };
  });

  const starts: number[] = [];
  const ends: number[] = [];
  let cursor = 0;
  for (const row of inputs) {
    starts.push(cursor);
    cursor += row.durationMs;
    ends.push(cursor);
  }
  const plannedTotalEnd = called.instant + cursor;

  const warnings: Warning[] = [];
  if (called.usedDefaultTime) warnings.push('defaultCalledTime');
  if (new Set(inputs.map((row) => row.order)).size !== inputs.length) warnings.push('duplicateOrder');
  if (inputs.some((row) => row.parseFailed)) warnings.push('unreadableCompletion');
  if (inputs.some((row) => row.completedAt !== null && row.completedAt < called.instant - MIDNIGHT_TOLERANCE_MS)) {
    warnings.push('completionBeforeCalled');
  }
  if (inputs.some((row) => row.completedAt !== null && row.completedAt > now + FUTURE_TOLERANCE_MS)) {
    warnings.push('completionInFuture');
  }

  let lastCompletedIndex = -1;
  inputs.forEach((row, index) => {
    if (row.isCompleted) lastCompletedIndex = index;
  });
  const firstPendingIndex = inputs.findIndex((row) => !row.isCompleted);
  if (lastCompletedIndex !== -1 && firstPendingIndex !== -1 && firstPendingIndex < lastCompletedIndex) {
    warnings.push('pendingBeforeCompleted');
  }

  // La toma activa es la primera pendiente, en el orden del plan.
  const activeIndex = firstPendingIndex;

  const rowsOut: RowProjection[] = [];
  let previousProjectedEnd = called.instant;
  let lastKnownCompletion: number | null = null;

  inputs.forEach((row, index) => {
    const plannedStart = called.instant + starts[index];
    const plannedEnd = called.instant + ends[index];
    let projectedStart = plannedStart;
    let projectedEnd = plannedEnd;
    let realStart: number | null = null;
    let realDuration: number | null = null;
    let deviation: number | null = null;
    let isActive = false;

    if (row.isCompleted) {
      if (row.completedAt !== null) {
        const anchor = lastKnownCompletion ?? called.instant;
        realStart = anchor;
        realDuration = Math.max(0, row.completedAt - anchor);
        projectedStart = row.completedAt;
        projectedEnd = row.completedAt;
        deviation = row.completedAt - plannedEnd;
        lastKnownCompletion = row.completedAt;
      }
      // Terminada sin cierre legible: conserva la ventana planificada.
    } else if (index === activeIndex) {
      isActive = true;
      const anchor = lastKnownCompletion ?? called.instant;
      realStart = anchor;
      projectedStart = anchor;
      // El fin estimado nunca queda en el pasado.
      projectedEnd = Math.max(anchor + row.durationMs, now);
      deviation = projectedEnd - plannedEnd;
    } else {
      projectedStart = previousProjectedEnd;
      projectedEnd = previousProjectedEnd + row.durationMs;
    }
    previousProjectedEnd = projectedEnd;

    rowsOut.push({
      id: row.id,
      order: row.order,
      plannedStart,
      plannedEnd,
      projectedStart,
      projectedEnd,
      realStart,
      completedAt: row.completedAt,
      realDuration,
      deviation,
      isActive,
      isCompleted: row.isCompleted,
    });
  });

  const calledDay = dayKey(called.instant, tz);
  const todayDay = dayKey(now, tz);
  const activeRow = rowsOut.find((row) => row.isActive) ?? null;
  const completions = inputs
    .map((row) => row.completedAt)
    .filter((value): value is number => value !== null);

  let situation: Status['situation'];
  if (inputs.length === 0) situation = 'noPlan';
  else if (calledDay > todayDay) situation = 'scheduled';
  else if (calledDay < todayDay && completions.length === 0 && now > plannedTotalEnd + tolerance) {
    situation = 'concludedDay';
  } else if (now < called.instant) situation = 'notStarted';
  else if (activeIndex !== -1) situation = 'inProgress';
  else if (completions.length > 0) situation = 'finished';
  else situation = 'finishedWithoutCompletion';

  let deviation: number | null = null;
  let minutesUntilStart: number | null = null;
  if (situation === 'inProgress') deviation = activeRow?.deviation ?? null;
  else if (situation === 'finished') deviation = Math.max(...completions) - plannedTotalEnd;
  else if (situation === 'notStarted') {
    minutesUntilStart = Math.ceil((called.instant - now) / 60_000);
  }

  const status: Status = {
    situation,
    deviation,
    tolerance,
    isOnTime: deviation === null ? true : Math.abs(deviation) <= tolerance,
    activeRowId: activeRow?.id ?? null,
    activeStartedAt: activeRow?.realStart ?? null,
    minutesUntilStart,
    calledDay,
  };

  return {
    calledAt: called.instant,
    plannedEnd: plannedTotalEnd,
    projectedEnd: rowsOut.length ? rowsOut[rowsOut.length - 1].projectedEnd : called.instant,
    timeZone: tz,
    status,
    rows: rowsOut,
    warnings,
  };
}
