import type { CrewLlamado, Persona } from '../types';
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
