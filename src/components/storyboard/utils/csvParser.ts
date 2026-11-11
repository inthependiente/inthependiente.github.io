import type { CsvRow } from '../types';

/** Índice de la columna cuyo encabezado coincide con alguno de los nombres dados. */
function columnaDe(encabezado: string[], nombres: string[]): number {
  return encabezado.findIndex((celda) => {
    const texto = String(celda).toLowerCase();
    return nombres.some((nombre) => texto.includes(nombre));
  });
}

/** Nombres de viñeta habituales: «1», «01», «1A», «Plano 3», «ESC 2». */
function pareceNombreDeVinneta(celda: string): boolean {
  const texto = celda.trim();
  if (!texto) return true;
  return (
    /^\d{1,4}[a-z]?$/i.test(texto) ||
    /^(esc|escena|plano|shot|panel|viñeta)\s*[-_#]?\s*\d/i.test(texto)
  );
}

/**
 * La primera fila es encabezado si trae etiquetas conocidas y su primera celda
 * no es ya un nombre de viñeta (si no, un CSV sin encabezado perdería su
 * primera fila por contener la palabra «locución» en el texto).
 */
function pareceEncabezado(fila: string[]): boolean {
  if (pareceNombreDeVinneta(String(fila[0] ?? ''))) return false;

  return fila.some((celda) => {
    const texto = String(celda).toLowerCase();
    return (
      texto.includes('descripcion') ||
      texto.includes('descripción') ||
      texto.includes('locucion') ||
      texto.includes('locución') ||
      texto.includes('viñeta') ||
      texto.includes('letra') ||
      texto.includes('audio') ||
      texto.includes('id') ||
      texto.includes('nombre')
    );
  });
}

/**
 * Convierte las filas de un CSV en viñeta + locución.
 *
 * Con encabezado se respeta el orden real de las columnas. Sin encabezado se
 * asume `viñeta, locución` y, si hay tres o más, la última es la locución:
 * los CSV antiguos traían la descripción en medio y esa columna se ignora.
 */
export function parseCsvRows(filas: string[][]): CsvRow[] {
  if (!filas || filas.length === 0) return [];

  const primera = filas[0] ?? [];
  const esEncabezado = pareceEncabezado(primera);
  const colFilename = columnaDe(primera, ['viñeta', 'vieta', 'plano', 'nombre', 'id']);
  const colLocution = columnaDe(primera, ['locucion', 'locución', 'letra', 'audio', 'dialogo', 'diálogo']);

  const importadas: CsvRow[] = [];

  for (let i = esEncabezado ? 1 : 0; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila || fila.length === 0 || (fila.length === 1 && !fila[0])) continue;

    const celda = (indice: number) =>
      indice >= 0 && indice < fila.length ? String(fila[indice] ?? '').trim() : '';

    let filename = '';
    let locution = '';

    if (esEncabezado) {
      filename = celda(colFilename);
      locution = celda(colLocution);
    } else if (fila.length >= 3) {
      filename = celda(0);
      locution = celda(fila.length - 1);
    } else if (fila.length === 2) {
      filename = celda(0);
      locution = celda(1);
    } else {
      locution = celda(0);
    }

    if (filename || locution) importadas.push({ filename, locution });
  }

  return importadas;
}
