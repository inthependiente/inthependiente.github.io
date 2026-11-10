const FORMATO_FECHA = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
});

/** Convierte '2026-10-30' en una fecha local (evita el corrimiento de zona horaria). */
export function parseFecha(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatFechaLarga(value?: string | null): string | null {
  const fecha = parseFecha(value);
  return fecha ? FORMATO_FECHA.format(fecha) : null;
}

export function formatFechaCorta(value?: string | null): string | null {
  const fecha = parseFecha(value);
  return fecha ? FORMATO_FECHA_CORTA.format(fecha).replace(/\./g, '') : null;
}

/** Normaliza '7:30', '07:30:00' o '7:30 pm' a '07:30'. */
export function normalizarHora(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = /^(\d{1,2})[:.](\d{2})/.exec(raw);
  if (!match) return raw.length <= 12 ? raw : null;

  let horas = Number(match[1]);
  const minutos = match[2];
  const esPm = /pm/i.test(raw);
  const esAm = /am/i.test(raw);

  if (esPm && horas < 12) horas += 12;
  if (esAm && horas === 12) horas = 0;
  if (horas > 23) return null;

  return `${String(horas).padStart(2, '0')}:${minutos}`;
}

export function minutosDeHora(value?: string | null): number | null {
  const hora = normalizarHora(value);
  if (!hora) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHoraDeIso(iso?: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
}

export function formatFechaHoraDeIso(iso?: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primera = partes[0][0] ?? '';
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : '';
  return (primera + segunda).toUpperCase();
}

export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
