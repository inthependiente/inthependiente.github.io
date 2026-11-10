const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_RE = /^[2-9A-HJKMNP-Z]{6}$/;

export interface LinkParams {
  /** Llamado indicado en la URL; NaN cuando el link trae solo el código corto. */
  llamadoId: number;
  /** Link antiguo o generado antes del código corto. */
  token: string | null;
  /** Link personal actual: /movil/?c=K7P2QX9 */
  codigo: string | null;
}

/**
 * Lee los parámetros del link:
 *   /movil/?c=K7P2QX9          → código corto (identifica persona y llamado)
 *   /movil/?id=12&t=<uuid>     → formato anterior, sigue soportado
 *   /movil/?id=12              → link general, confirmación por nombre
 */
export function readLinkParams(search = window.location.search): LinkParams {
  const params = new URLSearchParams(search);
  const rawId = params.get('id') ?? params.get('llamado_id') ?? '';
  const id = Number.parseInt(rawId, 10);
  const rawToken = (params.get('t') ?? params.get('token') ?? '').trim().toLowerCase();
  const rawCodigo = (params.get('c') ?? params.get('codigo') ?? '').trim().toUpperCase();

  return {
    llamadoId: Number.isFinite(id) && id > 0 ? id : Number.NaN,
    token: UUID_RE.test(rawToken) ? rawToken : null,
    codigo: CODIGO_RE.test(rawCodigo) ? rawCodigo : null,
  };
}

/** Link del llamado sin la credencial personal (seguro para compartir o guardar). */
export function publicLink(llamadoId: number): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (Number.isFinite(llamadoId)) url.searchParams.set('id', String(llamadoId));
  return url.toString();
}
