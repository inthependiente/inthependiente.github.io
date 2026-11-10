// Supabase Edge Function · resolver-mapa
//
// Convierte los links de Google Maps guardados en `locaciones.url_loc` y
// `proyectos.map_productora` en coordenadas, y las cachea en la base.
//
// Se llama desde la app móvil solo para los puntos que aún no tienen lat/lng:
//   POST { "locacion_ids": [1, 2], "proyecto_id": 1 }
//
// El navegador no puede resolver `maps.app.goo.gl` por CORS, por eso esta
// función hace el trabajo del lado servidor. Los links cortos responden con un
// 302 cuyo header Location ya trae las coordenadas (`!3d…!4d…`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Google responde 302 con un UA simple; con UA de navegador entrega una página JS sin datos. */
const USER_AGENTS = ["Mozilla/5.0", "curl/8.5.0"];

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const CONTACTO = "llamadoapp/1.0 (geocoding for film call sheets)";

interface Coordenadas {
  lat: number;
  lng: number;
  fuente: "link" | "geocoder";
}

interface Punto {
  url: string | null;
  direccion: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const redondear = (n: number) => Math.round(n * 1e7) / 1e7;

const valido = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

/** Busca coordenadas dentro de una URL de Google Maps. */
function coordsDesdeUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let texto = url;

  try {
    texto = decodeURIComponent(url);
  } catch {
    // Algunos links traen % sin escapar; seguimos con el valor original.
  }

  const patrones = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:query|q|ll|center|destination|daddr|sll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /place\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
  ];

  for (const patron of patrones) {
    const match = patron.exec(texto);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (valido(lat, lng)) return { lat, lng };
  }

  return null;
}

/** Busca coordenadas en el HTML de una página intermedia de Google. */
function coordsDesdeHtml(html: string): { lat: number; lng: number } | null {
  if (!html) return null;

  const candidatos = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /\[(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})\]/,
    /"(?:latitude|lat)"\s*:\s*(-?\d{1,3}\.\d+)[^}]*?"(?:longitude|lng|lon)"\s*:\s*(-?\d{1,3}\.\d+)/,
  ];

  for (const patron of candidatos) {
    const match = patron.exec(html);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (valido(lat, lng)) return { lat, lng };
  }

  return null;
}

async function seguirRedirecciones(url: string): Promise<Coordenadas | null> {
  for (const ua of USER_AGENTS) {
    let actual = url;

    for (let salto = 0; salto < 4; salto += 1) {
      const directo = coordsDesdeUrl(actual);
      if (directo) return { ...directo, fuente: "link" };

      let respuesta: Response;
      try {
        respuesta = await fetch(actual, {
          redirect: "manual",
          headers: { "user-agent": ua, "accept-language": "es-419,es;q=0.9,en;q=0.8" },
          signal: AbortSignal.timeout(9000),
        });
      } catch {
        break;
      }

      const location = respuesta.headers.get("location");
      if (location) {
        const destino = new URL(location, actual).toString();
        const enDestino = coordsDesdeUrl(destino);
        if (enDestino) return { ...enDestino, fuente: "link" };
        actual = destino;
        continue;
      }

      if (respuesta.status === 200) {
        const html = await respuesta.text().catch(() => "");
        const enHtml = coordsDesdeHtml(html);
        if (enHtml) return { ...enHtml, fuente: "link" };
      }

      break;
    }
  }

  return null;
}

/** Último recurso: geocodificar la dirección escrita a mano en el panel. */
async function geocodificar(direccion: string): Promise<Coordenadas | null> {
  const consultas = [direccion, `${direccion}, Santa Cruz de la Sierra, Bolivia`];

  for (const consulta of consultas) {
    const params = new URLSearchParams({ q: consulta, format: "jsonv2", limit: "1", addressdetails: "0" });
    try {
      const respuesta = await fetch(`${NOMINATIM}?${params}`, {
        headers: { "user-agent": CONTACTO, "accept-language": "es" },
        signal: AbortSignal.timeout(9000),
      });
      if (!respuesta.ok) continue;

      const resultados = (await respuesta.json()) as Array<{ lat: string; lon: string }>;
      const primero = resultados?.[0];
      if (!primero) continue;

      const lat = Number(primero.lat);
      const lng = Number(primero.lon);
      if (valido(lat, lng)) return { lat, lng, fuente: "geocoder" };
    } catch {
      // Sin red o sin resultados: seguimos con la siguiente consulta.
    }
  }

  return null;
}

async function resolverPunto(punto: Punto): Promise<Coordenadas | null> {
  if (punto.url) {
    const porLink = await seguirRedirecciones(punto.url);
    if (porLink) return porLink;
  }

  if (punto.direccion) return geocodificar(punto.direccion);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "metodo_no_permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "configuracion_incompleta" }, 500);

  let body: { locacion_ids?: unknown; proyecto_id?: unknown; forzar?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "body_invalido" }, 400);
  }

  const ids = Array.isArray(body.locacion_ids)
    ? body.locacion_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 40)
    : [];
  const proyectoNumero = Number(body.proyecto_id);
  const proyectoId = Number.isInteger(proyectoNumero) && proyectoNumero > 0 ? proyectoNumero : null;
  const forzar = body.forzar === true;

  if (!ids.length && !proyectoId) return json({ ok: true, resultados: [] });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const resultados: Array<{
    tipo: "locacion" | "proyecto";
    id: number;
    lat: number | null;
    lng: number | null;
    fuente: string | null;
    error?: string;
  }> = [];

  if (ids.length) {
    const { data, error } = await supabase
      .from("locaciones")
      .select("id, locacion, direccion_loc, url_loc, lat, lng")
      .in("id", ids);
    if (error) return json({ ok: false, error: error.message }, 500);

    for (const fila of data ?? []) {
      if (!forzar && fila.lat !== null && fila.lng !== null) {
        resultados.push({ tipo: "locacion", id: fila.id, lat: fila.lat, lng: fila.lng, fuente: "cache" });
        continue;
      }

      const coordenadas = await resolverPunto({
        url: fila.url_loc,
        direccion: [fila.locacion, fila.direccion_loc].filter(Boolean).join(", ") || null,
      });

      if (!coordenadas) {
        resultados.push({
          tipo: "locacion",
          id: fila.id,
          lat: fila.lat ?? null,
          lng: fila.lng ?? null,
          fuente: null,
          error: "sin_coordenadas",
        });
        continue;
      }

      const lat = redondear(coordenadas.lat);
      const lng = redondear(coordenadas.lng);
      const { error: errorUpdate } = await supabase
        .from("locaciones")
        .update({ lat, lng, coord_fuente: coordenadas.fuente, coord_actualizado_en: new Date().toISOString() })
        .eq("id", fila.id);

      resultados.push({
        tipo: "locacion",
        id: fila.id,
        lat,
        lng,
        fuente: coordenadas.fuente,
        ...(errorUpdate ? { error: errorUpdate.message } : {}),
      });
    }
  }

  if (proyectoId) {
    const { data, error } = await supabase
      .from("proyectos")
      .select("id, productora, direccion_productora, map_productora, lat, lng")
      .eq("id", proyectoId)
      .maybeSingle();

    if (error) {
      resultados.push({ tipo: "proyecto", id: proyectoId, lat: null, lng: null, fuente: null, error: error.message });
    } else if (data) {
      if (!forzar && data.lat !== null && data.lng !== null) {
        resultados.push({ tipo: "proyecto", id: data.id, lat: data.lat, lng: data.lng, fuente: "cache" });
      } else {
        const coordenadas = await resolverPunto({
          url: data.map_productora,
          direccion: data.direccion_productora,
        });

        if (!coordenadas) {
          resultados.push({
            tipo: "proyecto",
            id: data.id,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            fuente: null,
            error: "sin_coordenadas",
          });
        } else {
          const lat = redondear(coordenadas.lat);
          const lng = redondear(coordenadas.lng);
          const { error: errorUpdate } = await supabase
            .from("proyectos")
            .update({ lat, lng, coord_fuente: coordenadas.fuente, coord_actualizado_en: new Date().toISOString() })
            .eq("id", data.id);

          resultados.push({
            tipo: "proyecto",
            id: data.id,
            lat,
            lng,
            fuente: coordenadas.fuente,
            ...(errorUpdate ? { error: errorUpdate.message } : {}),
          });
        }
      }
    }
  }

  return json({ ok: true, resultados });
});
