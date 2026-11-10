import { useEffect, useState } from 'react';

/**
 * Instante actual con recálculo periódico.
 *
 * Con `intervalMs` en null no hay temporizador (modo normal del plan de
 * rodaje). Al volver del segundo plano se recalcula de inmediato.
 */
export function useNow(intervalMs: number | null = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = intervalMs && intervalMs > 0 ? window.setInterval(tick, intervalMs) : null;
    tick();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', tick);

    return () => {
      if (id !== null) window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return now;
}
