import { esIOS } from './plataforma';

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface Ruta {
  /** Puntos [lat, lng] del trazado. */
  trazado: Coordenada[];
  distanciaM: number;
  duracionS: number;
  /** true si OSRM no respondió y solo tenemos la línea recta. */
  aproximada: boolean;
}

const OSRM = 'https://router.project-osrm.org/route/v1';

/** Distancia en línea recta (haversine) en metros. */
export function distanciaRecta(a: Coordenada, b: Coordenada): number {
  const R = 6371000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistancia(metros: number): string {
  if (!Number.isFinite(metros) || metros < 0) return '—';
  if (metros < 950) return `${Math.round(metros / 10) * 10} m`;
  const km = metros / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

export function formatDuracionViaje(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '—';
  const minutos = Math.round(segundos / 60);
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** Decodifica el formato polyline (precisión 5) que devuelve OSRM. */
export function decodificarPolyline(encoded: string): Coordenada[] {
  const puntos: Coordenada[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  while (indice < encoded.length) {
    let resultado = 0;
    let desplazamiento = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);

    const deltaLat = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
    lat += deltaLat;

    resultado = 0;
    desplazamiento = 0;

    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);

    const deltaLng = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
    lng += deltaLng;

    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return puntos;
}

interface CacheRuta {
  guardadoEn: number;
  ruta: Ruta;
}

const TTL_MS = 10 * 60 * 1000;

function claveCache(origen: Coordenada, destino: Coordenada): string {
  const f = (n: number) => n.toFixed(4);
  return `llamadoapp:movil:ruta:v1:${f(origen.lat)},${f(origen.lng)}:${f(destino.lat)},${f(destino.lng)}`;
}

function leerCache(clave: string): Ruta | null {
  try {
    const raw = localStorage.getItem(clave);
    if (!raw) return null;
    const dato = JSON.parse(raw) as CacheRuta;
    if (!dato?.ruta || Date.now() - dato.guardadoEn > TTL_MS) return null;
    return dato.ruta;
  } catch {
    return null;
  }
}

function escribirCache(clave: string, ruta: Ruta) {
  try {
    localStorage.setItem(clave, JSON.stringify({ guardadoEn: Date.now(), ruta } satisfies CacheRuta));
  } catch {
    /* sin espacio: la ruta se vuelve a pedir la próxima vez */
  }
}

/**
 * Ruta en auto entre dos puntos. Si OSRM falla se devuelve la línea recta para
 * que el mapa muestre algo útil, marcada como aproximada.
 */
export async function calcularRuta(origen: Coordenada, destino: Coordenada): Promise<Ruta> {
  const clave = claveCache(origen, destino);
  const cache = leerCache(clave);
  if (cache) return cache;

  const coords = `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;

  try {
    const respuesta = await fetch(`${OSRM}/driving/${coords}?overview=full&geometries=polyline&alternatives=false&steps=false`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!respuesta.ok) throw new Error(`OSRM ${respuesta.status}`);

    const json = await respuesta.json();
    const ruta = json?.routes?.[0];
    if (json?.code !== 'Ok' || !ruta) throw new Error('sin_ruta');

    const resultado: Ruta = {
      trazado: decodificarPolyline(String(ruta.geometry ?? '')),
      distanciaM: Number(ruta.distance) || 0,
      duracionS: Number(ruta.duration) || 0,
      aproximada: false,
    };

    if (resultado.trazado.length < 2) {
      resultado.trazado = [
        { lat: origen.lat, lng: origen.lng },
        { lat: destino.lat, lng: destino.lng },
      ];
      resultado.aproximada = true;
    }

    escribirCache(clave, resultado);
    return resultado;
  } catch {
    const metros = distanciaRecta(origen, destino);
    return {
      trazado: [
        { lat: origen.lat, lng: origen.lng },
        { lat: destino.lat, lng: destino.lng },
      ],
      distanciaM: metros,
      // ~28 km/h promedio urbano como estimación conservadora.
      duracionS: (metros / 1000 / 28) * 3600,
      aproximada: true,
    };
  }
}

/** Lee la URL de Google Maps y devuelve sus coordenadas si las trae embebidas. */
export function coordsDeUrlGoogle(url: string | null | undefined): Coordenada | null {
  if (!url) return null;

  const patrones = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|destination|daddr)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
  ];

  for (const patron of patrones) {
    const match = patron.exec(url);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Ruta punto a punto en la app de Apple Maps.
 * Se usa el esquema `maps://` y no `https://maps.apple.com/`: el https abre la
 * versión web en el navegador, mientras que el esquema abre la app instalada,
 * que en iOS siempre existe.
 */
export function urlRutaAppleApp(
  destino: Coordenada,
  origen?: Coordenada | null,
  etiqueta?: string | null,
): string {
  const params = new URLSearchParams({
    daddr: `${destino.lat},${destino.lng}`,
    dirflg: 'd',
  });
  if (origen) params.set('saddr', `${origen.lat},${origen.lng}`);
  if (etiqueta) params.set('q', etiqueta);
  return `maps://?${params.toString()}`;
}

/** Ruta punto a punto en Google Maps. Sin origen, usa la ubicación actual. */
export function urlRutaGoogle(destino: Coordenada, origen?: Coordenada | null): string {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const params = origen
    ? `&origin=${origen.lat},${origen.lng}&destination=${destino.lat},${destino.lng}`
    : `&destination=${destino.lat},${destino.lng}`;
  return `${base}${params}&travelmode=driving`;
}

export interface OpcionRuta {
  id: 'google' | 'apple';
  nombre: string;
  url: string;
}

/**
 * Apps de mapas que se ofrecen en "Abrir ruta". Se elige en una hoja dentro de
 * la app para no disparar nunca un diálogo del sistema.
 *
 * · Google Maps va por HTTPS (Maps URLs), que iOS resuelve como Universal Link:
 *   abre la app si está instalada y si no, la versión web. El enlace debe ser
 *   un <a> que el usuario toque; con `location.href` Safari no lo intercepta.
 * · Apple Maps va por `maps://`, el esquema de la app del sistema, que siempre
 *   está instalada y por eso no falla ni muestra diálogo.
 */
export function opcionesDeRuta(
  destino: Coordenada,
  origen?: Coordenada | null,
  etiqueta?: string | null,
): OpcionRuta[] {
  const google: OpcionRuta = {
    id: 'google',
    nombre: 'Google Maps',
    url: urlRutaGoogle(destino, origen),
  };

  if (!esIOS()) return [google];

  return [
    google,
    { id: 'apple', nombre: 'Apple Maps', url: urlRutaAppleApp(destino, origen, etiqueta) },
  ];
}
