import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordenada, Ruta } from '../lib/geo';
import { tieneCoordenadas, type Punto } from '../lib/lugares';

interface Props {
  puntos: Punto[];
  seleccionado: Punto | null;
  ruta: Ruta | null;
  ubicacion: Coordenada | null;
  /** Dónde está el origen de la ruta cuando no hay GPS. */
  origenRuta: Coordenada | null;
  /** Espacio reservado abajo para que el detalle del punto no tape la ruta. */
  paddingInferior?: number;
  onSeleccionar: (punto: Punto) => void;
}

const COLOR_PRODUCTORA = '#7c3aed';

function iconoPunto(punto: Punto, activo: boolean): L.DivIcon {
  const esProductora = punto.tipo === 'productora';
  const fondo = esProductora ? COLOR_PRODUCTORA : 'var(--brand)';
  const tinta = esProductora ? '#ffffff' : 'var(--on-brand)';
  const tamano = activo ? 34 : 27;
  const texto = esProductora ? 'P' : String(punto.numero);

  return L.divIcon({
    className: 'llamado-pin',
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:${tamano}px;height:${tamano}px;border-radius:999px;
      background:${fondo};color:${tinta};
      font:700 ${activo ? 14 : 12}px/1 ui-monospace,SFMono-Regular,monospace;
      border:2px solid #ffffff;
      box-shadow:0 1px 4px rgba(0,0,0,${activo ? 0.4 : 0.28});
      transition:width 120ms,height 120ms;
    ">${texto}</span>`,
  });
}

export default function MapaLocaciones({
  puntos,
  seleccionado,
  ruta,
  ubicacion,
  origenRuta,
  paddingInferior = 56,
  onSeleccionar,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaPuntos = useRef<L.LayerGroup | null>(null);
  const capaRuta = useRef<L.LayerGroup | null>(null);
  const marcadorYo = useRef<L.CircleMarker | null>(null);
  const seleccionRef = useRef(onSeleccionar);
  const encuadreInicial = useRef(false);

  seleccionRef.current = onSeleccionar;

  // Inicialización única del mapa.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const instancia = L.map(contenedor.current, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(instancia);

    L.control.zoom({ position: 'topright' }).addTo(instancia);

    capaPuntos.current = L.layerGroup().addTo(instancia);
    capaRuta.current = L.layerGroup().addTo(instancia);

    instancia.setView([-17.78, -63.18], 12);
    mapa.current = instancia;

    // El contenedor cambia de alto al ocultar la lista: hay que recalcular.
    const observador = new ResizeObserver(() => instancia.invalidateSize());
    observador.observe(contenedor.current);

    return () => {
      observador.disconnect();
      instancia.remove();
      mapa.current = null;
      capaPuntos.current = null;
      capaRuta.current = null;
      marcadorYo.current = null;
      encuadreInicial.current = false;
    };
  }, []);

  // Marcadores de los puntos del día.
  useEffect(() => {
    const grupo = capaPuntos.current;
    const instancia = mapa.current;
    if (!grupo || !instancia) return;

    grupo.clearLayers();

    const conCoords = puntos.filter(tieneCoordenadas);

    for (const punto of conCoords) {
      const marcador = L.marker([punto.lat, punto.lng], {
        icon: iconoPunto(punto, seleccionado?.key === punto.key),
        keyboard: true,
        title: punto.titulo,
        alt: `${punto.numero === 0 ? 'Productora' : `Locación ${punto.numero}`}: ${punto.titulo}`,
        zIndexOffset: seleccionado?.key === punto.key ? 500 : punto.numero === 0 ? 300 : 0,
      });

      marcador.on('click', () => seleccionRef.current(punto));
      grupo.addLayer(marcador);
    }

    // Encuadre inicial: todos los puntos, una sola vez.
    if (!encuadreInicial.current && conCoords.length) {
      const limites = L.latLngBounds(conCoords.map((p) => [p.lat, p.lng] as [number, number]));
      if (limites.isValid()) {
        instancia.fitBounds(limites, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 64], maxZoom: 15 });
        encuadreInicial.current = true;
      }
    }
  }, [puntos, seleccionado]);

  // Ruta y ubicación actual.
  useEffect(() => {
    const capa = capaRuta.current;
    const instancia = mapa.current;
    if (!capa || !instancia) return;

    capa.clearLayers();

    if (ubicacion) {
      if (!marcadorYo.current) {
        marcadorYo.current = L.circleMarker([ubicacion.lat, ubicacion.lng], {
          radius: 7,
          color: '#ffffff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(instancia);
      } else {
        marcadorYo.current.setLatLng([ubicacion.lat, ubicacion.lng]);
      }
    } else if (marcadorYo.current) {
      marcadorYo.current.remove();
      marcadorYo.current = null;
    }

    if (ruta && ruta.trazado.length > 1) {
      L.polyline(
        ruta.trazado.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: '#2563eb',
          weight: 5,
          opacity: 0.85,
          dashArray: ruta.aproximada ? '6 8' : undefined,
          lineJoin: 'round',
          lineCap: 'round',
        },
      ).addTo(capa);
    }

    if (seleccionado && tieneCoordenadas(seleccionado)) {
      const destino: [number, number] = [seleccionado.lat, seleccionado.lng];
      const origen = origenRuta;
      const limites = origen
        ? L.latLngBounds([origen.lat, origen.lng] as [number, number], destino)
        : L.latLngBounds([destino]);

      instancia.flyToBounds(limites, {
        paddingTopLeft: [44, 40],
        paddingBottomRight: [44, paddingInferior],
        maxZoom: 15,
        duration: 0.7,
      });
    }
  }, [ruta, ubicacion, seleccionado, origenRuta, paddingInferior]);

  return <div ref={contenedor} className="h-full w-full" role="application" aria-label="Mapa de locaciones del día" />;
}
