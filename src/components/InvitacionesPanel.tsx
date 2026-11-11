import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { mensajeInvitacion } from "../lib/invitaciones";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";

interface FilaPanel {
  crew_id: number;
  nombre: string;
  cargo: string | null;
  departamento: string | null;
  hora_llamado: string | null;
  celular: string | null;
  orden: number | null;
  token: string | null;
  codigo: string | null;
  acceso_en: string | null;
  confirmado_en: string | null;
}

interface Props {
  llamadoId: number | null;
  etiquetaLlamado: string | null;
  /** Campaña del proyecto, para el mensaje de WhatsApp. */
  campana?: string | null;
  /** Fecha del llamado (ISO), para el mensaje de WhatsApp. */
  fecha?: string | null;
  onNotify: (text: string, mode?: "success" | "error") => void;
}

const BASE_STORAGE_KEY = "llamadoapp_admin_base_movil";

const basePorDefecto = () => {
  try {
    return new URL("movil/", window.location.href).toString().replace(/\/$/, "");
  } catch {
    return `${window.location.origin}/movil`;
  }
};

const fechaHora = (iso: string | null) => {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
};

/** Solo dígitos, con 591 para WhatsApp (los datos traen espacios y marcas invisibles). */
const whatsappNumero = (valor: string | null) => {
  if (!valor) return null;
  let digitos = valor.replace(/[^\d]/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 11 && digitos.startsWith("591")) digitos = digitos.slice(3);
  if (digitos.length === 9 && digitos.startsWith("0")) digitos = digitos.slice(1);
  return digitos.length === 8 ? `591${digitos}` : null;
};

export default function InvitacionesPanel({
  llamadoId,
  etiquetaLlamado,
  campana,
  fecha,
  onNotify,
}: Props) {
  const [filas, setFilas] = useState<FilaPanel[]>([]);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [copiadoCliente, setCopiadoCliente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<string>(() => {
    try {
      return localStorage.getItem(BASE_STORAGE_KEY) || basePorDefecto();
    } catch {
      return basePorDefecto();
    }
  });

  const baseLimpia = base.trim().replace(/\/$/, "");

  // Link de cliente: información general del llamado, sin confirmación.
  const enlaceCliente = llamadoId ? `${baseLimpia}/?id=${llamadoId}&cliente=1` : null;

  // El link usa el código corto (49 caracteres) en lugar del uuid (83).
  const enlace = useCallback(
    (fila: Pick<FilaPanel, 'codigo' | 'token'>) => {
      if (fila.codigo) return `${baseLimpia}/?c=${fila.codigo}`;
      if (fila.token) return `${baseLimpia}/?id=${llamadoId}&t=${fila.token}`;
      return null;
    },
    [baseLimpia, llamadoId],
  );

  const cargar = useCallback(async () => {
    if (!llamadoId) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: fallo } = await supabase.rpc("admin_panel_invitaciones", {
        p_llamado_id: llamadoId,
      });
      if (fallo) throw fallo;
      setFilas((data ?? []) as FilaPanel[]);
    } catch (e: any) {
      setError(e?.message ?? "No pudimos cargar las invitaciones.");
    } finally {
      setCargando(false);
    }
  }, [llamadoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    try {
      localStorage.setItem(BASE_STORAGE_KEY, base);
    } catch {
      /* almacenamiento no disponible: se mantiene el valor de la sesión */
    }
  }, [base]);

  const generar = async () => {
    if (!llamadoId || generando) return;
    setGenerando(true);
    try {
      const { data, error: fallo } = await supabase.rpc("admin_generar_invitaciones", {
        p_llamado_id: llamadoId,
      });
      if (fallo) throw fallo;
      const resultado = Array.isArray(data) ? data[0] : data;
      const creados = Number(resultado?.creados ?? 0);
      await cargar();
      onNotify(
        creados > 0
          ? `Se generaron ${creados} ${creados === 1 ? "link" : "links"} personales.`
          : "Todos ya tenían su link personal.",
        "success",
      );
    } catch (e: any) {
      onNotify(e?.message ?? "No pudimos generar los links.", "error");
    } finally {
      setGenerando(false);
    }
  };

  const copiar = async (fila: FilaPanel) => {
    const url = enlace(fila);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(String(fila.crew_id));
      window.setTimeout(() => setCopiado(null), 1600);
    } catch {
      onNotify("No pudimos copiar el link: selecciónalo desde el texto.", "error");
    }
  };

  const copiarEnlaceCliente = async () => {
    if (!enlaceCliente) return;
    try {
      await navigator.clipboard.writeText(enlaceCliente);
      setCopiadoCliente(true);
      window.setTimeout(() => setCopiadoCliente(false), 1600);
    } catch {
      onNotify("No pudimos copiar el link: selecciónalo desde el texto.", "error");
    }
  };

  const mensajeWhatsapp = (fila: FilaPanel) =>
    mensajeInvitacion({
      nombre: fila.nombre,
      campana,
      fecha,
      hora: fila.hora_llamado,
      url: enlace(fila),
    });

  const exportarCsv = () => {
    const cabeceras = [
      "Nombre",
      "Cargo",
      "Departamento",
      "Hora de llamado",
      "Celular",
      "Estado",
      "Abrio el link",
      "Confirmo",
      "Link personal",
    ];

    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

    const lineas = filas.map((fila) =>
      [
        fila.nombre,
        fila.cargo ?? "",
        fila.departamento ?? "",
        fila.hora_llamado ?? "",
        fila.celular ?? "",
        fila.confirmado_en
          ? "Confirmado"
          : fila.acceso_en
            ? "Abrio sin confirmar"
            : fila.token
              ? "Sin abrir"
              : "Sin link",
        fechaHora(fila.acceso_en),
        fechaHora(fila.confirmado_en),
        enlace(fila) ?? "",
      ]
        .map((valor) => escapar(String(valor)))
        .join(","),
    );

    // BOM para que Excel respete los acentos y la ñ.
    const contenido = `\uFEFF${[cabeceras.join(","), ...lineas].join("\r\n")}`;
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlaceDescarga = document.createElement("a");

    enlaceDescarga.href = url;
    enlaceDescarga.download = `confirmaciones-llamado-${llamadoId}.csv`;
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click();
    enlaceDescarga.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter((fila) =>
      `${fila.nombre} ${fila.cargo ?? ""} ${fila.departamento ?? ""}`.toLowerCase().includes(termino),
    );
  }, [filas, busqueda]);

  const resumen = useMemo(() => {
    const total = filas.length;
    const confirmados = filas.filter((fila) => fila.confirmado_en).length;
    const abiertos = filas.filter((fila) => fila.acceso_en && !fila.confirmado_en).length;
    const conLink = filas.filter((fila) => fila.codigo || fila.token).length;
    return { total, confirmados, abiertos, conLink, sinLink: total - conLink };
  }, [filas]);

  if (!llamadoId) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 bg-subtle">
        <div className="max-w-sm text-center">
          <Smartphone className="w-10 h-10 text-content-subtle mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-content mb-1">Selecciona un llamado</h2>
          <p className="text-xs text-content-muted leading-relaxed">
            Las invitaciones se generan por llamado. Elige uno en la tabla de Llamados para ver el
            estado de acceso y confirmación de su crew.
          </p>
        </div>
      </div>
    );
  }

  const porcentaje = resumen.total ? Math.round((resumen.confirmados / resumen.total) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-subtle">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-content flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand-content" />
              Invitaciones del llamado
            </h1>
            <p className="text-xs text-content-muted mt-0.5">
              {etiquetaLlamado ?? `Llamado #${llamadoId}`} · links personales, accesos y confirmaciones
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              className="btn btn-sm btn-secondary"
              title="Refrescar estado"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            <button
              type="button"
              onClick={exportarCsv}
              disabled={!filas.length}
              className="btn btn-sm btn-secondary"
              title="Descargar CSV con el estado de cada persona"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void generar()}
              disabled={generando}
              className="btn btn-sm btn-primary"
            >
              {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Generar links
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Tarjeta etiqueta="Confirmados" valor={`${resumen.confirmados}/${resumen.total}`} tono="success" />
          <Tarjeta etiqueta="Abrieron sin confirmar" valor={String(resumen.abiertos)} tono="warning" />
          <Tarjeta
            etiqueta="Sin abrir"
            valor={String(resumen.total - resumen.confirmados - resumen.abiertos)}
          />
          <Tarjeta
            etiqueta="Sin link generado"
            valor={String(resumen.sinLink)}
            tono={resumen.sinLink > 0 ? "warning" : undefined}
          />
        </section>

        {resumen.total > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline-strong">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${porcentaje}%` }}
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Porcentaje de confirmaciones"
            />
          </div>
        )}

        <section className="rounded-xl border border-hairline bg-surface p-3">
          <label className="block text-[10px] font-semibold text-content-muted uppercase tracking-[0.12em] mb-1.5">
            Dirección de la app móvil
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={base}
              onChange={(evento) => setBase(evento.target.value)}
              spellCheck={false}
              className="flex-1 border border-hairline-strong rounded-lg px-2.5 py-1.5 text-xs font-mono text-content bg-surface focus:ring-2 focus:ring-brand focus:outline-hidden"
              placeholder="https://inthependiente.github.io/movil"
            />
            <button
              type="button"
              onClick={() => setBase(basePorDefecto())}
              className="btn btn-sm btn-secondary shrink-0"
              title="Volver a la dirección detectada"
            >
              Usar la detectada
            </button>
          </div>
          <p className="text-[11px] text-content-subtle mt-1.5 leading-relaxed">
            Los links se arman con esta base. Si el panel corre en local y quieres enviar links reales,
            escribe la dirección publicada de la app.
          </p>
        </section>

        <section className="rounded-xl border border-hairline bg-surface p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-content-muted uppercase tracking-[0.12em]">
                Link para clientes
              </p>
              <p className="text-[11px] text-content-subtle mt-1 leading-relaxed">
                Muestra la hora y la información general del llamado, sin el botón de confirmar ni
                datos personales del crew.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copiarEnlaceCliente()}
              disabled={!enlaceCliente}
              className="btn btn-sm btn-secondary shrink-0"
              title="Copiar link para clientes"
            >
              {copiadoCliente ? (
                <>
                  <Check className="w-4 h-4 text-success" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar
                </>
              )}
            </button>
          </div>
          {enlaceCliente && (
            <p className="mt-2 truncate rounded bg-subtle px-2 py-1 font-mono text-[10px] text-content-subtle">
              {enlaceCliente}
            </p>
          )}
        </section>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-content">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => void cargar()} className="btn btn-xs btn-secondary shrink-0">
              Reintentar
            </button>
          </p>
        )}

        <label className="flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3 py-1.5">
          <Search className="w-4 h-4 shrink-0 text-content-subtle" />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar persona o cargo"
            className="h-8 w-full bg-transparent text-sm text-content outline-none placeholder:text-content-subtle"
          />
          <span className="shrink-0 font-mono text-[11px] text-content-subtle">
            {filtradas.length}/{resumen.total}
          </span>
        </label>

        {cargando && !filas.length ? (
          <div className="flex items-center justify-center py-16 text-content-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Cargando invitaciones…</span>
          </div>
        ) : !filas.length ? (
          <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
            <p className="text-sm font-medium text-content">Este llamado no tiene crew asignado</p>
            <p className="text-xs text-content-muted mt-1">
              Asigna el equipo en «Crew llamado» para poder generar sus links personales.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtradas.map((fila) => {
              const url = enlace(fila);
              const numero = whatsappNumero(fila.celular);
              const confirmado = Boolean(fila.confirmado_en);
              const abierto = Boolean(fila.acceso_en);

              return (
                <li key={fila.crew_id} className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-content">
                        <span className="truncate">{fila.nombre}</span>
                        <Estado
                          confirmado={confirmado}
                          abierto={abierto}
                          conLink={Boolean(fila.codigo || fila.token)}
                        />
                      </p>
                      <p className="truncate text-[11px] text-content-muted">
                        {[fila.cargo, fila.departamento].filter(Boolean).join(" · ") || "Sin cargo"}
                        {fila.hora_llamado ? ` · ${fila.hora_llamado} hrs` : ""}
                      </p>
                      {(confirmado || abierto) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-content-subtle">
                          {abierto && (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Abrió {fechaHora(fila.acceso_en)}
                            </span>
                          )}
                          {confirmado && (
                            <span className="inline-flex items-center gap-1 text-success-content">
                              <CheckCircle2 className="w-3 h-3" />
                              Confirmó {fechaHora(fila.confirmado_en)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void copiar(fila)}
                        disabled={!url}
                        className="btn btn-xs btn-secondary"
                        title={url ? "Copiar link personal" : "Genera los links primero"}
                      >
                        {copiado === String(fila.crew_id) ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-success" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Link
                          </>
                        )}
                      </button>

                      <a
                        href={
                          numero
                            ? `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsapp(fila))}`
                            : undefined
                        }
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!numero || !url}
                        onClick={(evento) => {
                          if (!numero || !url) evento.preventDefault();
                        }}
                        className={`btn btn-xs ${
                          numero && url ? "btn-primary" : "btn-secondary opacity-40 cursor-not-allowed"
                        }`}
                        title={
                          !numero
                            ? "Sin teléfono válido registrado"
                            : !url
                              ? "Genera los links primero"
                              : "Enviar por WhatsApp"
                        }
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  {url && (
                    <p className="mt-1.5 truncate rounded bg-subtle px-2 py-1 font-mono text-[10px] text-content-subtle">
                      {url}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="flex items-start gap-1.5 pb-4 text-[11px] leading-relaxed text-content-subtle">
          <Send className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Cada link identifica a la persona: al abrirlo se registra su primer acceso y, al confirmar,
            queda guardada la fecha y hora. Compártelo solo con esa persona.
          </span>
        </p>
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: string;
  tono?: "success" | "warning";
}) {
  const clases =
    tono === "success"
      ? "border-success-border bg-success-subtle"
      : tono === "warning"
        ? "border-warning-border bg-warning-subtle"
        : "border-hairline bg-surface";

  const colorValor =
    tono === "success"
      ? "text-success-content"
      : tono === "warning"
        ? "text-warning-content"
        : "text-content";

  return (
    <div className={`rounded-lg border px-3 py-2 ${clases}`}>
      <p className="text-[10px] font-medium uppercase tracking-widest text-content-muted leading-tight">
        {etiqueta}
      </p>
      <p className={`mt-0.5 font-mono text-lg font-semibold leading-none ${colorValor}`}>{valor}</p>
    </div>
  );
}

function Estado({
  confirmado,
  abierto,
  conLink,
}: {
  confirmado: boolean;
  abierto: boolean;
  conLink: boolean;
}) {
  if (confirmado) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-success-border bg-success-subtle px-1.5 py-0.5 text-[10px] font-semibold text-success-content">
        <CheckCircle2 className="w-3 h-3" />
        Confirmado
      </span>
    );
  }

  if (abierto) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-warning-border bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning-content">
        <Eye className="w-3 h-3" />
        Abrió
      </span>
    );
  }

  if (!conLink) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-hairline bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-content-subtle">
        <XCircle className="w-3 h-3" />
        Sin link
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-hairline bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
      Pendiente
    </span>
  );
}
