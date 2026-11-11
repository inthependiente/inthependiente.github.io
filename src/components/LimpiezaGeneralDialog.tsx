import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

/** Tablas que la limpieza vacía, en el mismo orden que informa la RPC. */
const TABLAS_VACIADAS: { clave: string; etiqueta: string }[] = [
  { clave: 'proyectos', etiqueta: 'Proyectos' },
  { clave: 'llamados', etiqueta: 'Llamados' },
  { clave: 'locaciones', etiqueta: 'Locaciones' },
  { clave: 'escenas', etiqueta: 'Escenas' },
  { clave: 'shotlist', etiqueta: 'Shotlist' },
  { clave: 'pdr', etiqueta: 'PDR (Rodaje)' },
  { clave: 'talento', etiqueta: 'Talento' },
  { clave: 'crew_llamado', etiqueta: 'Crew llamado' },
  { clave: 'crew_invitaciones', etiqueta: 'Invitaciones' },
  { clave: 'llamado_respuestas', etiqueta: 'Confirmaciones' },
];

const SE_CONSERVAN = [
  'Centros médicos',
  'Crew',
  'Cliente / Agencia',
  'Ciudades (catálogo)',
  'Storyboard',
];

/** Palabra que hay que escribir para habilitar el botón. */
const PALABRA = 'LIMPIAR';

interface Resultado {
  tablas?: Record<string, number>;
  invitaciones?: number;
  confirmaciones?: number;
  clientes_sin_llamado?: number;
}

interface Props {
  onClose: () => void;
  /** Se llama solo cuando la limpieza terminó bien. */
  onDone: (resultado: Resultado) => void;
  onNotify: (texto: string, modo?: 'success' | 'error') => void;
}

type Fase = 'confirmar' | 'ejecutando' | 'listo';

/** Confirmación de la limpieza general: vacía el rodaje y reinicia los IDs. */
export default function LimpiezaGeneralDialog({ onClose, onDone, onNotify }: Props) {
  const [fase, setFase] = useState<Fase>('confirmar');
  const [palabra, setPalabra] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const palabraRef = useRef<HTMLInputElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  const habilitado = palabra.trim().toUpperCase() === PALABRA;

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    palabraRef.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && fase !== 'ejecutando') onClose();
    };
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [fase, onClose]);

  const ejecutar = async () => {
    setFase('ejecutando');
    setError(null);

    const { data, error: fallo } = await supabase.rpc('admin_limpieza_general');

    if (fallo) {
      setError(fallo.message);
      setFase('confirmar');
      onNotify(fallo.message, 'error');
      cerrarRef.current?.focus();
      return;
    }

    const resumen = (data ?? {}) as Resultado;
    setResultado(resumen);
    setFase('listo');
    onDone(resumen);
  };

  const totalBorradas = resultado
    ? TABLAS_VACIADAS.reduce((suma, t) => suma + (resultado.tablas?.[t.clave] ?? 0), 0)
    : 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => fase !== 'ejecutando' && onClose()}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative w-full max-w-lg rounded-xl border border-hairline bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-hairline p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger-content">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-content">Limpieza general de la base</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-content-muted">
              Vacía el rodaje completo y reinicia los contadores de ID. No se puede deshacer.
            </p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            disabled={fase === 'ejecutando'}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-subtle transition-colors hover:bg-subtle hover:text-content disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {fase === 'listo' ? (
            <div className="rounded-lg border border-success-border bg-success-subtle p-3 text-success-content">
              <p className="text-xs font-semibold">Limpieza completada.</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Se borraron <span className="font-mono font-semibold">{totalBorradas}</span> filas y los
                IDs de las tablas vaciadas vuelven a empezar en 1.
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
                {TABLAS_VACIADAS.map(({ clave, etiqueta }) => (
                  <li key={clave} className="flex justify-between gap-2">
                    <span className="truncate">{etiqueta}</span>
                    <span className="font-semibold">{resultado?.tablas?.[clave] ?? 0}</span>
                  </li>
                ))}
              </ul>
              {Boolean(resultado?.clientes_sin_llamado) && (
                <p className="mt-2 text-[10px] leading-relaxed opacity-90">
                  {resultado?.clientes_sin_llamado} cliente(s)/agencia(s) quedaron sin llamado asignado
                  (se conservaron).
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-danger-border bg-danger-subtle p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-danger-content">
                    Se borra todo de
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-danger-content">
                    {TABLAS_VACIADAS.map(({ clave, etiqueta }) => (
                      <li key={clave}>· {etiqueta}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-hairline bg-subtle p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-content-muted">
                    Se conserva
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-content-secondary">
                    {SE_CONSERVAN.map((nombre) => (
                      <li key={nombre}>· {nombre}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-content-muted">
                Los IDs de las tablas vaciadas se reinician en 1. Las entradas de{' '}
                <span className="font-medium text-content">Cliente / Agencia</span> no se borran: quedan
                sin llamado para que puedas reasignarlas.
              </p>

              {error && (
                <div className="mt-3 rounded-lg border border-danger-border bg-danger-subtle p-3 text-[11px] leading-relaxed text-danger-content">
                  <p className="font-semibold">No se borró nada.</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              )}

              <label className="mt-3 block">
                <span className="text-[11px] text-content-muted">
                  Escribe <span className="font-mono font-semibold text-content">{PALABRA}</span> para
                  confirmar
                </span>
                <input
                  ref={palabraRef}
                  type="text"
                  value={palabra}
                  onChange={(e) => setPalabra(e.target.value)}
                  disabled={fase === 'ejecutando'}
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder={PALABRA}
                  className="mt-1 w-full rounded-lg border border-hairline-strong bg-surface px-2.5 py-1.5 font-mono text-sm uppercase text-content placeholder-content-subtle focus:outline-hidden focus:ring-2 focus:ring-danger"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={fase === 'ejecutando'}
            className="btn btn-sm btn-secondary"
          >
            {fase === 'listo' ? 'Cerrar' : 'Cancelar'}
          </button>

          {fase !== 'listo' && (
            <button
              type="button"
              onClick={() => void ejecutar()}
              disabled={!habilitado || fase === 'ejecutando'}
              className="btn btn-sm btn-danger"
            >
              {fase === 'ejecutando' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Limpiando…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpiar la base
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
