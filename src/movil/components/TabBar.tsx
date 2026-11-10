import { Clapperboard, GalleryHorizontal, MapPin, Megaphone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabKey } from '../lib/router';

interface Tab {
  key: TabKey | 'storyboard';
  label: string;
  icon: LucideIcon;
  /** Se muestra atenuada y no navega. */
  bloqueada?: boolean;
}

export const TABS: Tab[] = [
  { key: 'llamado', label: 'Llamado', icon: Megaphone },
  { key: 'pdr', label: 'Rodaje', icon: Clapperboard },
  { key: 'locaciones', label: 'Locaciones', icon: MapPin },
  { key: 'gente', label: 'Gente', icon: Users },
  { key: 'storyboard', label: 'Storyboard', icon: GalleryHorizontal, bloqueada: true },
];

export default function TabBar({ active }: { active: TabKey }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Secciones del llamado"
    >
      <div className="mx-auto flex w-full max-w-130 items-stretch">
        {TABS.map(({ key, label, icon: Icon, bloqueada }) => {
          const activo = key === active;

          const clases = `relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors ${
            activo ? 'text-brand-content' : bloqueada ? 'text-content-subtle/45' : 'text-content-subtle'
          }`;

          if (bloqueada) {
            return (
              <span
                key={key}
                aria-disabled="true"
                aria-label={`${label} (próximamente)`}
                title="Próximamente"
                className={`${clases} cursor-default`}
                style={{ height: 'var(--tabbar-h)' }}
              >
                <Icon className="h-5 w-5 opacity-60" strokeWidth={1.6} />
                <span>{label}</span>
              </span>
            );
          }

          return (
            <a
              key={key}
              href={`#/${key}`}
              aria-current={activo ? 'page' : undefined}
              onClick={() => window.scrollTo({ top: 0 })}
              className={clases}
              style={{ height: 'var(--tabbar-h)' }}
            >
              {activo && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-brand" />}
              <Icon className="h-5 w-5" strokeWidth={activo ? 2.2 : 1.8} />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
