import { escaparValor, limpiarInvisibles, plegarLinea } from './texto';

export interface Telefono {
  /** Formato internacional para marcar: +59176788201 */
  e164: string;
  /** Solo dígitos con código de país, para wa.me: 59176788201 */
  wa: string;
  /** Presentación local agrupada: 767 882 01 */
  display: string;
}

const CODIGO_BOLIVIA = '591';

/**
 * Normaliza un número escrito a mano. Los datos reales traen espacios, guiones y
 * marcas invisibles (U+202C), así que solo se conservan los dígitos.
 * Devuelve null si no queda un número boliviano de 8 dígitos utilizable.
 */
export function normalizarTelefono(valor?: string | null): Telefono | null {
  if (!valor) return null;

  let digitos = limpiarInvisibles(String(valor)).replace(/[^\d]/g, '');
  if (!digitos) return null;

  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (digitos.length === 11 && digitos.startsWith(CODIGO_BOLIVIA)) digitos = digitos.slice(3);
  if (digitos.length === 9 && digitos.startsWith('0')) digitos = digitos.slice(1);

  if (digitos.length !== 8) return null;

  return {
    e164: `+${CODIGO_BOLIVIA}${digitos}`,
    wa: `${CODIGO_BOLIVIA}${digitos}`,
    display: `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`,
  };
}

export function telHref(telefono: Telefono): string {
  return `tel:${telefono.e164}`;
}

/** Abre WhatsApp con un mensaje ya escrito si se entrega uno. */
export function whatsappHref(telefono: Telefono, mensaje?: string | null): string {
  const base = `https://wa.me/${telefono.wa}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

export interface ContactoVCard {
  nombre: string;
  cargo?: string | null;
  departamento?: string | null;
  telefono?: Telefono | null;
}

/** Separa el nombre para el campo N (apellido;nombre). */
function partesNombre(nombre: string): { pila: string; nombrePropio: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombrePropio: nombre.trim(), pila: '' };
  return { nombrePropio: partes[0], pila: partes.slice(1).join(' ') };
}

function vcardDe(contacto: ContactoVCard): string[] {
  const { nombrePropio, pila } = partesNombre(contacto.nombre);

  const lineas = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escaparValor(pila)};${escaparValor(nombrePropio)};;;`,
    `FN:${escaparValor(contacto.nombre)}`,
  ];

  if (contacto.cargo) lineas.push(`TITLE:${escaparValor(contacto.cargo)}`);
  if (contacto.departamento) lineas.push(`CATEGORIES:${escaparValor(contacto.departamento)}`);
  // Un solo `TYPE` (un parámetro repetido es vCard 4.0 y iOS lo interpreta como
  // una línea extra vacía).
  if (contacto.telefono) lineas.push(`TEL;TYPE=CELL:${contacto.telefono.e164}`);

  lineas.push('END:VCARD');
  return lineas;
}

export function construirVCard(contacto: ContactoVCard): string {
  return `${vcardDe(contacto).map((linea) => plegarLinea(linea)).join('\r\n')}\r\n`;
}

/** Android muestra la notificación de descarga, así que las instrucciones cambian. */
function esAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/**
 * Guarda el contacto como .vcf, que es la única vía posible desde la web.
 *
 * No se puede abrir el editor de Contactos con un intent `ACTION_INSERT`: Chrome
 * inyecta `android.intent.category.BROWSABLE` en todo intent que abre una página
 * (`ExternalNavigationHandler.sanitizeQueryIntentActivitiesIntent`, que además
 * limpia `component` y `selector`) y el editor de Contactos solo declara
 * `DEFAULT`, así que el intent nunca resuelve y no se lanza nada.
 */
export function guardarContacto(contacto: ContactoVCard, nombreArchivo: string): void {
  descargarVCard(construirVCard(contacto), nombreArchivo);
}

/** Cómo continuar después de descargar el .vcf, según la plataforma. */
export function instruccionImportar(): string {
  return esAndroid()
    ? 'Ábrelo desde la notificación de descarga para agregarlo a Contactos.'
    : 'Ábrelo desde tus descargas para agregarlo a Contactos.';
}

/**
 * Descarga el archivo .vcf, que el teléfono importa a Contactos al abrirlo.
 * Safari en iOS ignora la navegación a `data:` (igual que con el .ics), así que
 * se usa siempre el atributo `download`; el enlace tiene que estar en el DOM y
 * el click ocurrir dentro del gesto del usuario.
 */
export function descargarVCard(vcf: string, nombreArchivo: string): void {
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = `${nombreArchivo.replace(/\.vcf$/i, '')}.vcf`;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);

  try {
    enlace.click();
  } catch {
    window.location.href = url;
  } finally {
    enlace.remove();
    // iOS lee el blob de forma asíncrona: revocarlo pronto deja el archivo vacío.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
