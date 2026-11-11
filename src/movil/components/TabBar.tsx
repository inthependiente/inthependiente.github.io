import { Clapperboard, GalleryHorizontal, MapPin, Megaphone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabKey } from '../lib/router';

interface Tab {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

export const TABS: Tab[] = [
  { key: 'llamado', label: 'Llamado', icon: Megaphone },
  { key: 'pdr', label: 'Rodaje', icon: Clapperboard },
  { key: 'locaciones', label: 'Locaciones', icon: MapPin },
  { key: 'gente', label: 'Gente', icon: Users },
  { key: 'storyboard', label: 'Storyboard', icon: GalleryHorizontal },
];

export default function TabBar({ active }: { active: TabKey }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Secciones del llamado"
    >
      <div className="mx-auto flex w-full max-w-130 items-stretch">
        {TABS.map(({ key, label, icon: Icon }) => {
          const activo = key === active;

          const clases = `relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors ${
            activo ? 'text-brand-content' : 'text-content-subtle'
          }`;

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
