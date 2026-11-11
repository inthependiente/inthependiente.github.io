import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { readJson, writeJson } from '../lib/storage';

/** Viñeta tal como la guarda el panel de Storyboard (JSONB `panels`). */
export interface PanelStoryboard {
  id: string;
  /** Nombre del plano: «01», «16A»… */
  filename: string;
  image_path: string;
  image_url: string;
  /** Marca de tiempo para invalidar la caché tras reemplazar la imagen. */
  version?: number;
}

/** Fila de la lista: sin los JSONB, para no bajarlos de más. */
export interface StoryboardResumen {
  id: number;
  name: string;
  panel_count: number | null;
  updated_at?: string | null;
}

interface StoryboardCompleto extends StoryboardResumen {
  panels: PanelStoryboard[];
  locutions: string[];
}

interface CachePayload {
  guardadoEn: number;
  proyectoId: number;
  lista: StoryboardResumen[];
  /** Solo se guarda el storyboard abierto: el resto se pide al cambiar. */
  detalle: StoryboardCompleto | null;
}

const cacheKey = (proyectoId: number) => `llamadoapp:movil:storyboards:v1:${proyectoId}`;

/**
 * Storyboards del proyecto del llamado, con caché local.
 *
 * La lista se pide ligera (`panel_count` es una columna generada) y las viñetas
 * completas solo del storyboard elegido: un proyecto puede tener varios y sus
 * JSONB son grandes.
 */
export function useStoryboards(proyectoId: number | null) {
  const key = useMemo(() => cacheKey(proyectoId ?? 0), [proyectoId]);
  const [cacheInicial] = useState(() => readJson<CachePayload>(key));

  const [lista, setLista] = useState<StoryboardResumen[]>(() =>
    cacheInicial?.proyectoId === proyectoId ? (cacheInicial?.lista ?? []) : [],
  );
  const [detalle, setDetalle] = useState<StoryboardCompleto | null>(() =>
    cacheInicial?.proyectoId === proyectoId ? (cacheInicial?.detalle ?? null) : null,
  );
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(detalle?.id ?? null);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(cacheInicial?.guardadoEn ?? null);
  const [cargandoLista, setCargandoLista] = useState(!cacheInicial?.lista);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Igual que en el llamado: una respuesta vieja no debe pisar a la nueva.
  const solicitud = useRef(0);

  const guardarCache = useCallback(
    (nuevaLista: StoryboardResumen[], nuevoDetalle: StoryboardCompleto | null) => {
      if (proyectoId == null) return;
      const ahora = Date.now();
      setGuardadoEn(ahora);
      writeJson(key, {
        guardadoEn: ahora,
        proyectoId,
        lista: nuevaLista,
        detalle: nuevoDetalle,
      } satisfies CachePayload);
    },
    [key, proyectoId],
  );

  const cargarDetalle = useCallback(
    async (id: number): Promise<StoryboardCompleto | null> => {
      const { data, error: fallo } = await supabase
        .from('storyboards')
        .select('id, name, panel_count, updated_at, panels, locutions')
        .eq('id', id)
        .maybeSingle();

      if (fallo) throw new Error(fallo.message);
      if (!data) return null;

      const fila = data as unknown as StoryboardCompleto;
      return {
        ...fila,
        panels: finito(fila.panels),
        locutions: finito(fila.locutions),
        panel_count: fila.panel_count ?? finito(fila.panels).length,
      };
    },
    [],
  );

  /** Carga la lista y, si hay storyboards, el detalle del seleccionado. */
  const cargar = useCallback(
    async (silencioso = false) => {
      if (proyectoId == null) {
        setLista([]);
        setDetalle(null);
        setSeleccionadoId(null);
        setCargandoLista(false);
        return;
      }

      solicitud.current += 1;
      const actual = solicitud.current;
      const esVigente = () => solicitud.current === actual;

      if (!silencioso) setCargandoLista(true);
      setError(null);

      try {
        const { data, error: fallo } = await supabase
          .from('storyboards')
          .select('id, name, panel_count, updated_at')
          .eq('proyecto_id', proyectoId)
          .order('created_at', { ascending: false });

        if (!esVigente()) return;
        if (fallo) throw new Error(fallo.message);

        const nuevaLista = (data ?? []) as StoryboardResumen[];
        const vigenteId =
          nuevaLista.find((sb) => sb.id === seleccionadoId)?.id ?? nuevaLista[0]?.id ?? null;

        let nuevoDetalle: StoryboardCompleto | null = null;
        if (vigenteId != null) {
          setCargandoDetalle(true);
          nuevoDetalle = await cargarDetalle(vigenteId);
          if (!esVigente()) return;
        }

        setLista(nuevaLista);
        setSeleccionadoId(vigenteId);
        setDetalle(nuevoDetalle);
        guardarCache(nuevaLista, nuevoDetalle);
      } catch (e) {
        if (esVigente()) setError((e as Error).message || 'No pudimos cargar el storyboard.');
      } finally {
        if (esVigente()) {
          setCargandoLista(false);
          setCargandoDetalle(false);
        }
      }
    },
    [cargarDetalle, guardarCache, proyectoId, seleccionadoId],
  );

  /** Cambia de storyboard cuando el proyecto tiene varios. */
  const seleccionar = useCallback(
    async (id: number) => {
      if (id === seleccionadoId && detalle) return;

      solicitud.current += 1;
      const actual = solicitud.current;
      setSeleccionadoId(id);
      setCargandoDetalle(true);
      setError(null);

      try {
        const nuevo = await cargarDetalle(id);
        if (solicitud.current !== actual) return;
        setDetalle(nuevo);
        guardarCache(lista, nuevo);
      } catch (e) {
        if (solicitud.current === actual) {
          setError((e as Error).message || 'No pudimos abrir ese storyboard.');
        }
      } finally {
        if (solicitud.current === actual) setCargandoDetalle(false);
      }
    },
    [cargarDetalle, detalle, guardarCache, lista, seleccionadoId],
  );

  // Al cambiar de llamado (otro proyecto) se recarga desde cero.
  const proyectoRef = useRef(proyectoId);
  useEffect(() => {
    if (proyectoRef.current === proyectoId) return;
    proyectoRef.current = proyectoId;
    setDetalle(null);
    setSeleccionadoId(null);
    void cargar();
  }, [cargar, proyectoId]);

  // Solo al montar: las recargas posteriores pasan por `recargar` o `seleccionar`.
  useEffect(() => {
    void cargar(Boolean(cacheInicial?.lista));
  }, []);

  const recargar = useCallback(() => void cargar(true), [cargar]);

  return {
    lista,
    detalle,
    seleccionadoId,
    seleccionar,
    cargando: cargandoLista || cargandoDetalle,
    cargandoDetalle,
    guardadoEn,
    error,
    recargar,
  };
}

/** Los JSONB pueden llegar en null si la fila es antigua. */
function finito<T>(valor: T[] | null | undefined): T[] {
  return Array.isArray(valor) ? valor : [];
}
