import { AlertTriangle, Clapperboard, Radio, Timer, TrendingUp } from 'lucide-react';
import {
  bannerCopy,
  elapsedMinutes,
  formatClock,
  statusTone,
  warningText,
  type Plan,
  type StatusTone,
} from '../lib/timing';

interface Props {
  plan: Plan;
  /** Instante actual, para el contador de la toma activa. */
  now: number;
  /** Inicio estimado del siguiente plano; null si no hay. */
  proximoInicio: number | null;
}

const TONOS: Record<StatusTone, { caja: string; texto: string; icono: string; chip: string }> = {
  neutral: {
    caja: 'border-hairline bg-subtle',
    texto: 'text-content-secondary',
    icono: 'text-content-subtle',
    chip: 'border-hairline bg-surface text-content-muted',
  },
  info: {
    caja: 'border-info-border bg-info-subtle',
    texto: 'text-info-content',
    icono: 'text-info-content',
    chip: 'border-info-border bg-surface/60 text-info-content',
  },
  success: {
    caja: 'border-success-border bg-success-subtle',
    texto: 'text-success-content',
    icono: 'text-success-content',
    chip: 'border-success-border bg-surface/60 text-success-content',
  },
  danger: {
    caja: 'border-danger-border bg-danger-subtle',
    texto: 'text-danger-content',
    icono: 'text-danger-content',
    chip: 'border-danger-border bg-surface/60 text-danger-content',
  },
};

const ICONO_TONO: Record<StatusTone, React.ElementType> = {
  neutral: Radio,
  info: Timer,
  success: TrendingUp,
  danger: AlertTriangle,
};

/** Banner de estado del modo "ver en vivo" del plan de rodaje. */
export default function LiveStatusBanner({ plan, now, proximoInicio }: Props) {
  const tono = statusTone(plan.status);
  const estilo = TONOS[tono];
  const Icono = ICONO_TONO[tono];
  const { eyebrow, headline } = bannerCopy(plan.status);

  const transcurridos = elapsedMinutes(plan, now);
  const etiquetaTranscurrido =
    transcurridos === null
      ? null
      : transcurridos === 1
        ? 'EN CURSO HACE 1 MINUTO'
        : `EN CURSO HACE ${transcurridos} MINUTOS`;

  return (
    <>
      <section className={`rounded-xl border-2 px-3 py-3 ${estilo.caja}`} role="status" aria-live="polite">
        <div className="flex items-start gap-2.5">
          <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${estilo.icono}`} strokeWidth={2} aria-hidden />

          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-semibold uppercase leading-snug tracking-[0.13em] ${estilo.texto}`}>
              {eyebrow}
            </p>
            <p className={`mt-1 font-mono text-[17px] font-black uppercase leading-tight ${estilo.texto}`}>
              {headline}
            </p>

            {(etiquetaTranscurrido || proximoInicio !== null) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {etiquetaTranscurrido && (
                  <Chip clase={estilo.chip} Icono={Timer}>
                    {etiquetaTranscurrido}
                  </Chip>
                )}
                {proximoInicio !== null && (
                  <Chip clase={estilo.chip} Icono={Clapperboard}>
                    PRÓXIMO PLANO A LAS: {formatClock(proximoInicio, plan.timeZone)}
                  </Chip>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {plan.warnings.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-content" aria-hidden />
          <ul className="space-y-0.5 text-[11px] leading-snug text-warning-content">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warningText(warning)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Chip({
  clase,
  Icono,
  children,
}: {
  clase: string;
  Icono: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${clase}`}
    >
      <Icono className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}
