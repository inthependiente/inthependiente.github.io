import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsvRows } from './csvParser';

test('CSV nuevo de dos columnas sin encabezado', () => {
  assert.deepEqual(
    parseCsvRows([
      ['01', 'Locución uno'],
      ['02', 'Locución dos'],
    ]),
    [
      { filename: '01', locution: 'Locución uno' },
      { filename: '02', locution: 'Locución dos' },
    ],
  );
});

test('CSV antiguo de tres columnas: la descripción se ignora', () => {
  assert.deepEqual(
    parseCsvRows([
      ['01', 'Descripción que ya no se usa', 'Locución uno'],
      ['02', 'Otra descripción', 'Locución dos'],
    ]),
    [
      { filename: '01', locution: 'Locución uno' },
      { filename: '02', locution: 'Locución dos' },
    ],
  );
});

test('con encabezado respeta el orden real de las columnas', () => {
  assert.deepEqual(
    parseCsvRows([
      ['Locución', 'Viñeta'],
      ['Texto primero', '03'],
    ]),
    [{ filename: '03', locution: 'Texto primero' }],
  );
});

test('encabezado con descripción en medio: solo viñeta y locución', () => {
  assert.deepEqual(
    parseCsvRows([
      ['Viñeta', 'Descripción', 'Locución'],
      ['04', 'Se ignora', 'Texto cuatro'],
    ]),
    [{ filename: '04', locution: 'Texto cuatro' }],
  );
});

test('una sola columna se toma como locución', () => {
  assert.deepEqual(parseCsvRows([['Solo texto']]), [{ filename: '', locution: 'Solo texto' }]);
});

test('ignora filas vacías y recorta espacios', () => {
  assert.deepEqual(
    parseCsvRows([
      ['  01  ', '  texto  '],
      [''],
      [],
      ['02', ''],
    ]),
    [
      { filename: '01', locution: 'texto' },
      { filename: '02', locution: '' },
    ],
  );
});

test('sin datos devuelve lista vacía', () => {
  assert.deepEqual(parseCsvRows([]), []);
});

test('la primera fila de datos nunca se toma por encabezado', () => {
  assert.deepEqual(
    parseCsvRows([
      ['1A', 'Locución que empieza la lista'],
      ['1B', 'Otra'],
    ]),
    [
      { filename: '1A', locution: 'Locución que empieza la lista' },
      { filename: '1B', locution: 'Otra' },
    ],
  );

  assert.deepEqual(parseCsvRows([['Plano 3', 'Texto']]), [{ filename: 'Plano 3', locution: 'Texto' }]);
});
