import { readJson, writeJson } from './storage';

export interface Clima {
  descripcion: string;
  icono: string;
  tMax: number | null;
  tMin: number | null;
  lluvia: number | null;
  amanecer: string | null;
  atardecer: string | null;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hora
const LAT_POR_DEFECTO = -17.7863; // Santa Cruz de la Sierra
const LNG_POR_DEFECTO = -63.1812;

const DESCRIPCIONES: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos violentos',
  95: 'Tormenta eléctrica',
  96: 'Tormenta con granizo',
};

const ICONOS: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  95: '⛈️',
  96: '⛈️',
};

const cacheKey = (lat: number, lng: number, fecha: string) =>
  `llamadoapp:movil:clima:v1:${lat.toFixed(3)},${lng.toFixed(3)},${fecha}`;

/** Pronóstico del día del llamado con Open-Meteo (sin API key). */
export async function cargarClima(
  lat: number | null | undefined,
  lng: number | null | undefined,
  fecha: string | null | undefined,
): Promise<Clima | null> {
  if (!fecha) return null;

  const latitude = typeof lat === 'number' && Number.isFinite(lat) ? lat : LAT_POR_DEFECTO;
  const longitude = typeof lng === 'number' && Number.isFinite(lng) ? lng : LNG_POR_DEFECTO;
  const key = cacheKey(latitude, longitude, fecha);

  const guardado = readJson<{ guardadoEn: number; clima: Clima | null }>(key);
  if (guardado && Date.now() - guardado.guardadoEn < CACHE_TTL) return guardado.clima;

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: 'auto',
      forecast_days: '16',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset',
      hourly: 'precipitation_probability,weathercode',
    });

    const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!respuesta.ok) throw new Error(`Open-Meteo ${respuesta.status}`);

    const clima = extraerClima(await respuesta.json(), fecha);
    writeJson(key, { guardadoEn: Date.now(), clima });
    return clima;
  } catch {
    return guardado?.clima ?? null;
  }
}

function extraerClima(json: any, fecha: string): Clima | null {
  const indice = Array.isArray(json?.daily?.time) ? json.daily.time.indexOf(fecha) : -1;
  if (indice < 0) return null;

  const horas: string[] = json?.hourly?.time ?? [];
  const codigos: number[] = json?.hourly?.weathercode ?? [];
  const lluvias: number[] = json?.hourly?.precipitation_probability ?? [];

  let lluviaMax: number | null = null;
  const frecuencia = new Map<number, number>();

  for (let i = 0; i < horas.length; i += 1) {
    if (!String(horas[i]).startsWith(fecha)) continue;

    const probabilidad = lluvias[i];
    if (typeof probabilidad === 'number') lluviaMax = Math.max(lluviaMax ?? 0, probabilidad);

    const hora = String(horas[i]).slice(11, 13);
    if (hora >= '06' && hora <= '20') {
      const codigo = codigos[i];
      if (typeof codigo === 'number') frecuencia.set(codigo, (frecuencia.get(codigo) ?? 0) + 1);
    }
  }

  const dominante = [...frecuencia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const codigoDia = json?.daily?.weathercode?.[indice];
  const codigo = typeof dominante === 'number' ? dominante : codigoDia;

  return {
    descripcion: DESCRIPCIONES[codigo] ?? 'Sin dato',
    icono: ICONOS[codigo] ?? '🌡️',
    tMax: numeroODefecto(json?.daily?.temperature_2m_max?.[indice]),
    tMin: numeroODefecto(json?.daily?.temperature_2m_min?.[indice]),
    lluvia: lluviaMax === null ? null : Math.round(lluviaMax),
    amanecer: horaDeIso(json?.daily?.sunrise?.[indice]),
    atardecer: horaDeIso(json?.daily?.sunset?.[indice]),
  };
}

function numeroODefecto(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : null;
}

function horaDeIso(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length >= 16 ? valor.slice(11, 16) : null;
}
