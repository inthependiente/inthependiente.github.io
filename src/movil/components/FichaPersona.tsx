import { Contact, MessageCircle, Phone } from 'lucide-react';
import { iniciales } from '../lib/format';
import { telHref, whatsappHref } from '../lib/contacto';
import type { Persona } from '../lib/personas';

interface Props {
  persona: Persona;
  /** Contexto del llamado, para el mensaje de WhatsApp. */
  mensajeWa: string;
  /** Solo el crew puede guardar el contacto; sin esta prop no se muestra el botón. */
  onGuardarContacto?: () => void;
  /** Instrucción a mostrar tras descargar la vCard. */
  avisoContacto?: string | null;
}

export default function FichaPersona({ persona, mensajeWa, onGuardarContacto, avisoContacto }: Props) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-hairline bg-surface px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[15px] font-semibold text-brand-content">
            {iniciales(persona.nombre)}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-semibold leading-tight text-content">{persona.nombre}</h1>
            {persona.cargo && (
              <p className="mt-0.5 text-[12px] leading-snug text-content-muted">{persona.cargo}</p>
            )}
            {persona.departamento && (
              <p className="text-[11px] leading-snug text-content-subtle">{persona.departamento}</p>
            )}
          </div>
        </div>

        <div className="mt-3 border-t border-hairline pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
            Hora de llamado
          </p>
          <p className="font-mono text-[24px] font-semibold leading-none text-content">
            {persona.hora ?? '—'}
          </p>
        </div>
      </section>

      {persona.telefono ? (
        <section className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Teléfono</p>
          <p className="mt-0.5 font-mono text-[15px] font-semibold text-content">{persona.telefono.display}</p>
          <p className="text-[10px] text-content-subtle">{persona.telefono.e164}</p>
        </section>
      ) : (
        persona.telefonoTexto && (
          <section className="rounded-xl border border-warning-border bg-warning-subtle px-4 py-2.5">
            <p className="text-[11px] leading-relaxed text-warning-content">
              El teléfono registrado («{persona.telefonoTexto}») no tiene un formato válido.
            </p>
          </section>
        )
      )}

      {persona.extra.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
          <ul className="divide-y divide-hairline">
            {persona.extra.map((campo) => (
              <li key={campo.etiqueta} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="shrink-0 text-[11px] text-content-muted">{campo.etiqueta}</span>
                <span className="min-w-0 truncate text-right text-[12px] font-medium text-content">
                  {campo.valor}
                </span>
              </li>
            ))}
            {persona.estado && (
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="shrink-0 text-[11px] text-content-muted">Estado</span>
                <span className="rounded border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-content-secondary">
                  {persona.estado}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      {persona.notas && (
        <section className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Notas</p>
          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-content-secondary">
            {persona.notas}
          </p>
        </section>
      )}

      {persona.telefono && (
        <section className="space-y-2 pt-0.5">
          <div className="flex gap-2">
            <a className="btn btn-primary btn-lg h-11 flex-1" href={telHref(persona.telefono)}>
              <Phone className="h-4 w-4" />
              Llamar
            </a>
            <a
              className="btn btn-secondary btn-lg h-11 flex-1"
              href={whatsappHref(persona.telefono, mensajeWa)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>

          {onGuardarContacto && (
            <button
              type="button"
              className="btn btn-secondary btn-lg h-11 btn-block"
              onClick={onGuardarContacto}
            >
              <Contact className="h-4 w-4" />
              Guardar contacto
            </button>
          )}

          {avisoContacto && (
            <p
              role="status"
              className="rounded-lg border border-hairline bg-subtle px-3 py-2 text-[11px] leading-relaxed text-content-muted"
            >
              {avisoContacto}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
