#!/usr/bin/env node
/**
 * Borra del bucket `storyboards` las carpetas que ya no tienen ficha en la
 * tabla `public.storyboards` (imágenes de storyboards eliminados antes de que
 * el panel borrara también el almacenamiento).
 *
 * Uso:
 *   node scripts/limpiar-storyboards-huerfanos.mjs                       # simulación
 *   node scripts/limpiar-storyboards-huerfanos.mjs --confirm --cli       # borra usando la CLI
 *   SUPABASE_ACCESS_TOKEN="<jwt de un admin>" \
 *     node scripts/limpiar-storyboards-huerfanos.mjs --confirm           # borra con JWT
 *
 * El listado usa la anon key del proyecto (lectura pública). El borrado exige
 * autenticación, porque el bucket ya no acepta escrituras anónimas:
 *   · `--cli` delega en `supabase storage rm -r` (usa la sesión de la CLI).
 *   · `SUPABASE_ACCESS_TOKEN` usa el JWT de una sesión del admin.
 * El token no se imprime ni se guarda.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'storyboards';
const LOTE = 100;

function leerCredenciales() {
  const archivo = path.join(RAIZ, 'src', 'supabaseClient.ts');
  const fuente = fs.readFileSync(archivo, 'utf8');
  const url = /SUPABASE_URL\s*=\s*"([^"]+)"/.exec(fuente)?.[1];
  const anon = /SUPABASE_ANON\s*=\s*"([^"]+)"/.exec(fuente)?.[1];
  if (!url || !anon) throw new Error('No pudimos leer SUPABASE_URL / SUPABASE_ANON de src/supabaseClient.ts');
  return { url, anon };
}

const { url, anon } = leerCredenciales();
const confirmar = process.argv.includes('--confirm');
const porCli = process.argv.includes('--cli');
const jwt = process.env.SUPABASE_ACCESS_TOKEN ?? '';

const cabeceras = (token) => ({ apikey: anon, Authorization: `Bearer ${token}` });

async function listarPagina(prefijo, offset, token) {
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...cabeceras(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefijo, limit: LOTE, offset }),
  });
  if (!res.ok) throw new Error(`list ${prefijo}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listarTodo(prefijo) {
  const objetos = [];
  for (let offset = 0; ; offset += LOTE) {
    const pagina = await listarPagina(prefijo, offset, anon);
    objetos.push(...pagina);
    if (pagina.length < LOTE) break;
  }
  return objetos;
}

async function borrar(rutas, token) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...cabeceras(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: rutas }),
  });
  if (!res.ok) throw new Error(`delete: ${res.status} ${await res.text()}`);
  return res.json();
}

function peso(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}

const respuesta = await fetch(`${url}/rest/v1/storyboards?select=id`, { headers: cabeceras(anon) });
if (!respuesta.ok) throw new Error(`storyboards: ${respuesta.status} ${await respuesta.text()}`);
const vigentes = new Set((await respuesta.json()).map((fila) => String(fila.id)));

const raiz = await listarPagina('', 0, anon);
const carpetas = raiz.filter((objeto) => objeto.id === null).map((objeto) => objeto.name);
const huerfanas = carpetas.filter((nombre) => !vigentes.has(nombre));

console.log(`Storyboards con ficha: ${[...vigentes].sort().join(', ') || '—'}`);
console.log(`Carpetas en el bucket: ${carpetas.sort().join(', ') || '—'}`);

if (huerfanas.length === 0) {
  console.log('\n✅ No hay carpetas huérfanas.');
  process.exit(0);
}

let totalArchivos = 0;
let totalBytes = 0;
const plan = [];

for (const carpeta of huerfanas.sort()) {
  const objetos = (await listarTodo(`${carpeta}/`)).filter((objeto) => objeto.id);
  const bytes = objetos.reduce((suma, objeto) => suma + (objeto.metadata?.size ?? 0), 0);
  totalArchivos += objetos.length;
  totalBytes += bytes;
  plan.push({ carpeta, rutas: objetos.map((objeto) => `${carpeta}/${objeto.name}`), bytes });
  console.log(`  ${carpeta}/ → ${objetos.length} archivos, ${peso(bytes)}`);
}

console.log(`\nHuérfanas: ${huerfanas.length} carpetas, ${totalArchivos} archivos, ${peso(totalBytes)}`);

if (!confirmar) {
  console.log(
    '\nSimulación. Para borrar de verdad: node scripts/limpiar-storyboards-huerfanos.mjs --confirm --cli',
  );
  process.exit(0);
}

if (!porCli && !jwt) {
  console.error(
    '\n❌ Falta autenticación: usa --cli (sesión de la CLI) o define SUPABASE_ACCESS_TOKEN.',
  );
  process.exit(1);
}

for (const { carpeta, rutas } of plan) {
  if (porCli) {
    // Sin shell: el nombre de la carpeta va como argumento literal.
    execFileSync(
      'supabase',
      ['storage', 'rm', '-r', `ss:///storyboards/${carpeta}`, '--remote', '--experimental', '--yes'],
      { stdio: 'inherit' },
    );
  } else {
    for (let i = 0; i < rutas.length; i += LOTE) {
      await borrar(rutas.slice(i, i + LOTE), jwt);
    }
  }

  const restantes = (await listarTodo(`${carpeta}/`)).filter((objeto) => objeto.id);
  console.log(`${restantes.length === 0 ? '✅' : '⚠️'} ${carpeta}/ → ${restantes.length} objetos restantes`);
}

process.exit(0);
