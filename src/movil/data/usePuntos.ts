import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { LlamadoData } from '../types';
import { buildPuntos, faltantes, tieneCoordenadas, type Punto } from '../lib/lugares';

/**
 * Coordenadas de los puntos del día.
 * Los links de Google Maps se resuelven en la Edge Function `resolver-mapa`
 * (el navegador no puede seguir esos redirects por CORS) y quedan cacheados en
 * la base, así que la resolución ocurre una sola vez por locación.
 */
export function usePuntos(data: LlamadoData) {
  const [puntos, setPuntos] = useState<Punto[]>(() => buildPuntos(data));
  const [resolviendo, setResolviendo] = useState(false);
  const [errorResolucion, setErrorResolucion] = useState<string | null>(null);
  const resueltos = useRef(new Set<string>());

  useEffect(() => {
    setPuntos(buildPuntos(data));
  }, [data]);

  const proyectoId = data.llamado.proyecto_id;

  useEffect(() => {
    const pendientes = faltantes(puntos, proyectoId);
    if (!pendientes.locacionIds.length && !pendientes.proyectoId) return;

    const clave = `${pendientes.locacionIds.join(',')}|${pendientes.proyectoId ?? ''}`;
    // Cada combinación se intenta una sola vez: evita bucles si el servidor no
    // logra resolver algún link.
    if (resueltos.current.has(clave)) {
      setResolviendo(false);
      return;
    }
    resueltos.current.add(clave);

    setResolviendo(true);

    void (async () => {
      try {
        const { data: respuesta, error } = await supabase.functions.invoke('resolver-mapa', {
          body: {
            locacion_ids: pendientes.locacionIds,
            proyecto_id: pendientes.proyectoId,
          },
        });

        if (error) throw error;

        const resultados: Array<{ tipo: string; id: number; lat: number | null; lng: number | null }> =
          Array.isArray(respuesta?.resultados) ? respuesta.resultados : [];

        if (!resultados.some((r) => typeof r.lat === 'number' && typeof r.lng === 'number')) {
          setErrorResolucion('No pudimos ubicar automáticamente algunos puntos en el mapa.');
          return;
        }

        type Resultado = { tipo: string; id: number; lat: number | null; lng: number | null };

        const idDe = (punto: Punto) =>
          punto.tipo === 'productora' ? null : Number(punto.key.replace('locacion-', ''));

        setPuntos((actuales) =>
          actuales.map((punto) => {
            if (typeof punto.lat === 'number' && typeof punto.lng === 'number') return punto;

            const encontrado = resultados.find((r: Resultado) =>
              punto.tipo === 'productora'
                ? r.tipo === 'proyecto'
                : r.tipo === 'locacion' && r.id === idDe(punto),
            );

            if (!encontrado || typeof encontrado.lat !== 'number' || typeof encontrado.lng !== 'number') {
              return punto;
            }

            return { ...punto, lat: encontrado.lat, lng: encontrado.lng };
          }),
        );
      } catch (e: any) {
        // El aviso se muestra aunque el efecto se haya reiniciado: el dato sigue
        // siendo válido y es la única pista de que un punto quedó sin ubicar.
        setErrorResolucion(
          /failed to fetch|network/i.test(String(e?.message ?? ''))
            ? 'Sin conexión: los puntos del mapa se ubicarán al recuperar señal.'
            : 'No pudimos ubicar automáticamente algunos puntos en el mapa.',
        );
      } finally {
        setResolviendo(false);
      }
    })();
    // Los resultados solo agregan coordenadas, así que aplicarlos aunque el
    // efecto se haya reiniciado es seguro y evita perder el aviso de error.
  }, [puntos, proyectoId]);

  const conCoordenadas = useMemo(() => puntos.filter(tieneCoordenadas), [puntos]);
  const sinCoordenadas = useMemo(() => puntos.filter((punto) => !tieneCoordenadas(punto)), [puntos]);

  return { puntos, conCoordenadas, sinCoordenadas, resolviendo, errorResolucion };
}
