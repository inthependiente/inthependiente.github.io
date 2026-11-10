-- ═══════════════════════════════════════════════════════════════════════════
--  LlamadoAPP · App móvil · Locaciones georreferenciadas
--
--  Guarda las coordenadas que la Edge Function `resolver-mapa` obtiene de los
--  links de Google Maps (`url_loc`, `map_productora`) y que producción puede
--  corregir a mano desde el panel.
--
--  Aplicar con:  supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  Locaciones
-- ─────────────────────────────────────────────────────────────
alter table public.locaciones add column if not exists lat double precision;
alter table public.locaciones add column if not exists lng double precision;
alter table public.locaciones add column if not exists coord_fuente text;
alter table public.locaciones add column if not exists coord_actualizado_en timestamptz;

comment on column public.locaciones.lat is 'Latitud resuelta desde url_loc o corregida a mano en el panel.';
comment on column public.locaciones.lng is 'Longitud resuelta desde url_loc o corregida a mano en el panel.';
comment on column public.locaciones.coord_fuente is
  'Origen de las coordenadas: link (resuelto por resolver-mapa), geocoder, manual.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locaciones_lat_rango') then
    alter table public.locaciones
      add constraint locaciones_lat_rango check (lat is null or (lat >= -90 and lat <= 90)),
      add constraint locaciones_lng_rango check (lng is null or (lng >= -180 and lng <= 180));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
--  Productora (dirección de producción del proyecto)
-- ─────────────────────────────────────────────────────────────
alter table public.proyectos add column if not exists lat double precision;
alter table public.proyectos add column if not exists lng double precision;
alter table public.proyectos add column if not exists coord_fuente text;
alter table public.proyectos add column if not exists coord_actualizado_en timestamptz;

comment on column public.proyectos.lat is 'Latitud de la dirección de la productora (map_productora).';
comment on column public.proyectos.lng is 'Longitud de la dirección de la productora (map_productora).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proyectos_lat_rango') then
    alter table public.proyectos
      add constraint proyectos_lat_rango check (lat is null or (lat >= -90 and lat <= 90)),
      add constraint proyectos_lng_rango check (lng is null or (lng >= -180 and lng <= 180));
  end if;
end $$;

-- Índice para encontrar rápido lo que falta georreferenciar.
create index if not exists locaciones_sin_coords_idx
  on public.locaciones (id) where lat is null or lng is null;

notify pgrst, 'reload schema';
