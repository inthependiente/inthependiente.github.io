import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  borrarArchivos,
  formatearBytes,
  quedanArchivos,
  recolectarArchivos,
} from './borrado';

/** Bucket falso: mapa ruta → bytes, con la misma API que usa borrado.ts. */
function crearBucket(inicial: Record<string, number> = {}) {
  const archivos = new Map<string, number>(Object.entries(inicial));
  const llamadas = { list: 0, remove: 0 };
  /** Rutas que el servidor rechaza siempre. */
  const bloqueadas = new Set<string>();
  /** Prefijos cuyo listado falla. */
  let errorListado: string | null = null;

  const cliente = {
    storage: {
      from() {
        return {
          async list(prefijo: string, opciones: { limit: number; offset: number }) {
            llamadas.list += 1;
            if (errorListado && prefijo.startsWith(errorListado)) {
              return { data: null, error: { message: 'permiso denegado' } };
            }

            const nombres = new Set<string>();
            for (const ruta of archivos.keys()) {
              if (!ruta.startsWith(prefijo)) continue;
              const resto = ruta.slice(prefijo.length);
              const corte = resto.indexOf('/');
              nombres.add(corte === -1 ? resto : `${resto.slice(0, corte)}/`);
            }

            const ordenados = [...nombres].sort((a, b) => a.localeCompare(b));
            const pagina = ordenados.slice(opciones.offset, opciones.offset + opciones.limit);

            return {
              data: pagina.map((nombre) => {
                const ruta = `${prefijo}${nombre}`;
                const esCarpeta = nombre.endsWith('/');
                return {
                  name: nombre.replace(/\/$/, ''),
                  id: esCarpeta ? null : ruta,
                  metadata: esCarpeta ? null : { size: archivos.get(ruta) ?? 0 },
                };
              }),
              error: null,
            };
          },
          async remove(rutas: string[]) {
            llamadas.remove += 1;
            if (rutas.some((ruta) => bloqueadas.has(ruta))) {
              return { data: null, error: { message: 'fallo simulado' } };
            }
            for (const ruta of rutas) archivos.delete(ruta);
            return { data: rutas.map((ruta) => ({ name: ruta })), error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { cliente, archivos, llamadas, bloqueadas, setErrorListado: (p: string | null) => { errorListado = p; } };
}

test('recolecta más de 100 archivos paginando la lista', async () => {
  const inicial: Record<string, number> = {};
  for (let i = 1; i <= 250; i += 1) inicial[`7/foto_${String(i).padStart(3, '0')}.jpg`] = 1000;
  const bucket = crearBucket(inicial);

  const archivos = await recolectarArchivos(7, [], bucket.cliente);

  assert.equal(archivos.length, 250);
  assert.equal(archivos[0].path, '7/foto_001.jpg');
  assert.ok(bucket.llamadas.list >= 3);
});

test('recorre carpetas anidadas y no las cuenta como archivos', async () => {
  const bucket = crearBucket({
    '7/a.jpg': 10,
    '7/viejas/b.jpg': 20,
    '7/viejas/mas/c.jpg': 30,
  });

  const archivos = await recolectarArchivos(7, [], bucket.cliente);

  assert.deepEqual(
    archivos.map((archivo) => archivo.path),
    ['7/a.jpg', '7/viejas/b.jpg', '7/viejas/mas/c.jpg'],
  );
});

test('incluye rutas declaradas en el JSON que quedaron fuera de la carpeta', async () => {
  const bucket = crearBucket({ '7/a.jpg': 10, '3/hereda.jpg': 40 });

  const archivos = await recolectarArchivos(
    7,
    [
      {
        image_path: '3/hereda.jpg',
        image_url: 'https://x.supabase.co/storage/v1/object/public/storyboards/7/a.jpg',
      },
    ] as never,
    bucket.cliente,
  );

  assert.deepEqual(
    archivos.map((archivo) => archivo.path),
    ['3/hereda.jpg', '7/a.jpg'],
  );
  assert.equal(archivos[0].bytes, 0);
});

test('borra todo, informa progreso y deja la carpeta vacía', async () => {
  const inicial: Record<string, number> = {};
  for (let i = 1; i <= 220; i += 1) inicial[`9/f_${i}.jpg`] = 500;
  const bucket = crearBucket(inicial);
  const progreso: number[] = [];

  const archivos = await recolectarArchivos(9, [], bucket.cliente);
  const resultado = await borrarArchivos(9, archivos, bucket.cliente, (hechos) =>
    progreso.push(hechos),
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.borrados.length, 220);
  assert.equal(resultado.bytes, 220 * 500);
  assert.deepEqual(resultado.fallos, []);
  assert.deepEqual(await quedanArchivos(9, bucket.cliente), []);
  assert.deepEqual(progreso, [100, 200, 220]);
  assert.equal(bucket.archivos.size, 0);
});

test('si un archivo no se puede borrar no reporta éxito y lo deja visible', async () => {
  const bucket = crearBucket({ '9/a.jpg': 10, '9/b.jpg': 20, '9/c.jpg': 30 });
  bucket.bloqueadas.add('9/b.jpg');

  const archivos = await recolectarArchivos(9, [], bucket.cliente);
  const resultado = await borrarArchivos(9, archivos, bucket.cliente);

  assert.equal(resultado.ok, false);
  assert.deepEqual(resultado.fallos.map((fallo) => fallo.path), ['9/b.jpg']);
  assert.deepEqual(resultado.restantes, ['9/b.jpg']);
  assert.deepEqual(resultado.borrados.map((archivo) => archivo.path), ['9/a.jpg', '9/c.jpg']);
  assert.equal(resultado.bytes, 40);
  // El lote falla, se reintenta archivo por archivo.
  assert.equal(bucket.llamadas.remove, 4);
});

test('un listado con error corta el borrado con un mensaje claro', async () => {
  const bucket = crearBucket({ '9/a.jpg': 10 });
  bucket.setErrorListado('9/');

  await assert.rejects(() => recolectarArchivos(9, [], bucket.cliente), /No pudimos listar/);
});

test('formatea tamaños para los avisos', () => {
  assert.equal(formatearBytes(512), '512 B');
  assert.equal(formatearBytes(2048), '2 kB');
  assert.equal(formatearBytes(13000000), '12,4 MB');
});
