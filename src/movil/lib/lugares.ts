import type { Locacion, LlamadoData } from '../types';
import { normalizarHora } from './format';

export interface Punto {
  /** Clave estable para el mapa y las rutas. */
  key: string;
  tipo: 'productora' | 'locacion';
  /** Número que se muestra en el pin y en la lista. La productora es 0. */
  numero: number;
  titulo: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  /** Link de Google Maps tal como está cargado en el panel. */
  url: string | null;
  hospital: {
    nombre: string;
    direccion: string | null;
    url: string | null;
  } | null;
  /** Escenas y horarios en los que se usa esta locación durante el día. */
  usos: { escena: string; hora: string | null }[];
  primeraHora: string | null;
}

export const tieneCoordenadas = (punto: Punto): punto is Punto & { lat: number; lng: number } =>
  typeof punto.lat === 'number' && typeof punto.lng === 'number';

/**
 * Orden de las locaciones según el cronograma: primero las escenas del llamado
 * (`escenas.orden`), después las que solo aparecen en el PDR y al final las que
 * quedaron sin escena. La productora siempre va primero.
 */
export function buildPuntos(data: LlamadoData): Punto[] {
  const proyecto = data.llamado.proyectos;

  const productora: Punto = {
    key: 'productora',
    tipo: 'productora',
    numero: 0,
    titulo: proyecto?.productora?.trim() || 'Productora',
    direccion: proyecto?.direccion_productora?.trim() || null,
    lat: proyecto?.lat ?? null,
    lng: proyecto?.lng ?? null,
    url: proyecto?.map_productora ?? null,
    hospital: null,
    usos: [],
    primeraHora: normalizarHora(data.llamado.llamado_hora),
  };

  const locaciones = new Map<number, Locacion>();
  for (const escena of data.escenas) {
    if (escena.locacion_id && escena.locaciones) locaciones.set(escena.locacion_id, escena.locaciones);
  }
  for (const fila of data.pdr) {
    const shot = fila.shotlist;
    if (shot?.locacion_id && shot.locaciones) locaciones.set(shot.locacion_id, shot.locaciones);
  }

  const orden: number[] = [];
  const agregar = (id: number | null | undefined) => {
    if (typeof id === 'number' && locaciones.has(id) && !orden.includes(id)) orden.push(id);
  };

  const escenasOrdenadas = [...data.escenas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  for (const escena of escenasOrdenadas) agregar(escena.locacion_id);

  const pdrOrdenado = [...data.pdr].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  for (const fila of pdrOrdenado) agregar(fila.shotlist?.locacion_id ?? null);

  for (const id of locaciones.keys()) agregar(id);

  const puntos: Punto[] = [productora];

  orden.forEach((id, indice) => {
    const locacion = locaciones.get(id)!;

    const usosEscena = escenasOrdenadas
      .filter((escena) => escena.locacion_id === id)
      .map((escena) => ({
        escena: escena.escena?.trim() || escena.descripcion?.trim() || 'Escena',
        hora: normalizarHora(escena.hora),
      }));

    puntos.push({
      key: `locacion-${id}`,
      tipo: 'locacion',
      numero: indice + 1,
      titulo: locacion.locacion?.trim() || `Locación ${indice + 1}`,
      direccion: locacion.direccion_loc?.trim() || null,
      lat: locacion.lat ?? null,
      lng: locacion.lng ?? null,
      url: locacion.url_loc ?? null,
      hospital: locacion.hospitales
        ? {
            nombre: locacion.hospitales.hospital,
            direccion: locacion.hospitales.direccion_hosp?.trim() || null,
            url: locacion.hospitales.ubicacion_hosp?.trim() || null,
          }
        : null,
      usos: usosEscena,
      primeraHora: usosEscena.find((uso) => uso.hora)?.hora ?? null,
    });
  });

  return puntos;
}

/** Coordenadas que aún faltan resolver en el servidor. */
export function faltantes(puntos: Punto[], proyectoId?: number) {
  const locacionIds: number[] = [];
  let necesitaProyecto = false;

  for (const punto of puntos) {
    const sinCoordenadas =
      typeof punto.lat !== 'number' || typeof punto.lng !== 'number';
    if (!sinCoordenadas) continue;

    if (punto.tipo === 'productora') necesitaProyecto = true;
    else locacionIds.push(Number(punto.key.replace('locacion-', '')));
  }

  return {
    locacionIds: locacionIds.filter((id) => Number.isFinite(id)),
    proyectoId: necesitaProyecto ? proyectoId : undefined,
  };
}
