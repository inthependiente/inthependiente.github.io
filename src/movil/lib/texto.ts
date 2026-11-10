/**
 * Plegado de líneas para formatos heredados de iCalendar y vCard (RFC 5545/6350):
 * máximo 75 octetos por línea, las continuaciones empiezan con un espacio.
 * Se cuenta en UTF-8, no en caracteres, porque un acento ocupa 2 octetos.
 */
export function plegarLinea(linea: string, limite = 75): string {
  const codificador = new TextEncoder();
  if (codificador.encode(linea).length <= limite) return linea;

  const partes: string[] = [];
  let actual = '';
  let octetos = 0;

  for (const caracter of linea) {
    const tamano = codificador.encode(caracter).length;
    // Las continuaciones llevan un espacio inicial: se descuenta del límite.
    const tope = partes.length === 0 ? limite : limite - 1;

    if (octetos + tamano > tope) {
      partes.push(actual);
      actual = caracter;
      octetos = tamano;
      continue;
    }

    actual += caracter;
    octetos += tamano;
  }

  if (actual) partes.push(actual);

  return partes.map((parte, indice) => (indice === 0 ? parte : ` ${parte}`)).join('\r\n');
}

/** Escapa los caracteres reservados de vCard e iCalendar en valores de texto. */
export function escaparValor(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Quita marcas de control invisibles (p. ej. U+202C) que vienen al copiar y pegar. */
export function limpiarInvisibles(valor: string): string {
  return valor.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}
