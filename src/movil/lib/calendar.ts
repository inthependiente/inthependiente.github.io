import type { LlamadoData } from '../types';
import { normalizarHora, parseFecha } from './format';
import { buildTimeline } from './pdr';
import { escaparValor, plegarLinea } from './texto';
import { publicLink } from './params';
import { navegadorIOS, plataformaActual, type NavegadorIOS, type Plataforma } from './plataforma';

export interface CalendarEvent {
  summary: string;
  location?: string;
  description?: string;
  start: Date;
  end: Date;
}

/** Arma el evento del día: hora de llamado → cierre del Plan de Rodaje. */
export function construirEvento(data: LlamadoData): CalendarEvent | null {
  const { llamado } = data;
  const proyecto = llamado.proyectos;
  const fecha = parseFecha(llamado.fecha);
  const hora = normalizarHora(llamado.llamado_hora);
  if (!fecha || !hora) return null;

  const [horas, minutos] = hora.split(':').map(Number);
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), horas, minutos, 0, 0);

  const fin = finDelLlamado(data, fecha, inicio);

  const locacion = data.escenas.find((escena) => escena.locaciones?.locacion)?.locaciones;
  const lugar = locacion
    ? [locacion.locacion, locacion.direccion_loc].filter(Boolean).join(' — ')
    : llamado.lugar_llamado || proyecto?.direccion_productora || undefined;

  const detalles = [
    `Hora de llamado: ${hora}`,
    proyecto?.productora ? `Productora: ${proyecto.productora}` : null,
    proyecto?.direccion_productora ? `Dirección de producción: ${proyecto.direccion_productora}` : null,
    llamado.desayuno ? `Desayuno: ${normalizarHora(llamado.desayuno)}` : null,
    llamado.almuerzo ? `Almuerzo: ${normalizarHora(llamado.almuerzo)}` : null,
    llamado.cena ? `Cena: ${normalizarHora(llamado.cena)}` : null,
    llamado.notas ? `Notas: ${llamado.notas}` : null,
    `Llamado completo: ${publicLink(llamado.id)}`,
  ].filter(Boolean) as string[];

  return {
    summary: `${proyecto?.campana ?? 'Llamado'} — Llamado`,
    location: lugar || undefined,
    description: detalles.join('\n'),
    start: inicio,
    end: fin,
  };
}

/**
 * Fin del evento: el cierre del Plan de Rodaje (fila "Cierre del Día" /
 * "Cierre de Claqueta"). Si el plan está vacío o su cierre no es posterior al
 * llamado, se usa la cena y, en último caso, 12 h.
 */
function finDelLlamado(data: LlamadoData, fecha: Date, inicio: Date): Date {
  const timeline = buildTimeline(data.pdr, data.talento, data.llamado.llamado_hora);
  const desdeMedianoche = (minutos: number) =>
    new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, minutos, 0, 0);

  if (timeline.cierreMin != null) {
    const cierre = desdeMedianoche(timeline.cierreMin);
    if (cierre > inicio) return cierre;
  }

  const cena = normalizarHora(data.llamado.cena);
  if (cena) {
    const [horaCena, minutoCena] = cena.split(':').map(Number);
    const fin = new Date(inicio);
    fin.setHours(horaCena, minutoCena, 0, 0);
    if (fin > inicio) return fin;
  }

  return new Date(inicio.getTime() + 12 * 60 * 60 * 1000);
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Hora local sin zona: los calendarios la interpretan en la zona del dispositivo. */
function fechaLocal(fecha: Date): string {
  return (
    `${fecha.getFullYear()}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(fecha.getDate())}` +
    `T${dosDigitos(fecha.getHours())}${dosDigitos(fecha.getMinutes())}00`
  );
}

function fechaUtc(fecha: Date): string {
  return `${fecha.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

export function buildIcs(evento: CalendarEvent, uid: string): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LlamadoAPP//Llamado//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fechaUtc(new Date())}`,
    `DTSTART:${fechaLocal(evento.start)}`,
    `DTEND:${fechaLocal(evento.end)}`,
    plegarLinea(`SUMMARY:${escaparValor(evento.summary)}`),
    ...(evento.location ? [plegarLinea(`LOCATION:${escaparValor(evento.location)}`)] : []),
    ...(evento.description ? [plegarLinea(`DESCRIPTION:${escaparValor(evento.description)}`)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lineas.join('\r\n')}\r\n`;
}

/**
 * Descarga el `.ics` con el atributo `download`, que es el único mecanismo que
 * Safari en iOS respeta: ignora la navegación a `data:` y muestra los `blob:`
 * como texto si no se fuerza la descarga. El ancla debe estar en el DOM y el
 * click tiene que ocurrir dentro del gesto del usuario.
 */
export function downloadIcs(evento: CalendarEvent, uid: string, nombreArchivo: string): void {
  const ics = buildIcs(evento, uid);
  const nombre = nombreArchivo.endsWith('.ics') ? nombreArchivo : `${nombreArchivo}.ics`;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);

  try {
    enlace.click();
  } catch {
    window.location.href = url;
  } finally {
    enlace.remove();
    // iOS lee el blob de forma asíncrona: revocarlo pronto deja la descarga vacía.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function googleCalendarUrl(evento: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.summary,
    dates: `${fechaUtc(evento.start)}/${fechaUtc(evento.end)}`,
  });

  if (evento.location) params.set('location', evento.location);
  if (evento.description) params.set('details', evento.description);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type DestinoCalendario = 'ics' | 'google';

/**
 * Elige el camino del botón "Añadir a calendario".
 * · iPhone/iPad: siempre `.ics`, en cualquier navegador. Safari lo entrega a
 *   Calendario y lo abre; Chrome, Brave, Firefox, Edge y Opera lo descargan a su
 *   gestor y el usuario lo abre desde ahí (iOS no permite otra cosa).
 * · Android: App Link de Google Calendar.
 * · Escritorio: `.ics`.
 */
export function destinoCalendario(): DestinoCalendario {
  return plataformaActual() === 'android' ? 'google' : 'ics';
}

export interface ResultadoCalendario {
  destino: DestinoCalendario;
  plataforma: Plataforma;
  /** Navegador iOS detectado; null fuera de iOS. */
  navegador: NavegadorIOS | null;
}

/** Añade el evento al calendario del teléfono sin pedirle nada al usuario. */
export function agregarACalendario(
  evento: CalendarEvent,
  uid: string,
  nombreArchivo: string,
): ResultadoCalendario {
  const destino = destinoCalendario();

  if (destino === 'google') {
    const url = googleCalendarUrl(evento);
    // `noopener` hace que open() devuelva null incluso al abrir bien, así que se
    // limpia `opener` a mano para no navegar dos veces cuando sí funciona.
    const ventana = window.open(url, '_blank');
    if (ventana) ventana.opener = null;
    else window.location.href = url;
  } else {
    downloadIcs(evento, uid, nombreArchivo);
  }

  return { destino, plataforma: plataformaActual(), navegador: navegadorIOS() };
}
