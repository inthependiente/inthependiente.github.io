import type { ClienteAgencia, CrewLlamado, Persona } from '../types';
import { normalizarHora } from './format';

export interface HoraPersonalizada {
  nombre: string;
  hora: string | null;
}

/**
 * Hora de llamado de la persona dueña de un link personal.
 *
 * Mantiene la misma prioridad que el panel de invitaciones:
 * `crew_llamado.hora_llamado` → `crew.llamado_hora` → hora general del llamado.
 * Devuelve `null` cuando no hay persona identificada (link general o de cliente).
 */
export function horaPersonalizada(
  crew: CrewLlamado[],
  persona: Persona | null,
  horaGeneral?: string | null,
): HoraPersonalizada | null {
  if (!persona) return null;

  const fila = crew.find((item) => item.crew_id === persona.crewId);
  const nombre = (fila?.crew?.nombre ?? persona.nombre ?? '').trim();
  if (!nombre) return null;

  const hora =
    normalizarHora(fila?.hora_llamado ?? fila?.crew?.llamado_hora ?? null) ??
    normalizarHora(horaGeneral);

  return { nombre, hora };
}

/**
 * Hora de llamado del link de cliente: la primera fila de `cliente_agencia`
 * del llamado aporta su `horario_loc`; si no la define, se usa la general.
 */
export function horaCliente(
  clientes: ClienteAgencia[] | null | undefined,
  horaGeneral?: string | null,
): HoraPersonalizada | null {
  const fila = clientes?.[0];
  if (!fila) return null;

  return {
    nombre: (fila.nombre ?? '').trim(),
    hora: normalizarHora(fila.horario_loc) ?? normalizarHora(horaGeneral),
  };
}
