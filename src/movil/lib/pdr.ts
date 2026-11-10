import type { PdrRow, Talento } from '../types';
import { minutosDeHora } from './format';

/** Planos que ocupan una fila completa: desayuno, almuerzo, armado, company move, cierre. */
export const PLANOS_ESPECIALES = ['ES', 'ED'];

export interface Referencia {
  url: string;
  alt: string;
}

export interface TimelineRow {
  id: number;
  orden: number;
  inicioMin: number;
  finMin: number;
  duracionMin: number;
  inicio: string;
  fin: string;
  escena: string | null;
  plano: string;
  descripcion: string;
  locacion: string | null;
  cast: { nombre: string; rol: string | null }[];
  notas: string | null;
  referencias: Referencia[];
  especial: boolean;
}

export interface Timeline {
  rows: TimelineRow[];
  inicio: string | null;
  fin: string | null;
  /** Cierre de la jornada: fin de la última fila de cierre, o el fin del plan. */
  cierre: string | null;
  cierreMin: number | null;
  totalMin: number;
  totalPlanos: number;
  locaciones: string[];
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Filas que marcan el final de la jornada: cierre de claqueta, cierre del día, wrap… */
const CIERRE_RE = /cierre|wrap|fin de jornada|final del d[ií]a/i;

export function esFilaCierre(row: Pick<TimelineRow, 'especial' | 'plano' | 'descripcion'>): boolean {
  return row.especial && CIERRE_RE.test(`${row.plano} ${row.descripcion}`);
}

/** Minutos desde el inicio del día → 'HH:MM' (se reinicia a las 24 h, como el llamado). */
export function formatMinutos(minutos: number): string {
  const normalizado = ((minutos % 1440) + 1440) % 1440;
  return `${dosDigitos(Math.floor(normalizado / 60))}:${dosDigitos(normalizado % 60)}`;
}

export function formatDuracion(minutos: number): string {
  if (minutos <= 0) return '—';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** Las referencias viven en shotlist.referencia_urls separadas por coma. */
export function parseReferencias(valor: string | null | undefined, alt: string): Referencia[] {
  if (!valor) return [];
  return valor
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt }));
}

/** Convierte '1, 2, 3' en personas del talento del llamado. */
function parseCast(valor: string | null | undefined, talento: Talento[]) {
  if (!valor) return [];
  const indexado = new Map<number, Talento>();

  for (const persona of talento) {
    const clave = persona.id_personaje ?? persona.id;
    if (!indexado.has(clave)) indexado.set(clave, persona);
  }

  return valor
    .split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => Number.isFinite(id))
    .map((id) => indexado.get(id))
    .filter((persona): persona is Talento => Boolean(persona))
    .map((persona) => ({ nombre: persona.nombre, rol: persona.rol }));
}

/**
 * Arma el cronograma del día sumando duraciones desde la hora de llamado,
 * igual que el PDR del llamado en PDF.
 */
export function buildTimeline(
  pdrRows: PdrRow[],
  talento: Talento[],
  llamadoHora: string | null | undefined,
): Timeline {
  const base = minutosDeHora(llamadoHora) ?? 0;
  let cursor = base;

  const ordenadas = [...pdrRows].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const rows: TimelineRow[] = [];
  const locaciones: string[] = [];

  for (const fila of ordenadas) {
    const shot = fila.shotlist;
    if (!shot) continue;

    const duracionMin = Math.max(0, fila.duracion_min ?? 0);
    const inicioMin = cursor;
    cursor += duracionMin;

    const plano = (shot.plano ?? '').trim().toUpperCase();
    const descripcion = (shot.descripcion ?? '').trim();
    const locacion = shot.locaciones?.locacion?.trim() || null;

    if (locacion && !locaciones.includes(locacion)) locaciones.push(locacion);

    rows.push({
      id: fila.id,
      orden: fila.orden ?? rows.length + 1,
      inicioMin,
      finMin: cursor,
      duracionMin,
      inicio: formatMinutos(inicioMin),
      fin: formatMinutos(cursor),
      escena: shot.esc?.trim() || null,
      plano,
      descripcion: descripcion || (plano ? `Plano ${plano}` : 'Sin descripción'),
      locacion,
      cast: parseCast(shot.cast_ids, talento),
      notas: shot.notas?.trim() || null,
      referencias: parseReferencias(shot.referencia_urls, descripcion || `Plano ${plano}`),
      especial: PLANOS_ESPECIALES.includes(plano),
    });
  }

  const totalPlanos = rows.filter((row) => !row.especial).length;

  // El cierre es el fin de la última fila de cierre ("CIERRE DE CLAQUETA",
  // "Cierre del día"…). Con duración 0 su fin coincide con su inicio, que es la
  // hora de cierre. Si el llamado no trae fila de cierre, se usa el fin del plan.
  const filasCierre = rows.filter(esFilaCierre);
  const cierreMin = filasCierre.length ? filasCierre[filasCierre.length - 1].finMin : rows.length ? cursor : null;

  return {
    rows,
    inicio: rows.length ? formatMinutos(base) : null,
    fin: rows.length ? formatMinutos(cursor) : null,
    cierre: cierreMin == null ? null : formatMinutos(cierreMin),
    cierreMin,
    totalMin: Math.max(0, cursor - base),
    totalPlanos,
    locaciones,
  };
}
