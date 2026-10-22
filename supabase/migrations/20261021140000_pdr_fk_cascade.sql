-- ============================================================================
-- LlamadoApp — FK pdr.llamado_id con ON DELETE CASCADE
-- ============================================================================
-- Contexto:
--   Tras eliminar la FK duplicada sobrevivió pdr_llamado_id_fkey1 con
--   ON DELETE SET NULL, lo que dejaría filas de PDR huérfanas (llamado_id
--   NULL) al borrar un llamado: invisibles en la UI, pero presentes en la
--   tabla. La relación PDR → llamado es padre-hijo, así que CASCADE es el
--   comportamiento correcto.
--
-- Este script:
--   * elimina la FK actual (con cualquier nombre que tenga),
--   * la recrea con el nombre canónico pdr_llamado_id_fkey y ON DELETE CASCADE,
--   * recarga el esquema de PostgREST.
-- ============================================================================

begin;

-- Eliminar la FK existente sea cual sea su nombre (idempotente).
alter table public.pdr drop constraint if exists pdr_llamado_id_fkey1;
alter table public.pdr drop constraint if exists pdr_llamado_id_fkey;

-- Recrear con nombre canónico y borrado en cascada.
alter table public.pdr
  add constraint pdr_llamado_id_fkey
  foreign key (llamado_id) references public.llamados(id)
  on delete cascade
  on update cascade;

notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- VERIFICACIÓN (ejecutar después del commit)
-- ============================================================================
-- Debe devolver una sola fila con "ON DELETE CASCADE":
--
--   select c.conname, pg_get_constraintdef(c.oid) as definicion
--   from pg_constraint c
--   join pg_class t on t.oid = c.conrelid
--   join pg_namespace n on n.oid = t.relnamespace
--   where n.nspname = 'public'
--     and t.relname = 'pdr'
--     and c.contype = 'f'
--     and c.confrelid = 'public.llamados'::regclass;
-- ============================================================================


-- ============================================================================
-- REVERSIÓN (solo si hiciera falta volver a SET NULL)
-- ============================================================================
-- begin;
--   alter table public.pdr drop constraint if exists pdr_llamado_id_fkey;
--   alter table public.pdr
--     add constraint pdr_llamado_id_fkey1
--     foreign key (llamado_id) references public.llamados(id)
--     on delete set null;
--   notify pgrst, 'reload schema';
-- commit;
-- ============================================================================
