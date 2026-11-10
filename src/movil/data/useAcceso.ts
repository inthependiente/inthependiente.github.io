import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Persona } from '../types';
import { useOnline } from '../lib/online';
import { readJson, writeJson } from '../lib/storage';

export type ConfirmacionEstado =
  | 'validando'
  | 'inactivo'
  | 'confirmando'
  | 'confirmado'
  | 'pendiente'
  | 'error';

interface Guardado {
  persona: Persona | null;
  confirmadoEn: string | null;
  pendiente: boolean;
  /** Llamado resuelto desde el código, para poder abrir sin señal. */
  llamadoId: number | null;
}

interface Credencial {
  token: string | null;
  codigo: string | null;
}

/**
 * La caché se separa por credencial: en un mismo dispositivo pueden abrirse
 * varios links personales y la confirmación de una persona no debe aparecer en
 * la de otra. Sin credencial se usa el llamado del link general.
 */
const marca = ({ token, codigo }: Credencial, llamadoIdUrl?: number) =>
  codigo ? `c:${codigo}` : token ? `t:${token}` : `l:${llamadoIdUrl ?? 'sin-llamado'}`;

const clave = (m: string) => `llamadoapp:movil:confirmacion:v3:${m}`;

function leerGuardado(m: string): Guardado | null {
  const valor = readJson<Guardado>(clave(m));
  if (!valor || typeof valor !== 'object') return null;
  return {
    persona: valor.persona ?? null,
    confirmadoEn: valor.confirmadoEn ?? null,
    pendiente: Boolean(valor.pendiente),
    llamadoId: typeof valor.llamadoId === 'number' ? valor.llamadoId : null,
  };
}

function mensajeDeError(codigo?: string | null): string {
  if (codigo === 'PGRST202' || codigo === 'PGRST203') {
    return 'La confirmación todavía no está habilitada para este llamado.';
  }
  return 'No pudimos registrar tu confirmación. Revisa tu conexión e intenta de nuevo.';
}

interface Params {
  /** Llamado del link (`?id=`); puede faltar si el link usa solo el código corto. */
  llamadoIdUrl?: number;
  token?: string | null;
  codigo?: string | null;
}

/**
 * Acceso al llamado y confirmación.
 * · Link con código corto (`?c=XXXXXX`): el código identifica a la persona y el
 *   llamado, así que se resuelve antes de cargar los datos.
 * · Link con token (`?id=…&t=…`): formato anterior, sigue funcionando.
 * · Link general (`?id=…`): la persona se elige de la lista del crew.
 * · Sin conexión: la confirmación queda en cola en el dispositivo.
 */
export function useAcceso({ llamadoIdUrl, token = null, codigo = null }: Params) {
  const online = useOnline();
  const credencial: Credencial = { token, codigo };
  const tieneCredencial = Boolean(token || codigo);
  const m = marca(credencial, llamadoIdUrl);

  // Con código corto se ignora el `id` del link: el servidor decide a qué
  // llamado pertenece, y así un id manipulado no puede desviar la carga.
  const [llamadoId, setLlamadoId] = useState<number | null>(
    !codigo && Number.isFinite(llamadoIdUrl as number) ? (llamadoIdUrl as number) : null,
  );
  const [resolviendo, setResolviendo] = useState(tieneCredencial);
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [errorResolucion, setErrorResolucion] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<ConfirmacionEstado>(
    tieneCredencial ? 'validando' : 'inactivo',
  );
  const [persona, setPersona] = useState<Persona | null>(null);
  const [confirmadoEn, setConfirmadoEn] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credencialReconocida, setCredencialReconocida] = useState<boolean | null>(
    tieneCredencial ? null : false,
  );

  const enviando = useRef(false);
  const pendienteRef = useRef(false);
  const personaRef = useRef<Persona | null>(null);
  const llamadoRef = useRef<number | null>(llamadoId);

  useEffect(() => {
    pendienteRef.current = pendiente;
  }, [pendiente]);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    llamadoRef.current = llamadoId;
  }, [llamadoId]);

  const guardar = useCallback(
    (cambios: Partial<Guardado>) => {
      const actual = leerGuardado(m) ?? {
        persona: null,
        confirmadoEn: null,
        pendiente: false,
        llamadoId: null,
      };
      writeJson(clave(m), { ...actual, ...cambios } satisfies Guardado);
    },
    [m],
  );

  // Identificación al abrir el link.
  useEffect(() => {
    let cancelado = false;
    const previo = leerGuardado(m);

    if (previo?.persona) {
      setPersona(previo.persona);
      personaRef.current = previo.persona;
    }
    if (previo?.confirmadoEn) setConfirmadoEn(previo.confirmadoEn);
    if (previo?.pendiente) {
      setPendiente(true);
      pendienteRef.current = true;
    }

    const conoceLlamado = !codigo && Number.isFinite(llamadoIdUrl as number);

    // El llamado ya resuelto antes permite pintar la app desde la caché, incluso
    // sin señal; el acceso al servidor se reintenta igual.
    if (!conoceLlamado && previo?.llamadoId) {
      setLlamadoId(previo.llamadoId);
      llamadoRef.current = previo.llamadoId;
    }

    if (!tieneCredencial) {
      setCredencialReconocida(false);
      setResolviendo(false);
      setEstado(previo?.pendiente ? 'pendiente' : 'inactivo');
      return;
    }

    // Con el llamado ya conocido y la confirmación guardada no hace falta volver
    // a consultar: el servidor solo confirmaría lo mismo.
    if (previo?.confirmadoEn && (conoceLlamado || previo?.llamadoId)) {
      setCredencialReconocida(true);
      setResolviendo(false);
      setEstado('confirmado');
      return;
    }

    void (async () => {
      setResolviendo(true);
      setErrorResolucion(null);
      setEstado('validando');

      const { data, error: fallo } = await supabase.rpc('movil_registrar_evento', {
        p_evento: 'acceso',
        ...(codigo ? { p_codigo: codigo } : { p_token: token }),
      });
      if (cancelado) return;

      setResolviendo(false);

      if (fallo) {
        setCredencialReconocida(false);
        setEstado('error');

        // Un fallo de red no significa que el enlace sea inválido: se ofrece
        // reintentar en vez de decirle a la persona que su link no existe.
        const esRed = /failed to fetch|network|load failed|timeout/i.test(
          String(fallo.message ?? ''),
        );
        if (esRed) {
          // Con el llamado cacheado la app sigue usable; sin él, hay que reintentar.
          if (!conoceLlamado && !previo?.llamadoId) {
            setErrorResolucion('Sin conexión: no pudimos verificar tu enlace.');
          }
        } else {
          setError(mensajeDeError(fallo.code));
          if (!conoceLlamado && !previo?.llamadoId) setEnlaceInvalido(true);
        }
        return;
      }

      if (!data?.ok) {
        setCredencialReconocida(false);
        if (!conoceLlamado && !previo?.llamadoId) setEnlaceInvalido(true);
        else setEstado('inactivo');
        return;
      }

      const identificado: Persona = { crewId: data.crew_id, nombre: data.nombre ?? '' };
      const resuelto = typeof data.llamado_id === 'number' ? data.llamado_id : null;

      setCredencialReconocida(true);
      setPersona(identificado);
      personaRef.current = identificado;
      if (resuelto !== null) {
        setLlamadoId(resuelto);
        llamadoRef.current = resuelto;
      }
      guardar({ persona: identificado, llamadoId: resuelto ?? previo?.llamadoId ?? null });

      if (data.confirmado_en) {
        setConfirmadoEn(data.confirmado_en);
        setPendiente(false);
        pendienteRef.current = false;
        guardar({ confirmadoEn: data.confirmado_en, pendiente: false });
        setEstado('confirmado');
      } else {
        setEstado(previo?.pendiente ? 'pendiente' : 'inactivo');
      }
    })();

    return () => {
      cancelado = true;
    };
    // `m` resume la credencial; `tieneCredencial` y `codigo`/`token` van con ella.
  }, [m, tieneCredencial, codigo, token, llamadoIdUrl, guardar, intento]);

  const reintentarResolucion = useCallback(() => setIntento((valor) => valor + 1), []);

  const confirmar = useCallback(
    async (crewIdElegido?: number) => {
      const objetivo = crewIdElegido ?? personaRef.current?.crewId ?? null;
      const llamado = llamadoRef.current;

      if (enviando.current) return;

      if (!tieneCredencial) {
        if (!Number.isFinite(llamado as number)) return;
        if (!objetivo) {
          setError('Elige tu nombre para confirmar tu llamado.');
          setEstado('error');
          return;
        }
      }

      enviando.current = true;
      setError(null);

      const marcarPendiente = () => {
        const identificado = objetivo
          ? (personaRef.current ?? { crewId: objetivo, nombre: '' })
          : personaRef.current;

        setPersona(identificado);
        personaRef.current = identificado;
        setPendiente(true);
        pendienteRef.current = true;
        setEstado('pendiente');
        guardar({ persona: identificado, pendiente: true });
      };

      if (!navigator.onLine) {
        marcarPendiente();
        enviando.current = false;
        return;
      }

      setEstado('confirmando');

      try {
        const respuesta = tieneCredencial
          ? await supabase.rpc('movil_registrar_evento', {
              p_evento: 'confirmacion',
              ...(codigo ? { p_codigo: codigo } : { p_token: token }),
            })
          : await supabase.rpc('movil_confirmar_por_nombre', {
              p_llamado_id: llamado as number,
              p_crew_id: objetivo as number,
            });

        if (respuesta.error) throw respuesta.error;
        if (!respuesta.data?.ok) throw new Error(respuesta.data?.error ?? 'sin_respuesta');

        const data = respuesta.data;
        const identificado: Persona = {
          crewId: data.crew_id ?? objetivo ?? 0,
          nombre: data.nombre ?? personaRef.current?.nombre ?? '',
        };
        const registro = data.confirmado_en ?? new Date().toISOString();

        setPersona(identificado);
        personaRef.current = identificado;
        setConfirmadoEn(registro);
        setPendiente(false);
        pendienteRef.current = false;
        setEstado('confirmado');
        guardar({ persona: identificado, confirmadoEn: registro, pendiente: false });
      } catch (e: any) {
        const esProblemaDeRed =
          e?.name === 'TypeError' ||
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          /failed to fetch|network|load failed/i.test(String(e?.message ?? ''));

        if (esProblemaDeRed) {
          marcarPendiente();
        } else {
          setError(
            e?.code ? mensajeDeError(e.code) : 'No pudimos registrar tu confirmación. Intenta de nuevo.',
          );
          setEstado('error');
        }
      } finally {
        enviando.current = false;
      }
    },
    [tieneCredencial, codigo, token, guardar],
  );

  const reintentar = useCallback(() => {
    void confirmar(personaRef.current?.crewId);
  }, [confirmar]);

  // Reintento automático: al recuperar la señal y al volver a abrir la app.
  const vaciarCola = useCallback(() => {
    if (!pendienteRef.current || enviando.current) return;
    void confirmar(personaRef.current?.crewId);
  }, [confirmar]);

  useEffect(() => {
    window.addEventListener('online', vaciarCola);
    return () => window.removeEventListener('online', vaciarCola);
  }, [vaciarCola]);

  useEffect(() => {
    const temporizador = window.setTimeout(vaciarCola, 1200);
    return () => window.clearTimeout(temporizador);
  }, [vaciarCola]);

  return {
    llamadoId,
    resolviendo,
    enlaceInvalido,
    errorResolucion,
    reintentarResolucion,
    estado,
    persona,
    confirmadoEn,
    pendiente,
    error,
    online,
    credencialReconocida,
    confirmar,
    reintentar,
  };
}

export type Acceso = ReturnType<typeof useAcceso>;
