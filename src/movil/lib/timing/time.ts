/**
 * Hora de pared ↔ instante absoluto, sin dependencias.
 *
 * Usa `Intl.DateTimeFormat` en dos pasadas para resolver los bordes de los
 * cambios de horario de verano. Todas las comparaciones se hacen con instantes.
 */

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TimeOfDay {
  hour: number;
  minute: number;
  second: number;
}

export interface DateOnly {
  year: number;
  month: number;
  day: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Zona válida o, en su defecto, la del entorno. */
export function resolveTimeZone(timeZone?: string | null): string {
  const candidate = (timeZone ?? '').trim();
  if (candidate) {
    try {
      partsFormatter(candidate);
      return candidate;
    } catch {
      // Zona inválida: se usa la del entorno.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Partes de calendario (en la zona indicada) de un instante. */
export function wallClock(instantMs: number, timeZone: string): WallClock {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(instantMs))) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const wall = wallClock(instantMs, timeZone);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - instantMs;
}

/** Convierte una hora de pared de la zona al instante correspondiente. */
export function zonedToInstant(
  wall: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): number {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0);
  const firstPass = naive - zoneOffsetMs(naive, timeZone);
  // Segunda pasada: corrige los bordes de cambio de horario de verano.
  return naive - zoneOffsetMs(firstPass, timeZone);
}

/** "HH:mm" o "HH:mm:ss" → { hour, minute, second } | null */
export function parseTimeOfDay(raw: string | null | undefined): TimeOfDay | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  const second = parts.length === 3 ? Number(parts[2]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

/** "YYYY-MM-DD" → { year, month, day } | null (rechaza fechas inexistentes). */
export function parseDateOnly(raw: string | null | undefined): DateOnly | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

const ABSOLUTE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Instante ISO (con o sin offset) o fecha sola, interpretada en la zona. */
export function parseAbsolute(raw: string, timeZone: string): number | null {
  const match = ABSOLUTE_RE.exec(raw);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw = '0', minuteRaw = '0', secondRaw = '0', , offset] = match;
  if (parseDateOnly(`${yearRaw}-${monthRaw}-${dayRaw}`) === null) return null;

  const wall = {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
    second: Number(secondRaw),
  };
  if (wall.hour > 23 || wall.minute > 59 || wall.second > 59) return null;

  if (!offset) return zonedToInstant(wall, timeZone);

  const utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  if (offset === 'Z') return utc;

  const sign = offset[0] === '-' ? -1 : 1;
  const digits = offset.slice(1).replace(':', '');
  const offsetMs = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000;
  return utc - offsetMs;
}
