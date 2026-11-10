import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cross,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Route as RouteIcon,
  TriangleAlert,
} from 'lucide-react';
import AppBar from '../components/AppBar';
import MapaLocaciones from '../components/MapaLocaciones';
import Sheet from '../components/Sheet';
import type { LlamadoData } from '../types';
import { usePuntos } from '../data/usePuntos';
import { useUbicacion } from '../data/useUbicacion';
import {
  calcularRuta,
  formatDistancia,
  formatDuracionViaje,
  opcionesDeRuta,
  type Coordenada,
  type OpcionRuta,
  type Ruta,
} from '../lib/geo';
import { tieneCoordenadas, type Punto } from '../lib/lugares';

export default function LocacionesScreen({ data }: { data: LlamadoData }) {
  const { puntos, resolviendo, errorResolucion } = usePuntos(data);
  const ubicacion = useUbicacion();

  const [listaVisible, setListaVisible] = useState(true);
  const [seleccionadoKey, setSeleccionadoKey] = useState<string | null>(null);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);

  const [hojaRuta, setHojaRuta] = useState<{ opciones: OpcionRuta[]; destino: string } | null>(null);

  const seleccionado = useMemo(
    () => puntos.find((punto) => punto.key === seleccionadoKey) ?? null,
    [puntos, seleccionadoKey],
  );

  /** Origen de la ruta: solo el GPS. Sin ubicación no se traza ruta. */
  const origen: Coordenada | null = ubicacion.coords;
  const origenLat = origen?.lat ?? null;
  const origenLng = origen?.lng ?? null;

  // Ruta al punto seleccionado.
  useEffect(() => {
    if (!seleccionado || !tieneCoordenadas(seleccionado) || origenLat === null || origenLng === null) {
      setRuta(null);
      setCargandoRuta(false);
      return;
    }

    let cancelado = false;
    setCargandoRuta(true);

    void calcularRuta({ lat: origenLat, lng: origenLng }, { lat: seleccionado.lat, lng: seleccionado.lng })
      .then((resultado) => {
        if (!cancelado) setRuta(resultado);
      })
      .finally(() => {
        if (!cancelado) setCargandoRuta(false);
      });

    return () => {
      cancelado = true;
    };
  }, [seleccionado, origenLat, origenLng]);

  const seleccionar = useCallback((punto: Punto) => {
    setSeleccionadoKey((actual) => (actual === punto.key ? null : punto.key));
  }, []);

  const puntoSeleccionadoCoords =
    seleccionado && tieneCoordenadas(seleccionado)
      ? { lat: seleccionado.lat, lng: seleccionado.lng }
      : null;

  const elegirAppDeRuta = (destino: Coordenada, titulo: string) => {
    const opciones = opcionesDeRuta(destino, origen, titulo);
    if (opciones.length === 1) {
      window.location.href = opciones[0].url;
      return;
    }
    setHojaRuta({ opciones, destino: titulo });
  };

  const etiquetaDistancia =
    ruta && !cargandoRuta
      ? `${formatDuracionViaje(ruta.duracionS)} · ${formatDistancia(ruta.distanciaM)}`
      : null;

  // Al elegir un punto la lista se achica para dejar más mapa.
  const alturaMapa = !listaVisible ? '100%' : seleccionado ? '62%' : '42%';

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100dvh - var(--tabbar-h) - env(safe-area-inset-bottom))' }}
    >
      <div className="shrink-0">
        <AppBar title="Locaciones" />
      </div>

      <div
        className="relative w-full shrink-0 transition-[height] duration-300 ease-out"
        style={{
          height: listaVisible ? alturaMapa : undefined,
          flex: listaVisible ? '0 0 auto' : '1 1 auto',
        }}
      >
        <MapaLocaciones
          puntos={puntos}
          seleccionado={seleccionado}
          ruta={ruta}
          ubicacion={ubicacion.coords}
          origenRuta={origen}
          paddingInferior={listaVisible ? 176 : 200}
          onSeleccionar={seleccionar}
        />

        {resolviendo && (
          <div className="absolute left-2 top-2 z-[500] flex items-center gap-1.5 rounded-lg border border-hairline bg-surface/95 px-2 py-1.5 text-[10px] text-content-muted shadow-sm backdrop-blur">
            <Loader2 className="h-3 w-3 animate-spin" />
            Ubicando puntos…
          </div>
        )}

        {seleccionado && (
          <DetallePunto
            punto={seleccionado}
            origen={origen}
            ruta={ruta}
            cargandoRuta={cargandoRuta}
            etiquetaDistancia={etiquetaDistancia}
            onCerrar={() => {
              setSeleccionadoKey(null);
              setListaVisible(true);
            }}
            mapaGrande={!listaVisible}
            onAlternarMapa={() => setListaVisible((valor) => !valor)}
            onAbrirRuta={elegirAppDeRuta}
            destino={puntoSeleccionadoCoords}
          />
        )}
      </div>

      {listaVisible && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-hairline bg-canvas">
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
              Ruta del día · {puntos.length - 1} {puntos.length - 1 === 1 ? 'locación' : 'locaciones'}
            </p>
            <span className="text-[10px] text-content-subtle">en orden de escenas</span>
          </div>

          {errorResolucion && (
            <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg border border-warning-border bg-warning-subtle px-2 py-1.5 text-[11px] leading-snug text-warning-content">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {errorResolucion}
            </p>
          )}

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
            {puntos.map((punto) => (
              <li key={punto.key} className="mb-2">
                <FilaPunto
                  punto={punto}
                  activo={punto.key === seleccionadoKey}
                  onSeleccionar={() => seleccionar(punto)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet open={Boolean(hojaRuta)} title="Abrir ruta con" onClose={() => setHojaRuta(null)}>
        <p className="text-[11px] leading-relaxed text-content-muted">
          Elige la app de mapas para llegar a {hojaRuta?.destino}.
        </p>
        <div className="mt-3 space-y-2">
          {hojaRuta?.opciones.map((opcion) => (
            <a
              key={opcion.id}
              className="btn btn-secondary btn-lg btn-block h-11 justify-start"
              href={opcion.url}
              rel="noreferrer"
              onClick={() => setHojaRuta(null)}
            >
              <Navigation className="h-4 w-4" />
              {opcion.nombre}
            </a>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-content-subtle">
          Google Maps abre su app si está instalada; Apple Maps siempre está disponible.
        </p>
      </Sheet>
    </div>
  );
}

/* ─────────────────────────── Lista ─────────────────────────── */

function FilaPunto({
  punto,
  activo,
  onSeleccionar,
}: {
  punto: Punto;
  activo: boolean;
  onSeleccionar: () => void;
}) {
  const esProductora = punto.tipo === 'productora';
  const conCoords = tieneCoordenadas(punto);

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      aria-pressed={activo}
      className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors ${
        activo
          ? 'border-brand-border bg-brand-subtle'
          : 'border-hairline bg-surface active:bg-subtle'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
          esProductora
            ? 'bg-[#7c3aed] text-white'
            : activo
              ? 'bg-brand text-on-brand'
              : 'bg-subtle text-content-secondary'
        }`}
      >
        {esProductora ? 'P' : punto.numero}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-content">
            {punto.titulo}
          </span>
          {punto.primeraHora && (
            <span className="shrink-0 font-mono text-[11px] font-semibold text-content-secondary">
              {punto.primeraHora}
            </span>
          )}
        </span>

        <span className="mt-0.5 block truncate text-[11px] leading-snug text-content-muted">
          {esProductora ? 'Salida · ' : ''}
          {punto.direccion ?? 'Sin dirección registrada'}
        </span>

        {punto.hospital && (
          <span className="mt-1 flex items-center gap-1 text-[10px] leading-snug text-info-content">
            <Cross className="h-3 w-3 shrink-0" />
            <span className="truncate">{punto.hospital.nombre}</span>
          </span>
        )}

        {!conCoords && (
          <span className="mt-1 flex items-center gap-1 text-[10px] text-warning-content">
            <TriangleAlert className="h-3 w-3 shrink-0" />
            Sin ubicación en el mapa
          </span>
        )}
      </span>
    </button>
  );
}

/* ─────────────────────────── Detalle ─────────────────────────── */

function DetallePunto({
  punto,
  origen,
  ruta,
  cargandoRuta,
  etiquetaDistancia,
  onCerrar,
  mapaGrande,
  onAlternarMapa,
  onAbrirRuta,
  destino,
}: {
  punto: Punto;
  origen: Coordenada | null;
  ruta: Ruta | null;
  cargandoRuta: boolean;
  etiquetaDistancia: string | null;
  onCerrar: () => void;
  /** El mapa ocupa la pantalla y la lista está oculta. */
  mapaGrande: boolean;
  onAlternarMapa: () => void;
  onAbrirRuta: (destino: Coordenada, titulo: string) => void;
  destino: Coordenada | null;
}) {
  const esProductora = punto.tipo === 'productora';

  return (
    <div className="absolute inset-x-0 bottom-3.5 z-[450] px-2 pb-2">
      <div className="rise-in overflow-hidden rounded-xl border border-hairline bg-elevated/97 shadow-lg backdrop-blur">
        <div className="flex items-start gap-2 px-3 pb-1.5 pt-2.5">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
              esProductora ? 'bg-[#7c3aed] text-white' : 'bg-brand text-on-brand'
            }`}
          >
            {esProductora ? 'P' : punto.numero}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-content">{punto.titulo}</p>
            {punto.direccion && (
              <p className="truncate text-[11px] leading-snug text-content-muted">{punto.direccion}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-content-subtle transition-colors active:bg-subtle"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
          {destino ? (
            cargandoRuta ? (
              <Chip>
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculando ruta…
              </Chip>
            ) : etiquetaDistancia ? (
              <Chip tono="info">
                <RouteIcon className="h-3 w-3" />
                {etiquetaDistancia}
              </Chip>
            ) : (
              <Chip>
                <RouteIcon className="h-3 w-3" />
                Ver en el mapa
              </Chip>
            )
          ) : (
            <Chip tono="aviso">
              <TriangleAlert className="h-3 w-3" />
              Sin coordenadas
            </Chip>
          )}

          {punto.primeraHora && (
            <Chip>
              <MapPin className="h-3 w-3" />
              {punto.primeraHora} hrs
            </Chip>
          )}

          {ruta?.aproximada && (
            <Chip tono="aviso">
              <TriangleAlert className="h-3 w-3" />
              estimado
            </Chip>
          )}
        </div>

        {punto.hospital && (
          <div className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg border border-info-border bg-info-subtle px-2 py-1.5">
            <Cross className="mt-0.5 h-3 w-3 shrink-0 text-info-content" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-info-content/70">
                Centro médico más cercano
              </p>
              <p className="truncate text-[11px] font-medium leading-tight text-info-content">
                {punto.hospital.nombre}
              </p>
              {punto.hospital.direccion && (
                <p className="truncate text-[10px] leading-tight text-info-content/80">
                  {punto.hospital.direccion}
                </p>
              )}
            </div>
            {punto.hospital.url && (
              <a
                href={punto.hospital.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[10px] font-semibold text-info-content underline"
              >
                Ver
              </a>
            )}
          </div>
        )}

        <div className="flex gap-1.5 border-t border-hairline px-2 py-2">
          {destino && (
            <button
              type="button"
              className="btn btn-primary btn-sm h-9 flex-1"
              onClick={() => onAbrirRuta(destino, punto.titulo)}
            >
              <Navigation className="h-3.5 w-3.5" />
              Abrir ruta
            </button>
          )}

          {!destino && punto.url && (
            <a
              className="btn btn-primary btn-sm h-9 flex-1"
              href={punto.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir en Google Maps
            </a>
          )}

          <button
            type="button"
            onClick={onAlternarMapa}
            aria-pressed={mapaGrande}
            aria-label={mapaGrande ? 'Achicar el mapa y ver la lista' : 'Agrandar el mapa'}
            className="btn btn-secondary btn-sm h-9"
          >
            {mapaGrande ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tono }: { children: React.ReactNode; tono?: 'info' | 'aviso' }) {
  const clases =
    tono === 'info'
      ? 'border-info-border bg-info-subtle text-info-content'
      : tono === 'aviso'
        ? 'border-warning-border bg-warning-subtle text-warning-content'
        : 'border-hairline bg-subtle text-content-muted';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${clases}`}
    >
      {children}
    </span>
  );
}
