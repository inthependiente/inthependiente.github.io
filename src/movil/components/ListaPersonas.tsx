import { useMemo, useState } from 'react';
import { ChevronRight, Phone, Search, Users } from 'lucide-react';
import { iniciales } from '../lib/format';
import { filtrarPersonas, type GrupoPersonas, type Persona } from '../lib/personas';

interface Props {
  grupos: GrupoPersonas[];
  /** Muestra el indicador de teléfono (solo crew). */
  conTelefono: boolean;
  tituloVacio: string;
  detalleVacio: string;
  onAbrir: (persona: Persona) => void;
  children?: React.ReactNode;
}

export default function ListaPersonas({
  grupos,
  conTelefono,
  tituloVacio,
  detalleVacio,
  onAbrir,
  children,
}: Props) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => filtrarPersonas(grupos, busqueda), [grupos, busqueda]);
  const total = useMemo(() => grupos.reduce((suma, grupo) => suma + grupo.personas.length, 0), [grupos]);
  const visibles = useMemo(
    () => filtrados.reduce((suma, grupo) => suma + grupo.personas.length, 0),
    [filtrados],
  );

  if (!total) {
    return (
      <div className="rounded-xl border border-hairline bg-surface px-5 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-content-subtle">
          <Users className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-[14px] font-semibold text-content">{tituloVacio}</h2>
        <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-content-muted">
          {detalleVacio}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3">
        <Search className="h-4 w-4 shrink-0 text-content-subtle" />
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por nombre o cargo"
          className="h-11 w-full bg-transparent text-base text-content outline-none placeholder:text-content-subtle"
          autoComplete="off"
        />
        {busqueda && (
          <span className="shrink-0 font-mono text-[11px] text-content-subtle">
            {visibles}/{total}
          </span>
        )}
      </label>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-[12px] text-content-muted">No encontramos ese nombre.</p>
      )}

      <div className="space-y-3">
        {filtrados.map((grupo) => (
          <section key={grupo.clave}>
            <h2 className="mb-1.5 flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-muted">
                {grupo.titulo}
              </span>
              <span className="font-mono text-[10px] text-content-subtle">{grupo.personas.length}</span>
            </h2>

            <ul className="overflow-hidden rounded-xl border border-hairline bg-surface">
              {grupo.personas.map((persona, indice) => (
                <li key={persona.id} className={indice > 0 ? 'border-t border-hairline' : undefined}>
                  <button
                    type="button"
                    onClick={() => onAbrir(persona)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-subtle"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-content-muted">
                      {iniciales(persona.nombre)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight text-content">
                        {persona.nombre}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-tight text-content-muted">
                        {persona.cargo ?? 'Sin cargo'}
                        {conTelefono && persona.telefono && (
                          <Phone className="h-2.5 w-2.5 shrink-0 text-success" aria-label="Con teléfono" />
                        )}
                      </span>
                    </span>

                    <span className="shrink-0 font-mono text-[13px] font-semibold text-content">
                      {persona.hora ?? '—'}
                    </span>

                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-content-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {children}
    </div>
  );
}
