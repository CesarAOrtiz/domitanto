/**
 * Estado de acceso a Plus. Solo un derecho validado por la tienda concede `plus`;
 * nunca un ajuste local, un archivo importado o una compra pendiente.
 */
export type Access = 'unknown' | 'free' | 'plus' | 'revoked';

/** Lo que dijo la tienda en la última consulta que respondió. */
export type StoreVerdict = 'active' | 'inactive' | 'refunded';

export interface CachedAccess {
  access: 'plus' | 'free' | 'revoked';
  checkedAt: number;
}

export function verdictToAccess(verdict: StoreVerdict): CachedAccess['access'] {
  return verdict === 'active' ? 'plus' : verdict === 'refunded' ? 'revoked' : 'free';
}

/**
 * Acceso al arrancar o al reconciliar. Si la tienda respondió, manda la tienda. Si no
 * (sin red, sin tienda), un Plus validado antes se conserva sin conexión; sin nada
 * guardado el acceso es desconocido y no se cargan anuncios.
 */
export function resolveAccess(cached: CachedAccess | null, remote: StoreVerdict | null): Access {
  if (remote) return verdictToAccess(remote);
  return cached?.access ?? 'unknown';
}

/** Los anuncios solo se piden con acceso gratuito confirmado. */
export function adsAllowed(access: Access): boolean {
  return access === 'free' || access === 'revoked';
}
