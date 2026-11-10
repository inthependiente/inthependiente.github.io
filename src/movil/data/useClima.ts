import { useEffect, useState } from 'react';
import type { Ciudad } from '../types';
import { cargarClima, type Clima } from '../lib/weather';

export function useClima(ciudad: Ciudad | null | undefined, fecha: string | null | undefined) {
  const [clima, setClima] = useState<Clima | null>(null);
  const [cargando, setCargando] = useState(Boolean(fecha));

  const lat = ciudad?.lat ?? null;
  const lng = ciudad?.long ?? null;

  useEffect(() => {
    if (!fecha) {
      setClima(null);
      setCargando(false);
      return;
    }

    let cancelado = false;
    setCargando(true);

    void cargarClima(lat, lng, fecha)
      .then((resultado) => {
        if (!cancelado) setClima(resultado);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [lat, lng, fecha]);

  return { clima, cargando };
}
