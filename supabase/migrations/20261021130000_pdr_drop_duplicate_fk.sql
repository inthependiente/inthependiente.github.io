-- ============================================================================
-- LlamadoApp — Limpieza de la FK duplicada en pdr.llamado_id
-- ============================================================================
-- Situación:
--   pdr tiene DOS foreign keys hacia llamados(id):
--     * pdr_llamado_id_fkey
--     * pdr_llamado_id_fkey1
--   Ambas cubren la misma relación (llamado_id → llamados.id), lo que hace que
--   PostgREST no pueda resolver el embed "llamados(...)" de forma implícita:
--     PGRST201: more than one relationship was found for 'pdr' and 'llamados'
--
-- Riesgo a cubrir:
--   Las dos FK pueden tener distinto ON DELETE. Si una es CASCADE y la otra
--   NO ACTION, borrar la equivocada cambia el comportamiento al eliminar un
--   llamado (podría fallar por violación de FK en lugar de borrar su PDR).
--   Por eso este script NO borra "la que sobre" a ciegas: inspecciona
--   pg_constraint y conserva la más permisiva, en este orden de preferencia:
--     CASCADE ('c') > SET NULL ('n') > SET DEFAULT ('d') > RESTRICT/NO ACTION
--   En caso de empate conserva la de nombre canónico (pdr_llamado_id_fkey).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Diagnóstico: qué hay hoy (se muestra en la salida, no modifica nada)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  raise notice '--- FK actuales de pdr -> llamados ---';
  for r in
    select c.conname,
           c.confdeltype,
           pg_get_constraintdef(c.oid) as definicion
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pdr'
      and c.contype = 'f'
      and c.confrelid = 'public.llamados'::regclass
      and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (llamado_id)%'
    order by c.conname
  loop
    raise notice '% | delete=% | %', r.conname, r.confdeltype, r.definicion;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Eliminar los duplicados conservando el de comportamiento más permisivo
-- ---------------------------------------------------------------------------
do $$
declare
  v_keep   text;
  v_drop   text[];
  v_name   text;   -- variable escalar del bucle (FOREACH no admite arrays)
begin
  with fks as (
    select c.conname,
           c.confdeltype,
           case c.confdeltype
             when 'c' then 1   -- ON DELETE CASCADE
             when 'n' then 2   -- ON DELETE SET NULL
             when 'd' then 3   -- ON DELETE SET DEFAULT
             else 4            -- NO ACTION / RESTRICT
           end as rank,
           case when c.conname = 'pdr_llamado_id_fkey' then 0 else 1 end as name_rank
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pdr'
      and c.contype = 'f'
      and c.confrelid = 'public.llamados'::regclass
      and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (llamado_id)%'
  )
  select
    (select conname from fks order by rank, name_rank, conname limit 1),
    coalesce(
      (select array_agg(conname)
       from fks
       where conname <> (select conname from fks order by rank, name_rank, conname limit 1)),
      array[]::text[]
    )
  into v_keep, v_drop;

  if v_keep is null then
    raise notice 'No se encontró ninguna FK de pdr.llamado_id -> llamados. Nada que hacer.';
    return;
  end if;

  if cardinality(v_drop) = 0 then
    raise notice 'Sólo existe la FK %. No hay duplicados. Nada que hacer.', v_keep;
    return;
  end if;

  foreach v_name in array v_drop loop
    raise notice 'Eliminando FK duplicada % (se conserva %)', v_name, v_keep;
    execute format('alter table public.pdr drop constraint %I', v_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Recargar el esquema de PostgREST
-- ---------------------------------------------------------------------------
-- Sin esto, el embed "llamados(...)" puede seguir dando PGRST201 hasta que
-- postgrest renueve su caché.
notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- VERIFICACIÓN POSTERIOR (sólo lectura)
-- ============================================================================
-- 1) Debe quedar EXACTAMENTE una FK:
--
--    select c.conname, pg_get_constraintdef(c.oid) as definicion
--    from pg_constraint c
--    join pg_class t on t.oid = c.conrelid
--    join pg_namespace n on n.oid = t.relnamespace
--    where n.nspname = 'public' and t.relname = 'pdr'
--      and c.contype = 'f'
--      and c.confrelid = 'public.llamados'::regclass;
--
-- 2) Desde la API, el embed debe resolverse sin ambigüedad (esto antes daba
--    PGRST201). Con anon key / sesión activa, en el navegador o con curl:
--
--    GET /rest/v1/pdr?select=id,llamado_id,llamados(id)&limit=1
--
-- 3) Comprobar que el borrado de un llamado sigue teniendo el comportamiento
--    esperado: si la FK conservada es CASCADE, borrar un llamado elimina su
--    PDR; si es NO ACTION, el borrado fallará mientras existan filas de PDR.
-- ============================================================================


-- ============================================================================
-- REVERSIÓN (DOWN) — recrear la FK si hiciera falta
-- ============================================================================
-- begin;
--   alter table public.pdr
--     add constraint pdr_llamado_id_fkey1
--     foreign key (llamado_id) references public.llamados(id)
--     on delete cascade;   -- ajustar al comportamiento que corresponda
--   notify pgrst, 'reload schema';
-- commit;
-- ============================================================================
