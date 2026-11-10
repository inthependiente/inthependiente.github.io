import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import AppBar from '../components/AppBar';
import FichaPersona from '../components/FichaPersona';
import ListaPersonas from '../components/ListaPersonas';
import type { GenteTab } from '../lib/router';
import type { LlamadoData } from '../types';
import { guardarContacto, instruccionImportar } from '../lib/contacto';
import { slug } from '../lib/format';
import {
  agruparCrew,
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
  const [avisoContacto, setAvisoContacto] = useState<string | null>(null);

  const crew = useMemo(() => crewAPersonas(data.crew), [data.crew]);
  const talento = useMemo(() => talentoAPersonas(data.talento), [data.talento]);

  const personas = genteTab === 'crew' ? crew : talento;

  // El elenco no se agrupa por departamento: una sola lista en orden de personaje.
  const gruposCrew = useMemo(() => agruparCrew(crew), [crew]);
  const gruposTalento = useMemo(
    () => (talento.length ? [{ clave: 'talento', titulo: 'Elenco del día', personas: talento }] : []),
    [talento],
  );

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

  useEffect(() => {
    if (!avisoContacto) return;
    const temporizador = window.setTimeout(() => setAvisoContacto(null), 12000);
    return () => window.clearTimeout(temporizador);
  }, [avisoContacto]);

  // El aviso pertenece a una persona concreta: al cambiar de ficha se descarta.
  useEffect(() => {
    setAvisoContacto(null);
  }, [seleccionadoId, genteTab]);

  const guardar = (persona: Persona) => {
    guardarContacto(
      {
        nombre: persona.nombre,
        cargo: persona.cargo,
        departamento: persona.departamento,
        telefono: persona.telefono,
      },
      `crew-${slug(persona.nombre)}-${proyecto}`,
    );
    setAvisoContacto(
      `Descargamos el contacto de ${persona.nombre} como archivo .vcf. ${instruccionImportar()}`,
    );
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
              onGuardarContacto={() => guardar(seleccionada)}
              avisoContacto={avisoContacto}
            />
          ) : (
            // El talento no expone teléfono: la ficha queda sin acciones de contacto.
            <FichaPersona persona={seleccionada} mensajeWa="" />
          )}
        </div>
      </>
    );
  }

  const conTelefono = crew.filter((persona) => persona.telefono).length;

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
            />
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
