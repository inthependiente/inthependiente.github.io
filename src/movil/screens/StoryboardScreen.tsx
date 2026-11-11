import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  GalleryVerticalEnd,
  ImageOff,
  LayoutGrid,
  RefreshCw,
  Square,
  WifiOff,
} from 'lucide-react';
import AppBar from '../components/AppBar';
import { useStoryboards, type PanelStoryboard } from '../data/useStoryboards';
import { formatFechaHoraDeIso } from '../lib/format';
import { useOnline } from '../lib/online';
import type { LlamadoData } from '../types';

/** Deslizamiento mínimo (px) para cambiar de página. */
const UMBRAL_SWIPE = 45;
/**
 * Modos de la barra superior: una viñeta por página, rejilla de 2 × 2 o lista
 * vertical de tarjetas (imagen a la izquierda, locución a la derecha).
 */
type ModoVista = 1 | 4 | 'cards';

const MODOS: { valor: ModoVista; etiqueta: string; Icono: typeof Square }[] = [
  { valor: 'cards', etiqueta: 'Tarjetas con locución', Icono: GalleryVerticalEnd },
  { valor: 1, etiqueta: '1 viñeta por página', Icono: Square },
  { valor: 4, etiqueta: '4 viñetas por página', Icono: LayoutGrid },
];
/** Cuánto se hunde la viñeta mientras se arrastra, como acuse de recibo. */
const ARRASTRE_MAX = 60;

interface Props {
  data: LlamadoData;
}

/**
 * Storyboard del llamado en móvil. Adaptación de la Vista rodaje del panel con
 * tres modos: una viñeta por página (detalle), cuatro en rejilla de 2 × 2
 * (paneo) y tarjetas apiladas con desplazamiento vertical. No modifica la vista
 * del dashboard.
 */
export default function StoryboardScreen({ data }: Props) {
  const proyectoId = data.llamado.proyecto_id ?? null;

  const online = useOnline();
  const { lista, detalle, seleccionadoId, seleccionar, cargando, guardadoEn, error, recargar } =
    useStoryboards(proyectoId);

  const paneles = detalle?.panels ?? [];
  const locuciones = detalle?.locutions ?? [];

  // En móvil el modo por defecto es la lectura en tarjetas.
  const [modo, setModo] = useState<ModoVista>('cards');
  const [indice, setIndice] = useState(0);
  const [arrastre, setArrastre] = useState(0);
  const inicioX = useRef<number | null>(null);
  const huboSwipe = useRef(false);

  // Al cambiar de storyboard se vuelve al principio.
  useEffect(() => {
    setIndice(0);
    setArrastre(0);
  }, [seleccionadoId]);

  const total = paneles.length;
  const esCards = modo === 'cards';
  // En tarjetas no hay paginación: todo se apila y se recorre con scroll.
  // `indice` sigue siendo el de la viñeta, así cambiar de modo no pierde el
  // punto de lectura.
  const porPagina = modo === 'cards' ? 1 : modo;
  const totalPaginas = porPagina === 1 ? total : Math.ceil(total / porPagina);
  const pagina = porPagina === 1 ? indice : Math.floor(indice / porPagina);
  const inicioPagina = pagina * porPagina;
  const enPagina = paneles.slice(inicioPagina, inicioPagina + porPagina);

  const actual = paneles[Math.min(indice, Math.max(0, total - 1))];
  const locucion = locuciones[Math.min(indice, Math.max(0, locuciones.length - 1))] || '';

  const ir = useCallback(
    (destino: number) => {
      setArrastre(0);
      setIndice(Math.min(Math.max(destino, 0), Math.max(0, total - 1)));
    },
    [total],
  );

  const anterior = useCallback(() => {
    setArrastre(0);
    setIndice((prev) => Math.max(0, Math.floor(prev / porPagina) - 1) * porPagina);
  }, [porPagina]);

  const siguiente = useCallback(() => {
    setArrastre(0);
    setIndice((prev) => {
      const ultima = Math.max(0, Math.ceil(total / porPagina) - 1);
      return Math.min(Math.floor(prev / porPagina) + 1, ultima) * porPagina;
    });
  }, [porPagina, total]);

  // Precarga la página siguiente para que el cambio no muestre huecos.
  useEffect(() => {
    const proximo = paneles[inicioPagina + porPagina];
    if (!proximo?.image_url) return;
    const img = new Image();
    img.src = `${proximo.image_url}?v=${proximo.version ?? 0}`;
  }, [inicioPagina, paneles, porPagina]);

  // Flechas del teclado: útil al abrir el enlace en un equipo de escritorio.
  // En tarjetas la navegación es el scroll vertical, sin atajos.
  useEffect(() => {
    if (esCards) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'ArrowLeft') anterior();
      if (evento.key === 'ArrowRight') siguiente();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [anterior, esCards, siguiente]);

  /**
   * El gesto se cierra con un listener en `window` en vez de capturar el
   * puntero: la captura redirigía el `pointerup` al contenedor y las viñetas de
   * la rejilla nunca recibían su `click`.
   */
  const finalizarArrastre = useCallback(
    (clientX: number) => {
      if (inicioX.current === null) return;
      const delta = clientX - inicioX.current;
      inicioX.current = null;
      setArrastre(0);

      if (delta <= -UMBRAL_SWIPE) siguiente();
      else if (delta >= UMBRAL_SWIPE) anterior();
    },
    [anterior, siguiente],
  );

  const alBajar = (evento: React.PointerEvent) => {
    if (esCards || totalPaginas < 2) return;
    inicioX.current = evento.clientX;
    huboSwipe.current = false;

    const terminar = (e: PointerEvent) => {
      window.removeEventListener('pointerup', terminar);
      window.removeEventListener('pointercancel', terminar);
      finalizarArrastre(e.clientX);
    };
    window.addEventListener('pointerup', terminar);
    window.addEventListener('pointercancel', terminar);
  };

  const alMover = (evento: React.PointerEvent) => {
    if (inicioX.current === null) return;
    const delta = evento.clientX - inicioX.current;
    if (Math.abs(delta) > UMBRAL_SWIPE) huboSwipe.current = true;
    setArrastre(Math.max(-ARRASTRE_MAX, Math.min(ARRASTRE_MAX, delta)));
  };

  /** Un arrastre no debe terminar seleccionando la viñeta que quedó debajo. */
  const alTocarVinieta = (global: number) => {
    if (huboSwipe.current) return;
    ir(global);
  };

  const encabezado = useMemo(() => {
    if (!detalle) return 'Storyboard';
    const cuenta = total === 1 ? '1 viñeta' : `${total} viñetas`;
    return `${detalle.name} · ${cuenta}`;
  }, [detalle, total]);

  const etiquetaPagina =
    porPagina === 1
      ? `${indice + 1} de ${total}`
      : `Página ${pagina + 1} de ${totalPaginas}`;

  return (
    <>
      <AppBar
        title="Storyboard"
        acciones={
          <>
            {lista.length > 1 && (
              <select
                value={seleccionadoId ?? ''}
                onChange={(e) => void seleccionar(Number.parseInt(e.target.value, 10))}
                aria-label="Elegir storyboard"
                className="max-w-20 shrink-0 cursor-pointer truncate rounded-md border border-hairline-strong bg-surface px-1.5 py-1 text-[11px] text-content-secondary"
              >
                {lista.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    {sb.name}
                  </option>
                ))}
              </select>
            )}

            <div
              role="group"
              aria-label="Modo de visualización"
              className="flex shrink-0 items-center rounded-md border border-hairline bg-subtle p-0.5"
            >
              {MODOS.map(({ valor, etiqueta, Icono }) => {
                const activo = modo === valor;
                return (
                  <button
                    key={String(valor)}
                    type="button"
                    onClick={() => setModo(valor)}
                    aria-pressed={activo}
                    aria-label={etiqueta}
                    title={etiqueta}
                    className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                      activo ? 'bg-brand text-on-brand' : 'text-content-muted active:bg-hover'
                    }`}
                  >
                    <Icono className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </>
        }
      />

      <div className="px-3 pt-3">
        {!online && <BannerSinConexion guardadoEn={guardadoEn} />}
        {online && error && <BannerError onRetry={recargar} />}

        {cargando && !detalle ? (
          <Cargando />
        ) : !detalle || total === 0 ? (
          <SinVinietas hayStoryboards={lista.length > 0} nombre={detalle?.name ?? null} />
        ) : (
          <>
            <p className="mb-2 truncate px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
              {encabezado}
            </p>

            {esCards ? (
              <ListaTarjetas paneles={paneles} locuciones={locuciones} />
            ) : (
              <>
                <div
                  role="group"
                  aria-roledescription="carrusel"
                  aria-label={
                    porPagina === 1
                      ? `Viñeta ${indice + 1} de ${total}: ${actual?.filename ?? ''}`
                      : `Página ${pagina + 1} de ${totalPaginas}`
                  }
                  onPointerDown={alBajar}
                  onPointerMove={alMover}
                  className="touch-pan-y select-none"
                >
                  <div
                    className="transition-transform duration-150"
                    style={{ transform: arrastre ? `translateX(${arrastre * 0.35}px)` : undefined }}
                  >
                    {porPagina === 1 ? (
                      <div className="relative overflow-hidden rounded-xl border border-hairline bg-subtle">
                        <div className="flex aspect-video w-full items-center justify-center">
                          {actual?.image_url ? (
                            <img
                              key={actual.id || indice}
                              src={`${actual.image_url}?v=${actual.version ?? 0}`}
                              alt={actual.filename || `Viñeta ${indice + 1}`}
                              // La viñeta es el contenido de la pantalla: nada de diferir la carga.
                              loading="eager"
                              draggable={false}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <SinDibujo />
                          )}
                        </div>

                        {/* El nombre va en el acento de marca: los colores del cliente
                            pueden quedar ilegibles sobre el fondo claro de la viñeta. */}
                        <span className="absolute left-2 top-2 max-w-[55%] truncate rounded-md border border-brand-border bg-surface/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-content backdrop-blur">
                          {actual?.filename || `Viñeta ${indice + 1}`}
                        </span>
                      </div>
                    ) : (
                      // Rejilla 2 × 2: dos viñetas arriba y dos abajo.
                      <div className="grid grid-cols-2 gap-1.5">
                        {enPagina.map((panel, i) => {
                          const global = inicioPagina + i;
                          const seleccionada = global === indice;
                          return (
                            <button
                              key={panel.id || global}
                              type="button"
                              onClick={() => alTocarVinieta(global)}
                              aria-label={`Viñeta ${panel.filename || global + 1}`}
                              aria-current={seleccionada ? 'step' : undefined}
                              className={`relative overflow-hidden rounded-lg border bg-subtle transition-colors ${
                                seleccionada
                                  ? 'border-brand ring-1 ring-brand'
                                  : 'border-hairline active:border-hairline-strong'
                              }`}
                            >
                              <div className="flex aspect-video w-full items-center justify-center">
                                {panel.image_url ? (
                                  <img
                                    src={`${panel.image_url}?v=${panel.version ?? 0}`}
                                    alt={panel.filename || `Viñeta ${global + 1}`}
                                    loading="eager"
                                    draggable={false}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <SinDibujo compacto />
                                )}
                              </div>

                              <span className="absolute left-1 top-1 max-w-[70%] truncate rounded border border-brand-border bg-surface/90 px-1 py-0.5 font-mono text-[9px] font-semibold text-brand-content backdrop-blur">
                                {panel.filename || global + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contador de página, fuera del área de gestos para no estorbar. */}
                <div className="mt-1.5 flex justify-center">
                  <span className="rounded-md border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-content-muted">
                    {etiquetaPagina}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={anterior}
                    disabled={pagina === 0}
                    aria-label={porPagina === 1 ? 'Viñeta anterior' : 'Página anterior'}
                    className="btn btn-sm btn-secondary h-11 w-11 shrink-0 justify-center p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto py-1">
                    {Array.from({ length: totalPaginas }, (_, idx) => {
                      const primera = porPagina === 1 ? paneles[idx] : paneles[idx * porPagina];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => ir(idx * porPagina)}
                          aria-label={
                            porPagina === 1
                              ? `Ir a la viñeta ${primera?.filename || idx + 1}`
                              : `Ir a la página ${idx + 1}`
                          }
                          aria-current={idx === pagina ? 'step' : undefined}
                          className={`h-1.5 shrink-0 rounded-full transition-all ${
                            idx === pagina ? 'w-4 bg-brand' : 'w-1.5 bg-hairline-strong'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={siguiente}
                    disabled={pagina >= totalPaginas - 1}
                    aria-label={porPagina === 1 ? 'Viñeta siguiente' : 'Página siguiente'}
                    className="btn btn-sm btn-secondary h-11 w-11 shrink-0 justify-center p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <section className="mt-3 rounded-xl border border-hairline bg-surface p-3">
                  <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
                    Locución
                    {porPagina === 4 && actual?.filename ? (
                      <span className="ml-1 font-mono font-normal text-brand-content">
                        · {actual.filename}
                      </span>
                    ) : null}
                  </h2>
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-content-secondary">
                    {locucion || <span className="italic text-content-subtle">—</span>}
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────── Tarjetas ─────────────────────────── */

/**
 * Modo «Cards»: todas las viñetas una debajo de otra, con la imagen en la mitad
 * izquierda y la locución en la derecha. Se recorre con el scroll de la página.
 */
function ListaTarjetas({
  paneles,
  locuciones,
}: {
  paneles: PanelStoryboard[];
  locuciones: string[];
}) {
  return (
    <ol className="space-y-2">
      {paneles.map((panel, idx) => (
        <li key={panel.id || idx}>
          <article className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <div className="grid grid-cols-2 items-stretch">
              {/*
                La proporción va en un espaciador, no en la celda: con
                `aspect-video` en la celda, un texto largo la estira y el ancho
                se recalcula desde la altura, saliéndose de su mitad.
              */}
              <div className="relative min-w-0 overflow-hidden border-r border-hairline bg-subtle">
                <div className="aspect-video w-full" aria-hidden />

                <div className="absolute inset-0 flex items-center justify-center p-1">
                  {panel.image_url ? (
                    <img
                      src={`${panel.image_url}?v=${panel.version ?? 0}`}
                      alt={panel.filename || `Viñeta ${idx + 1}`}
                      // Lista larga y desplazable: solo se cargan las visibles.
                      loading="lazy"
                      draggable={false}
                      // `contain`: en modo lectura no se debe recortar el dibujo.
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <SinDibujo compacto />
                  )}
                </div>

                <span className="absolute left-1 top-1 max-w-[70%] truncate rounded border border-brand-border bg-surface/90 px-1 py-0.5 font-mono text-[9px] font-semibold text-brand-content backdrop-blur">
                  {panel.filename || idx + 1}
                </span>
              </div>

              <div className="flex min-w-0 flex-col p-2.5">
                <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-content-subtle">
                  Locución
                </h3>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-content-secondary">
                  {locuciones[idx] || <span className="italic text-content-subtle">—</span>}
                </p>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

/* ─────────────────────────── Estados ─────────────────────────── */

/** Hueco de una viñeta sin dibujo cargado. */
function SinDibujo({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-content-subtle">
      <ImageOff className={compacto ? 'h-4 w-4' : 'h-6 w-6'} />
      {!compacto && <span className="text-[11px]">Sin dibujo</span>}
    </div>
  );
}

function Cargando() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-2.5 w-28 rounded bg-subtle" />
      <div className="aspect-video w-full rounded-xl border border-hairline bg-subtle" />
      <div className="h-11 rounded-lg bg-subtle" />
      <div className="h-16 rounded-xl bg-subtle" />
    </div>
  );
}

function SinVinietas({ hayStoryboards, nombre }: { hayStoryboards: boolean; nombre: string | null }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-10 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle text-brand-content">
        <GalleryHorizontal className="h-5 w-5" />
      </span>
      <h2 className="text-[13px] font-semibold text-content">
        {hayStoryboards ? 'Este storyboard no tiene viñetas' : 'Sin storyboard'}
      </h2>
      <p className="mx-auto mt-1 max-w-[16rem] text-[11px] leading-relaxed text-content-muted">
        {hayStoryboards
          ? `«${nombre ?? 'Storyboard'}» todavía no tiene dibujos cargados.`
          : 'Cuando producción cargue el storyboard del proyecto, aparecerá aquí.'}
      </p>
    </div>
  );
}

function BannerSinConexion({ guardadoEn }: { guardadoEn: number | null }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-[11px] leading-relaxed text-warning-content">
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Sin conexión. Mostrando el storyboard guardado
        {guardadoEn ? ` el ${formatFechaHoraDeIso(new Date(guardadoEn).toISOString())}` : ''} en este
        dispositivo.
      </span>
    </div>
  );
}

function BannerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-hairline bg-subtle px-3 py-2 text-[11px] text-content-muted">
      <span className="min-w-0 flex-1">No pudimos actualizar el storyboard.</span>
      <button type="button" className="btn btn-ghost btn-xs" onClick={onRetry}>
        <RefreshCw className="h-3 w-3" />
        Reintentar
      </button>
    </div>
  );
}
