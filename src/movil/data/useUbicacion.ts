import { useCallback, useEffect, useState } from 'react';
import type { Coordenada } from '../lib/geo';

export type EstadoUbicacion = 'inicial' | 'pidiendo' | 'lista' | 'denegada' | 'no_disponible' | 'error';

const OPCIONES: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 60000,
};

/**
 * Ubicación actual del dispositivo. Se resuelve sola si el permiso ya fue
 * concedido antes; si nunca se concedió, la app funciona sin ubicación y el
 * mapa muestra solo el punto elegido.
 */
export function useUbicacion() {
  const [coords, setCoords] = useState<Coordenada | null>(null);
  const [estado, setEstado] = useState<EstadoUbicacion>('inicial');

  const pedir = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setEstado('no_disponible');
      return;
    }

    setEstado('pidiendo');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setCoords({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        setEstado('lista');
      },
      (error) => {
        setEstado(error.code === error.PERMISSION_DENIED ? 'denegada' : 'error');
      },
      OPCIONES,
    );
  }, []);

  // Si el permiso ya fue concedido antes, la ubicación se resuelve sin diálogo.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelado = false;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((permiso) => {
        if (!cancelado && permiso.state === 'granted') pedir();
        if (!cancelado && permiso.state === 'denied') setEstado('denegada');
      })
      .catch(() => {
        /* Safari antiguo: se pide al tocar el botón */
      });

    return () => {
      cancelado = true;
    };
  }, [pedir]);

  return { coords, estado, pedir };
}
