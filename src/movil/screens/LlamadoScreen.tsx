import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Coffee,
  Droplets,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Soup,
  Sunrise,
  Sunset,
  Utensils,
  WifiOff,
} from 'lucide-react';
import AppBar from '../components/AppBar';
import Sheet from '../components/Sheet';
import type { Acceso } from '../data/useAcceso';
import { useClima } from '../data/useClima';
import type { Clima } from '../lib/weather';
import type { CrewLlamado, Llamado, LlamadoData } from '../types';
import { agregarACalendario, construirEvento, downloadIcs } from '../lib/calendar';
import { colorSeguro, inkSobre } from '../lib/color';
import { formatFechaHoraDeIso, formatFechaLarga, iniciales, normalizarHora, slug } from '../lib/format';
import { useOnline } from '../lib/online';

interface Props {
  data: LlamadoData;
  acceso: Acceso;
  guardadoEn: number | null;
  error: string | null;
  recargar: () => void;
}

interface AvisoCalendario {
  texto: string;
  /** Ofrece el .ics como salida cuando el camino elegido fue Google Calendar. */
  conDescarga: boolean;
}

export default function LlamadoScreen({ data, acceso, guardadoEn, error, recargar }: Props) {
  const confirmacion = acceso;
  const online = useOnline();
  const { clima, cargando: cargandoClima } = useClima(data?.llamado.ciudades, data?.llamado.fecha);

  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [avisoCalendario, setAvisoCalendario] = useState<AvisoCalendario | null>(null);

  const evento = useMemo(() => (data ? construirEvento(data) : null), [data]);

  useEffect(() => {
    if (!avisoCalendario) return;
    const temporizador = window.setTimeout(() => setAvisoCalendario(null), 9000);
    return () => window.clearTimeout(temporizador);
  }, [avisoCalendario]);

  const { llamado } = data;
  const mostrarAvisoToken =
    confirmacion.credencialReconocida === false &&
    Number.isFinite(confirmacion.llamadoId as number) &&
    confirmacion.estado !== 'validando' &&
    confirmacion.estado !== 'confirmado';

  const elegirPersona = (crewId: number) => {
    setSelectorAbierto(false);
    void confirmacion.confirmar(crewId);
  };

  const descargarIcs = () => {
    if (!evento) return;
    downloadIcs(evento, `llamado-${llamado.id}@llamadoapp`, nombreArchivo(llamado));
    setAvisoCalendario({
      texto: 'Descargamos el archivo .ics: ábrelo para añadirlo a tu calendario.',
      conDescarga: false,
    });
  };

  const irAlCalendario = () => {
    if (!evento) return;
    const { destino, navegador } = agregarACalendario(
      evento,
      `llamado-${llamado.id}@llamadoapp`,
      nombreArchivo(llamado),
    );

    if (destino === 'google') {
      setAvisoCalendario({
        texto: 'Abrimos Google Calendar con el evento listo para guardar.',
        conDescarga: true,
      });
      return;
    }

    setAvisoCalendario({
      texto:
        navegador && navegador !== 'safari'
          ? 'Descargamos el archivo .ics: ábrelo desde tus descargas para añadirlo a tu calendario.'
          : 'Si tu calendario no se abrió, el archivo .ics está en tus descargas.',
      conDescarga: false,
    });
  };

  const accionPrincipal = () => {
    if (confirmacion.estado === 'confirmado') {
      irAlCalendario();
      return;
    }
    if (confirmacion.estado === 'pendiente' || confirmacion.estado === 'error') {
      if (!confirmacion.credencialReconocida && !confirmacion.persona) setSelectorAbierto(true);
      else confirmacion.reintentar();
      return;
    }
    if (confirmacion.credencialReconocida) {
      void confirmacion.confirmar();
      return;
    }
    setSelectorAbierto(true);
  };

  return (
    <>
      <AppBar title="Llamado" />

      <div className="px-3 pt-3">
        {!online && <BannerSinConexion guardadoEn={guardadoEn} />}
        {online && error && <BannerActualizacion onRetry={recargar} />}

        <CabeceraLlamado llamado={llamado} />
        <TarjetaHorario llamado={llamado} />
        <TarjetaClima clima={clima} cargando={cargandoClima} nota={llamado.lluvia_c} />
        <TarjetaNotas notas={llamado.notas} />
        <TarjetaComidas llamado={llamado} />

        {mostrarAvisoToken && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-info-border bg-info-subtle px-3 py-2 text-[11px] leading-relaxed text-info-content">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              No reconocimos tu enlace personal, pero puedes confirmar tu llamado eligiendo tu nombre en la
              lista.
            </span>
          </div>
        )}

      </div>

      <div
        className="fixed inset-x-0 z-30"
        style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))' }}
      >
        <div
          className="mx-auto w-full max-w-[520px] border-t border-hairline bg-canvas/95 px-3 pb-2.5 pt-2 backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <BarraConfirmacion
            estado={confirmacion.estado}
            persona={confirmacion.persona}
            error={confirmacion.error}
            online={online}
            calendarioDisponible={Boolean(evento)}
            avisoCalendario={avisoCalendario}
            onDescargarIcs={descargarIcs}
            onPrincipal={accionPrincipal}
          />
        </div>
      </div>

      <SelectorCrewSheet
        open={selectorAbierto}
        crew={data.crew}
        confirmando={confirmacion.estado === 'confirmando'}
        onClose={() => setSelectorAbierto(false)}
        onElegir={elegirPersona}
      />
    </>
  );
}

/* ─────────────────────────── Cabecera ─────────────────────────── */

function CabeceraLlamado({ llamado }: { llamado: Llamado }) {
  const proyecto = llamado.proyectos;
  const fondoCliente = colorSeguro(proyecto?.color_cliente);
  const fondoCampana = colorSeguro(proyecto?.color_campana) ?? 'var(--subtle)';
  const tintaCampana = inkSobre(proyecto?.color_campana);

  return (
    <header className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5"
        style={{ backgroundColor: fondoCliente ?? 'var(--subtle)' }}
      >
        <Logo imagen={proyecto?.logo_productora} nombre={proyecto?.productora ?? 'Productora'} />
        <Logo imagen={proyecto?.cliente} nombre="" alineadoDerecha />
      </div>

      {proyecto?.campana && (
        <div className="px-4 py-3" style={{ backgroundColor: fondoCampana, color: tintaCampana }}>
          <h1 className="text-[16px] font-semibold leading-tight">{proyecto.campana}</h1>
          {llamado.d_o_d && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-85">
              {llamado.d_o_d}
            </p>
          )}
        </div>
      )}
    </header>
  );
}

function Logo({
  imagen,
  nombre,
  alineadoDerecha = false,
}: {
  imagen?: string | null;
  nombre?: string | null;
  alineadoDerecha?: boolean;
}) {
  const [fallo, setFallo] = useState(false);

  if (imagen && !fallo) {
    return (
      <img
        src={imagen}
        alt={nombre || 'Logo'}
        className={`h-9 max-w-[46%] object-contain ${alineadoDerecha ? 'ml-auto' : ''}`}
        onError={() => setFallo(true)}
        loading="lazy"
      />
    );
  }

  if (!nombre) return null;

  return (
    <span
      className={`truncate text-[10px] font-semibold uppercase tracking-wide opacity-80 ${
        alineadoDerecha ? 'ml-auto text-right' : ''
      }`}
    >
      {nombre}
    </span>
  );
}

/* ─────────────────────────── Bloques ─────────────────────────── */

function TarjetaHorario({ llamado }: { llamado: Llamado }) {
  const hora = normalizarHora(llamado.llamado_hora);
  const fecha = formatFechaLarga(llamado.fecha);
  const ciudad = llamado.ciudades?.nombre ?? null;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex flex-col items-center px-4 pb-3.5 pt-3.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
          Hora de llamado
        </p>
        <div className="mt-1 flex items-baseline justify-center gap-1.5">
          <span className="font-mono text-[42px] font-semibold leading-none tracking-tight text-content">
            {hora ?? '—'}
          </span>
          {hora && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-content-muted">hrs</span>
          )}
        </div>

        {llamado.lugar_llamado && (
          <span className="mt-2.5 inline-flex items-center rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-content-secondary">
            {llamado.lugar_llamado}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-hairline px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-content-secondary">
          <CalendarDays className="h-3.5 w-3.5 text-content-subtle" />
          {fecha ?? 'Fecha por confirmar'}
        </span>

        {ciudad && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-content-muted">
            <MapPin className="h-3.5 w-3.5" />
            {ciudad}
          </span>
        )}
      </div>
    </section>
  );
}

function TarjetaClima({
  clima,
  cargando,
  nota,
}: {
  clima: Clima | null;
  cargando: boolean;
  nota?: string | null;
}) {
  if (!clima && !cargando) return null;

  return (
    <section className="mt-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[22px] leading-none">{clima?.icono ?? '🌡️'}</span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-content">
              {clima?.descripcion ?? 'Consultando el clima…'}
            </p>
            {nota && <p className="truncate text-[11px] text-content-muted">Lluvia: {nota}</p>}
          </div>
        </div>

        {clima && (
          <div className="shrink-0 text-right">
            <p className="font-mono text-[14px] font-semibold text-content">
              {clima.tMax ?? '—'}°
              <span className="font-normal text-content-muted"> / {clima.tMin ?? '—'}°</span>
            </p>
            <p className="text-[9px] uppercase tracking-wide text-content-subtle">máx / mín</p>
          </div>
        )}
      </div>

      {clima && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-hairline pt-2 text-[11px] text-content-muted">
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5" />
            {clima.lluvia ?? '—'}%
          </span>
          <span className="inline-flex items-center gap-1">
            <Sunrise className="h-3.5 w-3.5" />
            {clima.amanecer ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sunset className="h-3.5 w-3.5" />
            {clima.atardecer ?? '—'}
          </span>
        </div>
      )}
    </section>
  );
}

function TarjetaComidas({ llamado }: { llamado: Llamado }) {
  const comidas = [
    { etiqueta: 'Desayuno', hora: normalizarHora(llamado.desayuno), Icono: Coffee },
    { etiqueta: 'Almuerzo', hora: normalizarHora(llamado.almuerzo), Icono: Utensils },
    { etiqueta: 'Cena', hora: normalizarHora(llamado.cena), Icono: Soup },
  ].filter((comida) => Boolean(comida.hora));

  if (!comidas.length) return null;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-hairline bg-surface">
      <h2 className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        Comidas
      </h2>
      <ul className="mt-1.5 divide-y divide-hairline">
        {comidas.map(({ etiqueta, hora, Icono }) => (
          <li key={etiqueta} className="flex items-center justify-between px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-[13px] text-content-secondary">
              <Icono className="h-3.5 w-3.5 text-content-subtle" />
              {etiqueta}
            </span>
            <span className="font-mono text-[13px] font-semibold text-content">{hora}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TarjetaNotas({ notas }: { notas?: string | null }) {
  if (!notas?.trim()) return null;

  return (
    <section className="mt-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">Notas</h2>
      <p className="mt-1 whitespace-pre-line text-[12px] font-medium uppercase leading-relaxed text-content-secondary">
        {notas}
      </p>
    </section>
  );
}

/* ─────────────────────────── Estados ─────────────────────────── */

function BannerSinConexion({ guardadoEn }: { guardadoEn: number | null }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-[11px] leading-relaxed text-warning-content">
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Sin conexión. Mostrando la información guardada
        {guardadoEn ? ` el ${formatFechaHoraDeIso(new Date(guardadoEn).toISOString())}` : ''} en este
        dispositivo.
      </span>
    </div>
  );
}

function BannerActualizacion({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-hairline bg-subtle px-3 py-2 text-[11px] text-content-muted">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">No pudimos actualizar la información.</span>
      <button type="button" className="btn btn-ghost btn-xs" onClick={onRetry}>
        <RefreshCw className="h-3 w-3" />
        Reintentar
      </button>
    </div>
  );
}

/* ─────────────────────── Barra de confirmación ─────────────────────── */

function BarraConfirmacion({
  estado,
  persona,
  error,
  online,
  calendarioDisponible,
  avisoCalendario,
  onDescargarIcs,
  onPrincipal,
}: {
  estado: Acceso['estado'];
  persona: Acceso['persona'];
  error: string | null;
  online: boolean;
  calendarioDisponible: boolean;
  avisoCalendario: AvisoCalendario | null;
  onDescargarIcs: () => void;
  onPrincipal: () => void;
}) {
  if (estado === 'confirmado') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <p className="min-w-0 truncate text-[12px] text-content">
            <span className="font-semibold">Llamado confirmado</span>
            {persona?.nombre && <span className="text-content-muted"> · {persona.nombre}</span>}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block h-11"
          onClick={onPrincipal}
          disabled={!calendarioDisponible}
        >
          <CalendarPlus className="h-4 w-4" />
          Añadir a calendario
        </button>
        {avisoCalendario && (
          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-content-muted" role="status">
            <Info className="mt-px h-3 w-3 shrink-0" />
            <span>
              {avisoCalendario.texto}
              {avisoCalendario.conDescarga && (
                <>
                  {' '}
                  <button type="button" className="underline underline-offset-2" onClick={onDescargarIcs}>
                    Descargar .ics
                  </button>
                </>
              )}
            </span>
          </p>
        )}
      </div>
    );
  }

  if (estado === 'pendiente') {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle px-2.5 py-1.5 text-[11px] leading-relaxed text-warning-content">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Guardamos tu confirmación. La enviaremos automáticamente al recuperar señal.</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-lg btn-block h-11"
          onClick={onPrincipal}
          disabled={!online}
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar ahora
        </button>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-subtle px-2.5 py-1.5 text-[11px] leading-relaxed text-danger-content">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error ?? 'No pudimos registrar tu confirmación.'}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-lg btn-block h-11" onClick={onPrincipal}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    );
  }

  if (estado === 'validando') {
    return (
      <button type="button" className="btn btn-primary btn-lg btn-block h-11" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando enlace…
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-lg btn-block h-11"
        onClick={onPrincipal}
        disabled={estado === 'confirmando'}
      >
        {estado === 'confirmando' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirmando…
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Confirmar llamado
          </>
        )}
      </button>
      <p className="mt-1.5 text-center text-[10px] leading-relaxed text-content-subtle">
        Al confirmar, producción sabrá que asistirás.
      </p>
    </>
  );
}

/* ─────────────────────────── Sheets ─────────────────────────── */

function SelectorCrewSheet({
  open,
  crew,
  confirmando,
  onClose,
  onElegir,
}: {
  open: boolean;
  crew: CrewLlamado[];
  confirmando: boolean;
  onClose: () => void;
  onElegir: (crewId: number) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const opciones = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return crew
      .filter((fila) => fila.crew?.nombre)
      .map((fila) => ({
        crewId: fila.crew_id,
        nombre: fila.crew!.nombre,
        cargo: fila.crew?.cargo ?? fila.crew?.departamento ?? null,
        hora: normalizarHora(fila.hora_llamado ?? fila.crew?.llamado_hora ?? null),
      }))
      .filter((opcion) =>
        termino
          ? `${opcion.nombre} ${opcion.cargo ?? ''}`.toLowerCase().includes(termino)
          : true,
      );
  }, [crew, busqueda]);

  return (
    <Sheet open={open} title="¿Quién confirma?" onClose={onClose}>
      <p className="text-[11px] leading-relaxed text-content-muted">
        Elige tu nombre para registrar tu confirmación en este llamado.
      </p>

      <label className="mt-3 flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3">
        <Search className="h-4 w-4 shrink-0 text-content-subtle" />
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por nombre o cargo"
          className="h-11 w-full bg-transparent text-base text-content outline-none placeholder:text-content-subtle"
          autoComplete="off"
        />
      </label>

      <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
        {opciones.map((opcion) => (
          <li key={opcion.crewId}>
            <button
              type="button"
              disabled={confirmando}
              onClick={() => onElegir(opcion.crewId)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle active:bg-hover disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-content-muted">
                {iniciales(opcion.nombre)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-content">{opcion.nombre}</span>
                <span className="block truncate text-[11px] text-content-muted">
                  {opcion.cargo ?? 'Crew'}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[12px] font-semibold text-content">
                {opcion.hora ?? '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!opciones.length && (
        <p className="py-8 text-center text-[12px] text-content-muted">No encontramos ese nombre.</p>
      )}
    </Sheet>
  );
}

/* ─────────────────────────── Utilidades ─────────────────────────── */

function nombreArchivo(llamado: Llamado): string {
  const campana = slug(llamado.proyectos?.campana ?? 'llamado');
  return `llamado-${campana}-${llamado.id}.ics`;
}
