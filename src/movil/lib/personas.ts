import type { CrewLlamado, Llamado, Talento } from '../types';
import { normalizarTelefono, type Telefono } from './contacto';
import { normalizarHora } from './format';

/** Orden canónico de departamentos, igual que en el llamado en PDF. */
export const DEPT_ORDER = [
  'dirección',
  'producción',
  'cámara',
  'foto fija',
  'arte',
  'sonido',
  'luces / grip',
  'maquillaje y vestuario',
  'transporte',
  'catering',
];

export interface Campo {
  etiqueta: string;
  valor: string;
}

export interface Persona {
  /** Clave estable para el ruteo (#/crew/:id). */
  id: number;
  nombre: string;
  /** Cargo del crew o personaje del talento. */
  cargo: string | null;
  departamento: string | null;
  hora: string | null;
  telefono: Telefono | null;
  telefonoTexto: string | null;
  notas: string | null;
  /** Campos extra que se muestran en la ficha (locación, en set, estado…). */
  extra: Campo[];
  estado: string | null;
}

export interface GrupoPersonas {
  clave: string;
  titulo: string;
  personas: Persona[];
}

const normalizarDepto = (valor?: string | null) => (valor ?? '').trim().toLowerCase();

/** Une 'Luces / grip' y 'Luces / Grip' en un mismo grupo y usa la primera grafía. */
function etiquetaDeDepartamento(personas: { departamento: string | null }[], clave: string): string {
  const original = personas.find((persona) => normalizarDepto(persona.departamento) === clave)?.departamento;
  if (!original) return 'Otros';
  // Se respeta la grafía guardada y solo se asegura la mayúscula inicial:
  // capitalizar palabra por palabra convertía «Maquillaje y Vestuario» en
  // «Maquillaje Y Vestuario».
  const texto = original.trim();
  return texto ? texto[0].toUpperCase() + texto.slice(1) : 'Otros';
}

export function crewAPersonas(crew: CrewLlamado[]): Persona[] {
  return [...crew]
    .sort((a, b) => (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER))
    .filter((fila) => Boolean(fila.crew?.nombre))
    .map((fila) => {
      const persona = fila.crew!;
      const telefonoTexto = persona.celular?.trim() || null;

      return {
        id: fila.crew_id,
        nombre: persona.nombre.trim(),
        cargo: persona.cargo?.trim() || null,
        departamento: persona.departamento?.trim() || null,
        hora: normalizarHora(fila.hora_llamado ?? persona.llamado_hora ?? null),
        telefono: normalizarTelefono(telefonoTexto),
        telefonoTexto,
        notas: (fila.notas || persona.notas || '').trim() || null,
        extra: [],
        estado: null,
      };
    });
}

export function talentoAPersonas(talento: Talento[]): Persona[] {
  return [...talento]
    .sort((a, b) => (a.id_personaje ?? a.id) - (b.id_personaje ?? b.id))
    .map((persona) => {
      const extra: Campo[] = [];
      if (persona.locaciones?.locacion) extra.push({ etiqueta: 'Locación', valor: persona.locaciones.locacion });
      if (normalizarHora(persona.en_set)) extra.push({ etiqueta: 'En set', valor: normalizarHora(persona.en_set)! });
      if (persona.id_personaje != null) extra.push({ etiqueta: 'Personaje', valor: String(persona.id_personaje) });

      return {
        id: persona.id,
        nombre: persona.nombre.trim(),
        cargo: persona.rol?.trim() || null,
        departamento: null,
        hora: normalizarHora(persona.llamado_hora),
        telefono: null,
        telefonoTexto: null,
        notas: persona.notas?.trim() || null,
        extra,
        estado: persona.w_status?.trim().toUpperCase() || null,
      };
    });
}

/** Agrupa por departamento respetando DEPT_ORDER y luego alfabéticamente. */
export function agruparCrew(personas: Persona[]): GrupoPersonas[] {
  const grupos = new Map<string, Persona[]>();

  for (const persona of personas) {
    const clave = normalizarDepto(persona.departamento) || 'otros';
    const lista = grupos.get(clave) ?? [];
    lista.push(persona);
    grupos.set(clave, lista);
  }

  const claves = [...grupos.keys()].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a);
    const ib = DEPT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'es');
  });

  return claves.map((clave) => ({
    clave,
    titulo: etiquetaDeDepartamento(grupos.get(clave)!, clave),
    personas: grupos.get(clave)!,
  }));
}

export function filtrarPersonas(
  grupos: GrupoPersonas[],
  busqueda: string,
): GrupoPersonas[] {
  const termino = busqueda.trim().toLowerCase();
  if (!termino) return grupos;

  return grupos
    .map((grupo) => ({
      ...grupo,
      personas: grupo.personas.filter((persona) =>
        `${persona.nombre} ${persona.cargo ?? ''} ${persona.departamento ?? ''}`
          .toLowerCase()
          .includes(termino),
      ),
    }))
    .filter((grupo) => grupo.personas.length > 0);
}

/** Mensaje precargado de WhatsApp con el contexto del llamado. */
export function mensajeWhatsapp(llamado: Llamado, nombre: string): string {
  const campana = llamado.proyectos?.campana?.trim();
  return campana ? `Hola ${nombre.split(' ')[0]}, te escribo por el llamado de ${campana}.` : `Hola ${nombre.split(' ')[0]}, te escribo por el llamado.`;
}
