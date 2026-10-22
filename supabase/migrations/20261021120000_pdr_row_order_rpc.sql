-- ============================================================================
-- LlamadoApp — Reordenamiento atómico de filas del PDR
-- ============================================================================
-- Problema que resuelve:
--   El frontend reordenaba el PDR lanzando N UPDATE en paralelo (drag & drop),
--   un bucle secuencial de UPDATE + INSERT (alta rápida) y otro bucle para
--   duplicar planos ES. Sin transacción: un fallo intermedio dejaba órdenes
--   duplicados o huecos, y dos usuarios reordenando a la vez podían corromper
--   la secuencia.
--
-- Solución: dos funciones RPC que trabajan dentro de una transacción implícita,
-- con un lock de admisión por llamado_id.
--
--   pdr_reorder_rows(p_llamado_id, p_ordered_ids)
--     → renombra el orden 1..N según la lista de ids que envía el cliente.
--
--   pdr_insert_row(p_llamado_id, p_shotlist_id, p_position, p_source_row_id)
--     → inserta una fila en una posición (recortada al rango válido) o duplica
--       una fila existente del mismo llamado.
--
-- Notas de esquema verificadas antes de escribir esto:
--   * pdr.id            bigint  (PK)
--   * pdr.llamado_id    bigint  (FK → llamados.id)
--   * pdr.shotlist_id   bigint  (FK → shotlist.id)
--   * pdr.orden         int4    (acepta NULL, default NULL)
--   * No existe índice único en (llamado_id, orden) → no hace falta la
--     estrategia de dos fases al reordenar.
--   * RLS: política ALL para PUBLIC con USING(true) / WITH CHECK(true).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Eliminación defensiva (permite re-ejecutar el script sin errores de firma)
-- ---------------------------------------------------------------------------
drop function if exists public.pdr_reorder_rows(bigint, bigint[]);
drop function if exists public.pdr_insert_row(bigint, bigint, integer, bigint);

-- ---------------------------------------------------------------------------
-- 1. Reordenar todas las filas de un llamado según la lista de ids recibida
-- ---------------------------------------------------------------------------
-- p_ordered_ids debe contener EXACTAMENTE los ids del llamado, sin duplicados.
-- El servidor decide los números: el cliente solo expresa el orden deseado.
create or replace function public.pdr_reorder_rows(
  p_llamado_id bigint,
  p_ordered_ids bigint[]
)
returns setof public.pdr
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total    integer;
  v_received integer;
  v_distinct integer;
begin
  -- Lock de admisión: serializa las operaciones de orden del MISMO llamado
  -- sin bloquear otros llamados. Se libera al terminar la transacción.
  perform pg_advisory_xact_lock(hashtext('pdr_order'), p_llamado_id::integer);

  if p_ordered_ids is null or cardinality(p_ordered_ids) = 0 then
    raise exception 'La lista de filas a reordenar está vacía.'
      using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.pdr
  where llamado_id = p_llamado_id;

  if v_total = 0 then
    raise exception 'El llamado % no tiene filas de PDR.', p_llamado_id
      using errcode = 'P0002';
  end if;

  select count(*), count(distinct elem)
    into v_received, v_distinct
  from unnest(p_ordered_ids) as elem;

  if v_received <> v_distinct then
    raise exception 'La lista contiene ids duplicados.'
      using errcode = '22023';
  end if;

  -- Ningún id puede ser ajeno al llamado (y ningún NULL puede colarse).
  if exists (
    select 1
    from unnest(p_ordered_ids) as elem
    left join public.pdr r
      on r.id = elem and r.llamado_id = p_llamado_id
    where r.id is null
  ) then
    raise exception 'La lista contiene ids que no pertenecen al llamado %.', p_llamado_id
      using errcode = '22023';
  end if;

  if v_received <> v_total then
    raise exception 'La lista debe incluir todas las filas del llamado (recibidas %, esperadas %).',
      v_received, v_total
      using errcode = '22023';
  end if;

  -- Bloquear las filas en un orden consistente: evita deadlocks entre sesiones.
  perform r.id
  from public.pdr r
  where r.llamado_id = p_llamado_id
  order by r.orden nulls last, r.id
  for update;

  -- Una sola sentencia: la posición sale del índice en el array (1-based).
  update public.pdr t
     set orden = u.pos::integer
    from (
      select elem, ordinality as pos
      from unnest(p_ordered_ids) with ordinality as x(elem, ordinality)
    ) u
   where t.id = u.elem
     and t.llamado_id = p_llamado_id
     and t.orden is distinct from u.pos::integer;

  return query
    select *
    from public.pdr
    where llamado_id = p_llamado_id
    order by orden nulls last, id;
end;
$$;

comment on function public.pdr_reorder_rows(bigint, bigint[]) is
  'Reordena atómicamente las filas de PDR de un llamado. p_ordered_ids debe contener exactamente los ids del llamado, sin duplicados.';

-- ---------------------------------------------------------------------------
-- 2. Insertar (o duplicar) una fila en una posición concreta
-- ---------------------------------------------------------------------------
-- p_position NULL → al final; fuera de rango → se recorta a [1, count+1].
-- p_source_row_id no NULL → duplica esa fila del mismo llamado (copia
-- shotlist_id, duracion_min y status; ignora p_shotlist_id; no copia
-- inicio_reg ni id).
create or replace function public.pdr_insert_row(
  p_llamado_id    bigint,
  p_shotlist_id   bigint  default null,
  p_position      integer default null,
  p_source_row_id bigint  default null
)
returns public.pdr
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_proyecto_id bigint;
  v_count       integer;
  v_pos         integer;
  v_row         public.pdr;
  v_shotlist_id public.pdr.shotlist_id%type;
  v_duracion    public.pdr.duracion_min%type;
  v_status      public.pdr.status%type;
  v_new         public.pdr;
begin
  -- Mismo lock que pdr_reorder_rows: un alta y un reorden del mismo llamado
  -- nunca pueden intercalarse.
  perform pg_advisory_xact_lock(hashtext('pdr_order'), p_llamado_id::integer);

  select l.proyecto_id into v_proyecto_id
  from public.llamados l
  where l.id = p_llamado_id;

  if not found then
    raise exception 'El llamado % no existe.', p_llamado_id
      using errcode = 'P0002';
  end if;

  -- Normalizar NULL/empates a 1..N antes de operar: a partir de aquí toda la
  -- aritmética es sobre enteros contiguos y no hay que repetir COALESCE.
  with normalized as (
    select r.id,
           row_number() over (order by r.orden nulls last, r.id) as rn
    from public.pdr r
    where r.llamado_id = p_llamado_id
  )
  update public.pdr t
     set orden = n.rn::integer
    from normalized n
   where t.id = n.id
     and t.orden is distinct from n.rn::integer;

  select count(*) into v_count
  from public.pdr
  where llamado_id = p_llamado_id;

  -- Resolver el contenido de la fila a insertar.
  if p_source_row_id is not null then
    select * into v_row
    from public.pdr
    where id = p_source_row_id
      and llamado_id = p_llamado_id;

    if not found then
      raise exception 'La fila de origen % no pertenece al llamado %.',
        p_source_row_id, p_llamado_id
        using errcode = '22023';
    end if;

    v_shotlist_id := v_row.shotlist_id;
    v_duracion    := v_row.duracion_min;
    v_status      := v_row.status;
  else
    if p_shotlist_id is null then
      raise exception 'Debes indicar una toma del shotlist o una fila de origen para duplicar.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.shotlist s
      where s.id = p_shotlist_id
        and s.proyecto_id = v_proyecto_id
    ) then
      raise exception 'La toma % no pertenece al proyecto del llamado %.',
        p_shotlist_id, p_llamado_id
        using errcode = '22023';
    end if;

    v_shotlist_id := p_shotlist_id;
    v_duracion    := 0;
    v_status      := false;
  end if;

  -- NULL → final; fuera de rango → recorte (decisión de producto).
  v_pos := least(greatest(coalesce(p_position, v_count + 1), 1), v_count + 1);

  update public.pdr
     set orden = orden + 1
   where llamado_id = p_llamado_id
     and orden >= v_pos;

  insert into public.pdr (llamado_id, shotlist_id, orden, duracion_min, status, inicio_reg)
  values (
    p_llamado_id,
    v_shotlist_id,
    v_pos,
    coalesce(v_duracion, 0),
    coalesce(v_status, false),
    null
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function public.pdr_insert_row(bigint, bigint, integer, bigint) is
  'Inserta una fila de PDR en una posición (recortada al rango válido) o duplica una fila existente del mismo llamado.';

-- ---------------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------------
-- En Postgres toda función es ejecutable por PUBLIC por defecto: sin el REVOKE
-- el GRANT no restringe nada.
revoke all on function public.pdr_reorder_rows(bigint, bigint[]) from public, anon;
revoke all on function public.pdr_insert_row(bigint, bigint, integer, bigint) from public, anon;

grant execute on function public.pdr_reorder_rows(bigint, bigint[]) to authenticated;
grant execute on function public.pdr_insert_row(bigint, bigint, integer, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recargar el esquema de PostgREST
-- ---------------------------------------------------------------------------
-- Sin esto, supabase.rpc(...) puede devolver "function not found" unos minutos.
notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- VERIFICACIÓN (ejecutar aparte, solo lectura)
-- ============================================================================
-- 1) ¿Existen las funciones con la firma y el modo de seguridad esperados?
--    (prosecdef = false → SECURITY INVOKER)
--
--    select p.proname,
--           pg_get_function_identity_arguments(p.oid) as argumentos,
--           p.prosecdef as security_definer,
--           p.proconfig
--    from pg_proc p
--    join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('pdr_reorder_rows', 'pdr_insert_row');
--
-- 2) ¿Los privilegios quedaron como se espera? (authenticated = X, anon vacío)
--
--    select p.proname, p.proacl
--    from pg_proc p
--    join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('pdr_reorder_rows', 'pdr_insert_row');
--
-- 3) Estado actual del PDR (debe mantener el orden visible 1..N):
--
--    select id, llamado_id, orden, shotlist_id
--    from public.pdr
--    where llamado_id = 1
--    order by orden nulls last, id;
-- ============================================================================


-- ============================================================================
-- REVERSIÓN (DOWN) — ejecutar sólo si hay que deshacer
-- ============================================================================
-- Esta migración NO altera la tabla pdr, ni su RLS, ni sus datos: sólo crea
-- dos funciones. Por eso deshacerla es eliminar las funciones y volver a
-- recargar el esquema. No hay nada que restaurar en los datos.
--
-- begin;
--
--   revoke all on function public.pdr_reorder_rows(bigint, bigint[]) from authenticated;
--   revoke all on function public.pdr_insert_row(bigint, bigint, integer, bigint) from authenticated;
--
--   drop function if exists public.pdr_reorder_rows(bigint, bigint[]);
--   drop function if exists public.pdr_insert_row(bigint, bigint, integer, bigint);
--
--   notify pgrst, 'reload schema';
--
-- commit;
--
-- Lo único que se pierde al revertir son los permisos concedidos (se vuelven a
-- crear al re-ejecutar la migración, que es idempotente gracias a los
-- "drop function if exists" del inicio).
-- ============================================================================


-- ============================================================================
-- RESPALDO DE DATOS — recomendado ANTES de la primera prueba real del RPC
-- ============================================================================
-- El DDL de arriba no toca datos, así que este respaldo no hace falta para
-- aplicarlo. Hace falta cuando empieces a invocar pdr_reorder_rows /
-- pdr_insert_row (Paso 5), porque ahí sí se reescriben valores de "orden".
--
-- 1) Crear la foto:
--
--    create table if not exists public.pdr_backup_20261021 as
--    select * from public.pdr;
--
-- 2) Restaurar el orden si una prueba sale mal:
--
--    update public.pdr t
--       set orden = b.orden
--      from public.pdr_backup_20261021 b
--     where t.id = b.id;
--
-- 3) Verificar que coinciden:
--
--    select count(*) as diferencias
--    from public.pdr t
--    join public.pdr_backup_20261021 b on b.id = t.id
--    where t.orden is distinct from b.orden;
--
-- 4) Cuando todo esté validado, eliminar la tabla temporal:
--
--    drop table if exists public.pdr_backup_20261021;
--
-- Nota: una tabla de respaldo sin RLS queda accesible vía PostgREST con la
-- anon key. Si prefieres, créala y bórrala en la misma sesión de pruebas.
-- ============================================================================
