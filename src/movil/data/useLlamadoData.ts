import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { CrewLlamado, Escena, Llamado, LlamadoData, PdrRow, Talento } from '../types';
import { readJson, writeJson } from '../lib/storage';

interface CachePayload {
  guardadoEn: number;
  data: LlamadoData;
}

const cacheKey = (llamadoId: number) => `llamadoapp:movil:llamado:v4:${llamadoId}`;

const CAMPOS_CREW =
  'id, crew_id, orden, hora_llamado, notas, crew(id, nombre, cargo, departamento, celular, llamado_hora, notas)';

const CAMPOS_LOCACION =
  'id, locacion, direccion_loc, url_loc, lat, lng, hospitales(id, hospital, direccion_hosp, ubicacion_hosp)';

const CAMPOS_ESCENAS =
  `id, orden, escena, hora, descripcion, cast_nombres, int_ext, d_n, locacion_id, locaciones(${CAMPOS_LOCACION})`;

const CAMPOS_PDR =
  `id, orden, duracion_min, status, inicio_reg, shotlist(id, esc, plano, descripcion, cast_ids, notas, referencia_urls, locacion_id, locaciones(${CAMPOS_LOCACION}))`;

/**
 * Carga el llamado completo (cabecera + crew + escenas) con caché local:
 * si no hay señal se muestra la última copia guardada en el dispositivo.
 */
export function useLlamadoData(llamadoId: number) {
  const key = cacheKey(llamadoId);
  const [cacheInicial] = useState(() => readJson<CachePayload>(key));

  const [data, setData] = useState<LlamadoData | null>(cacheInicial?.data ?? null);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(cacheInicial?.guardadoEn ?? null);
  const [cargando, setCargando] = useState(!cacheInicial?.data);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  // Cada carga lleva un número: si el llamado cambia mientras una respuesta
  // está en vuelo, la respuesta vieja se descarta en lugar de pisar a la nueva.
  const solicitud = useRef(0);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!Number.isFinite(llamadoId)) {
        setNoEncontrado(true);
        setCargando(false);
        return;
      }

      solicitud.current += 1;
      const actual = solicitud.current;
      const esVigente = () => solicitud.current === actual;

      if (silencioso) setActualizando(true);
      else setCargando(true);
      setError(null);
      setNoEncontrado(false);

      try {
        const [llamado, crew, escenas, pdr, talento] = await Promise.all([
          supabase
            .from('llamados')
            .select('*, proyectos(*), ciudades(*)')
            .eq('id', llamadoId)
            .maybeSingle(),
          supabase
            .from('crew_llamado')
            .select(CAMPOS_CREW)
            .eq('llamado_id', llamadoId)
            .order('orden', { ascending: true, nullsFirst: false }),
          supabase
            .from('escenas')
            .select(CAMPOS_ESCENAS)
            .eq('llamado_id', llamadoId)
            .order('orden', { ascending: true }),
          supabase
            .from('pdr')
            .select(CAMPOS_PDR)
            .eq('llamado_id', llamadoId)
            .order('orden', { ascending: true }),
          supabase
            .from('talento')
            .select('id, id_personaje, nombre, rol, llamado_hora, en_set, notas, w_status, locacion_id, locaciones(id, locacion)')
            .eq('llamado_id', llamadoId),
        ]);

        if (!esVigente()) return;

        const fallo = llamado.error ?? crew.error ?? escenas.error ?? pdr.error ?? talento.error;
        if (fallo) throw fallo;
        if (!llamado.data) {
          setNoEncontrado(true);
          return;
        }

        const payload: LlamadoData = {
          llamado: llamado.data as unknown as Llamado,
          crew: (crew.data ?? []) as unknown as CrewLlamado[],
          escenas: (escenas.data ?? []) as unknown as Escena[],
          pdr: (pdr.data ?? []) as unknown as PdrRow[],
          talento: (talento.data ?? []) as unknown as Talento[],
        };

        const ahora = Date.now();
        setData(payload);
        setNoEncontrado(false);
        setGuardadoEn(ahora);
        writeJson(key, { guardadoEn: ahora, data: payload } satisfies CachePayload);
      } catch (e: any) {
        if (esVigente()) setError(e?.message ?? 'No pudimos cargar el llamado.');
      } finally {
        if (esVigente()) {
          setCargando(false);
          setActualizando(false);
        }
      }
    },
    [llamadoId, key],
  );

  useEffect(() => {
    void cargar(Boolean(cacheInicial?.data));
  }, [cargar, cacheInicial]);

  const recargar = useCallback(() => {
    void cargar(true);
  }, [cargar]);

  return { data, guardadoEn, cargando, actualizando, error, noEncontrado, recargar };
}
