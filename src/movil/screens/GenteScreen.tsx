import { useMemo } from 'react';
import { Contact, Users } from 'lucide-react';
import AppBar from '../components/AppBar';
import FichaPersona from '../components/FichaPersona';
import ListaPersonas from '../components/ListaPersonas';
import type { GenteTab } from '../lib/router';
import type { LlamadoData } from '../types';
import { construirVCard, construirVCardMultiple, descargarVCard } from '../lib/contacto';
import { slug } from '../lib/format';
import {
  agruparCrew,
  contactosDeCrew,
  crewAPersonas,
  mensajeWhatsapp,
  talentoAPersonas,
  type Persona,
} from '../lib/personas';

interface Props {
  data: LlamadoData;
  /** Pestaña activa (#/gente o #/gente/talento). */
  genteTab: GenteTab;
  /** Id de la persona abierta (#/gente/crew/:id). */
  seleccionadoId?: number;
}

const PESTANAS: { key: GenteTab; label: string }[] = [
  { key: 'crew', label: 'Crew' },
  { key: 'talento', label: 'Talento' },
];

export default function GenteScreen({ data, genteTab, seleccionadoId }: Props) {
  const crew = useMemo(() => crewAPersonas(data.crew), [data.crew]);
  const talento = useMemo(() => talentoAPersonas(data.talento), [data.talento]);

  const personas = genteTab === 'crew' ? crew : talento;

  // El elenco no se agrupa por departamento: una sola lista en orden de personaje.
  const gruposCrew = useMemo(() => agruparCrew(crew), [crew]);
  const gruposTalento = useMemo(
    () => (talento.length ? [{ clave: 'talento', titulo: 'Elenco del día', personas: talento }] : []),
    [talento],
  );

  const organizacion = data.llamado.proyectos?.productora ?? null;
  const proyecto = slug(data.llamado.proyectos?.campana ?? 'llamado');

  const seleccionada = seleccionadoId
    ? personas.find((persona) => persona.id === seleccionadoId)
    : undefined;

  const abrir = (persona: Persona) => {
    window.location.hash = `#/gente/${genteTab}/${persona.id}`;
  };

  const volver = () => {
    window.location.hash = `#/gente/${genteTab}`;
  };

  if (seleccionada) {
    return (
      <>
        <AppBar title={genteTab === 'crew' ? 'Crew' : 'Talento'} onBack={volver} />
        <div className="px-3 pt-3">
          {genteTab === 'crew' ? (
            <FichaPersona
              persona={seleccionada}
              mensajeWa={mensajeWhatsapp(data.llamado, seleccionada.nombre)}
              organizacion={organizacion}
              onGuardarContacto={() =>
                descargarVCard(
                  construirVCard({
                    nombre: seleccionada.nombre,
                    cargo: seleccionada.cargo,
                    departamento: seleccionada.departamento,
                    telefono: seleccionada.telefono,
                    notas:
                      [seleccionada.notas, seleccionada.hora ? `Llamado ${seleccionada.hora}` : null]
                        .filter(Boolean)
                        .join(' · ') || null,
                    organizacion,
                  }),
                  `crew-${slug(seleccionada.nombre)}-${proyecto}`,
                )
              }
            />
          ) : (
            // El talento no expone teléfono: la ficha queda sin acciones de contacto.
            <FichaPersona persona={seleccionada} mensajeWa="" organizacion={organizacion} />
          )}
        </div>
      </>
    );
  }

  const conTelefono = crew.filter((persona) => persona.telefono).length;

  const guardarTodos = () => {
    const contactos = contactosDeCrew(data);
    descargarVCard(construirVCardMultiple(contactos), `crew-${proyecto}`);
  };

  return (
    <>
      <AppBar title="Gente" />

      <div className="px-3 pt-3">
        <PestanasGente activa={genteTab} totalCrew={crew.length} totalTalento={talento.length} />

        {genteTab === 'crew' ? (
          <>
            {crew.length > 0 && (
              <p className="mb-2 mt-3 flex items-center gap-1.5 px-1 text-[10px] text-content-subtle">
                <Users className="h-3 w-3" />
                {crew.length} personas · {conTelefono} con teléfono
              </p>
            )}

            <ListaPersonas
              grupos={gruposCrew}
              conTelefono
              tituloVacio="Sin crew asignado"
              detalleVacio="Producción todavía no asignó el equipo de este llamado."
              onAbrir={abrir}
            >
              {crew.length > 0 && (
                <button
                  type="button"
                  onClick={guardarTodos}
                  className="btn btn-secondary btn-lg btn-block mt-4 h-11"
                >
                  <Contact className="h-4 w-4" />
                  Guardar contacto de todo el crew
                </button>
              )}
            </ListaPersonas>
          </>
        ) : (
          <div className="mt-3">
            <ListaPersonas
              grupos={gruposTalento}
              conTelefono={false}
              tituloVacio="Sin talento asignado"
              detalleVacio="Producción todavía no cargó el elenco de este llamado."
              onAbrir={abrir}
            />
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────── Pestañas ─────────────────────────── */

function PestanasGente({
  activa,
  totalCrew,
  totalTalento,
}: {
  activa: GenteTab;
  totalCrew: number;
  totalTalento: number;
}) {
  const totales: Record<GenteTab, number> = { crew: totalCrew, talento: totalTalento };

  return (
    <div
      role="tablist"
      aria-label="Crew y talento"
      className="flex gap-1 rounded-lg border border-hairline bg-subtle p-1"
    >
      {PESTANAS.map(({ key, label }) => {
        const seleccionada = key === activa;
        return (
          <a
            key={key}
            role="tab"
            href={key === 'crew' ? '#/gente' : `#/gente/${key}`}
            aria-selected={seleccionada}
            onClick={() => window.scrollTo({ top: 0 })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold transition-colors ${
              seleccionada
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-muted active:bg-surface/60'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                seleccionada ? 'bg-brand-subtle text-brand-content' : 'bg-hairline/60 text-content-subtle'
              }`}
            >
              {totales[key]}
            </span>
          </a>
        );
      })}
    </div>
  );
}
