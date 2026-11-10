import { useEffect, useState } from 'react';

export const TAB_KEYS = ['llamado', 'pdr', 'locaciones', 'gente'] as const;
export type TabKey = (typeof TAB_KEYS)[number];

/** Pestañas internas de la sección Gente. */
export type GenteTab = 'crew' | 'talento';

export interface Route {
  tab: TabKey;
  /** Id de la persona seleccionada en Gente. */
  id?: number;
  genteTab: GenteTab;
}

const idDe = (valor?: string): number | undefined => {
  const id = Number.parseInt(valor ?? '', 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

/**
 * Rutas:
 *   #/llamado | #/pdr | #/locaciones
 *   #/gente                 → pestaña Crew
 *   #/gente/talento         → pestaña Talento
 *   #/gente/crew/12         → ficha de crew
 *   #/gente/talento/7       → ficha de talento
 *   #/crew/12 y #/talento/7 → formato anterior, sigue funcionando
 */
export function parseHash(hash: string): Route {
  const [segmento = '', ...resto] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (segmento === 'crew' || segmento === 'talento') {
    return { tab: 'gente', genteTab: segmento, id: idDe(resto[0]) };
  }

  const tab = (TAB_KEYS as readonly string[]).includes(segmento) ? (segmento as TabKey) : 'llamado';
  if (tab !== 'gente') return { tab, genteTab: 'crew' };

  const [sub, idCrudo] = resto;
  const genteTab: GenteTab = sub === 'talento' ? 'talento' : 'crew';

  return {
    tab: 'gente',
    genteTab,
    id: sub === 'crew' || sub === 'talento' ? idDe(idCrudo) : idDe(sub),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
