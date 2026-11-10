/**
 * Mensaje de invitación que se envía por WhatsApp a cada persona del crew.
 *
 * El formato es parte del contrato con producción:
 *
 *   Hola (nombre), este es tu llamado para "CAMPAÑA"
 *   Fecha: DD/MM/AAAA
 *   Hora: HH:MM
 *   Confirma aquí: (link)
 *
 * «Fecha:», «Hora:» y «Confirma aquí:» van en negrita. WhatsApp no interpreta
 * Markdown: usa *asteriscos* para negrita y saltos de línea reales (\n).
 */

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

/** '2026-11-12' (o con hora) → '12/11/2026', sin corrimiento de zona horaria. */
export const formatearFecha = (valor: string | null | undefined) => {
  if (!valor) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  if (!match) return valor.trim() || null;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/** '7:30', '07:30:00' → '07:30'. */
export const formatearHora = (valor: string | null | undefined) => {
  if (!valor) return null;
  const match = /^(\d{1,2})[:.](\d{2})/.exec(valor.trim());
  if (!match) return valor.trim() || null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export interface DatosInvitacion {
  nombre: string;
  campana?: string | null;
  /** Fecha del llamado, en ISO. */
  fecha?: string | null;
  hora?: string | null;
  url?: string | null;
}

export function mensajeInvitacion({ nombre, campana, fecha, hora, url }: DatosInvitacion): string {
  const proyecto = campana?.trim();
  const dia = formatearFecha(fecha);
  const horaTexto = formatearHora(hora);

  // Los datos que faltan se omiten en vez de dejar una línea con un valor vacío.
  const lineas = [
    `Hola ${primerNombre(nombre)}, este es tu llamado${proyecto ? ` para "${proyecto}"` : ""}`,
    dia ? `*Fecha:* ${dia}` : null,
    horaTexto ? `*Hora:* ${horaTexto}` : null,
    url ? `*Confirma aquí:* ${url}` : null,
  ];

  return lineas.filter(Boolean).join("\n");
}
