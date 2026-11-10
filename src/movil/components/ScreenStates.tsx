import { AlertTriangle, Link2, RefreshCw, SearchX, ShieldX } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="space-y-3 px-4 pt-4" aria-busy="true" aria-label="Cargando llamado">
      {[72, 132, 96, 88].map((alto, indice) => (
        <div
          key={indice}
          className="animate-pulse rounded-xl border border-hairline bg-surface"
          style={{ height: alto }}
        />
      ))}
    </div>
  );
}

export function ErrorScreen({ mensaje, onRetry }: { mensaje?: string | null; onRetry?: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle text-warning-content">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[15px] font-semibold text-content">No pudimos cargar el llamado</h1>
      <p className="mx-auto mt-1 max-w-75 text-[12px] leading-relaxed text-content-muted">
        {mensaje ?? 'Revisa tu conexión e inténtalo de nuevo.'}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-lg mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}

export function InvalidLinkScreen() {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle text-warning-content">
        <ShieldX className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[15px] font-semibold text-content">Enlace no válido</h1>
      <p className="mx-auto mt-1 max-w-75 text-[12px] leading-relaxed text-content-muted">
        Este enlace personal no existe o fue reemplazado. Pide a producción que te envíe el link
        actualizado.
      </p>
    </div>
  );
}

export function MissingLinkScreen() {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand-content">
        <Link2 className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[15px] font-semibold text-content">Enlace incompleto</h1>
      <p className="mx-auto mt-1 max-w-75 text-[12px] leading-relaxed text-content-muted">
        Este enlace debe incluir el identificador del llamado. Pide a producción tu link personal y ábrelo
        nuevamente.
      </p>
      <p className="mt-4 rounded-lg border border-hairline bg-surface px-3 py-2 font-mono text-[11px] text-content-subtle">
        …/movil/?c=K7P2QX9
      </p>
    </div>
  );
}

export function NotFoundScreen() {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-content-subtle">
        <SearchX className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[15px] font-semibold text-content">Llamado no encontrado</h1>
      <p className="mx-auto mt-1 max-w-75 text-[12px] leading-relaxed text-content-muted">
        El llamado que buscas no existe o ya no está disponible.
      </p>
    </div>
  );
}
