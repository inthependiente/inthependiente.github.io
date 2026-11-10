import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoryboardPanel } from '../types';

const BUCKET = 'storyboards';
/** Supabase Storage lista y borra de a 100 objetos por llamada. */
const LOTE = 100;
/** Guarda contra carpetas anidadas inesperadas. */
const PROFUNDIDAD_MAX = 3;

export interface ArchivoBucket {
  path: string;
  bytes: number;
}

export interface BorradoFallido {
  path: string;
  mensaje: string;
}

export interface ResultadoBorrado {
  /** true solo si no quedó ningún archivo del storyboard en el bucket. */
  ok: boolean;
  borrados: ArchivoBucket[];
  bytes: number;
  fallos: BorradoFallido[];
  /** Rutas que siguen existiendo tras el intento (para reintentar). */
  restantes: string[];
}

/** Lista recursivamente los archivos de un prefijo, paginando de a 100. */
async function listarPrefijo(
  prefijo: string,
  cliente: SupabaseClient,
  profundidad = 0,
): Promise<ArchivoBucket[]> {
  const encontrados: ArchivoBucket[] = [];

  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await cliente.storage
      .from(BUCKET)
      .list(prefijo, { limit: LOTE, offset: desde, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`No pudimos listar «${prefijo}»: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const objeto of data) {
      // Las "carpetas" llegan sin id: se recorren si no estamos demasiado abajo.
      if (objeto.id === null) {
        if (profundidad < PROFUNDIDAD_MAX) {
          encontrados.push(
            ...(await listarPrefijo(`${prefijo}${objeto.name}/`, cliente, profundidad + 1)),
          );
        }
        continue;
      }

      const metadata = objeto.metadata as { size?: number } | null;
      encontrados.push({ path: `${prefijo}${objeto.name}`, bytes: metadata?.size ?? 0 });
    }

    if (data.length < LOTE) break;
  }

  return encontrados;
}

/** Extrae la ruta dentro del bucket a partir de una URL pública. */
function rutaDesdeUrl(url: string | undefined | null): string | null {
  if (!url) return null;

  const marcas = ['/object/public/storyboards/', '/object/sign/storyboards/'];
  for (const marca of marcas) {
    const posicion = url.indexOf(marca);
    if (posicion !== -1) return decodeURIComponent(url.slice(posicion + marca.length).split('?')[0]);
  }

  const posicion = url.indexOf('/storyboards/');
  if (posicion !== -1) return decodeURIComponent(url.slice(posicion + '/storyboards/'.length).split('?')[0]);

  return null;
}

/** Rutas declaradas en el JSON de viñetas (image_path y, como respaldo, image_url). */
function rutasDeclaradas(panels: StoryboardPanel[]): string[] {
  const rutas = new Set<string>();

  for (const panel of panels) {
    if (panel.image_path) rutas.add(panel.image_path.replace(/^\/+/, ''));
    const desdeUrl = rutaDesdeUrl(panel.image_url);
    if (desdeUrl) rutas.add(desdeUrl.replace(/^\/+/, ''));
  }

  return [...rutas];
}

/**
 * Reúne todo lo que hay que borrar de un storyboard:
 * lo que existe bajo su carpeta (incluye copias y reemplazos viejos) más las
 * rutas declaradas en el JSON que hayan quedado fuera de esa carpeta.
 */
export async function recolectarArchivos(
  storyboardId: number,
  panels: StoryboardPanel[],
  cliente: SupabaseClient,
): Promise<ArchivoBucket[]> {
  const porRuta = new Map<string, ArchivoBucket>();

  for (const archivo of await listarPrefijo(`${storyboardId}/`, cliente)) {
    porRuta.set(archivo.path, archivo);
  }

  // Las rutas declaradas pueden no aparecer en el listado si están en otra
  // carpeta (datos heredados); se agregan aunque no se conozca su peso.
  for (const ruta of rutasDeclaradas(panels)) {
    if (!porRuta.has(ruta)) porRuta.set(ruta, { path: ruta, bytes: 0 });
  }

  return [...porRuta.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** true si todavía quedan archivos del storyboard en el bucket. */
export async function quedanArchivos(
  storyboardId: number,
  cliente: SupabaseClient,
): Promise<string[]> {
  const restantes = await listarPrefijo(`${storyboardId}/`, cliente);
  return restantes.map((archivo) => archivo.path);
}

function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

/**
 * Borra los archivos indicados y verifica el resultado.
 *
 * Nunca lanza: devuelve los fallos para que la interfaz decida si borrar o no
 * la fila de la base (se aborta si `ok` es false, para no dejar huérfanos).
 */
export async function borrarArchivos(
  storyboardId: number,
  archivos: ArchivoBucket[],
  cliente: SupabaseClient,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<ResultadoBorrado> {
  const fallos: BorradoFallido[] = [];
  const borrados: ArchivoBucket[] = [];
  let hechos = 0;
  const total = archivos.length;

  for (const lote of enLotes(archivos, LOTE)) {
    const rutas = lote.map((archivo) => archivo.path);
    const { error } = await cliente.storage.from(BUCKET).remove(rutas);

    if (error) {
      // Se reintenta archivo por archivo para saber exactamente cuál falló.
      for (const archivo of lote) {
        const { error: errorIndividual } = await cliente.storage.from(BUCKET).remove([archivo.path]);
        if (errorIndividual) fallos.push({ path: archivo.path, mensaje: errorIndividual.message });
        else borrados.push(archivo);
      }
    } else {
      borrados.push(...lote);
    }

    hechos += lote.length;
    onProgreso?.(hechos, total);
  }

  // Verificación real: lo borrado se confirma releyendo el bucket.
  let restantes: string[] = [];
  try {
    restantes = await quedanArchivos(storyboardId, cliente);
  } catch {
    // Si no se puede verificar, se usa lo que sabemos de los fallos.
    restantes = fallos.map((fallo) => fallo.path);
  }

  const rutasRestantes = new Set(restantes);
  const confirmados = borrados.filter((archivo) => !rutasRestantes.has(archivo.path));

  return {
    ok: rutasRestantes.size === 0 && fallos.length === 0,
    borrados: confirmados,
    bytes: confirmados.reduce((suma, archivo) => suma + archivo.bytes, 0),
    fallos,
    restantes: [...rutasRestantes],
  };
}

/** "12,4 MB" para los avisos. */
export function formatearBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}
