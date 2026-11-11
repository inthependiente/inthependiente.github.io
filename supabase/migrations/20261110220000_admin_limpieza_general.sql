-- ═══════════════════════════════════════════════════════════════════════════
--  LlamadoAPP · Limpieza general de la base (panel admin)
--
--  Vacía el rodaje completo y reinicia los contadores de ID:
--
--    se vacían      proyectos, llamados, locaciones, escenas, shotlist, pdr,
--                   talento, crew_llamado, crew_invitaciones (invitaciones)
--                   y llamado_respuestas (confirmaciones)
--    se conservan    hospitales (Centros médicos), crew, cliente_agencia,
--                    ciudades (catálogo) y storyboards
--
--  `cliente_agencia` no se borra, pero sus filas quedan sin llamado para poder
--  borrar `llamados` (la FK no es ON DELETE SET NULL).
--
--  Los storyboards cuelgan de `proyectos` con ON DELETE CASCADE y `proyecto_id`
--  es NOT NULL: borrar los proyectos los borraría también. Por eso la función
--  ABORTA si existe algún storyboard y pide usar su propio botón de borrado.
--
--  Todo ocurre en una sola transacción: si algo falla, no se borra nada.
--
--  Aplicar con:  supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_limpieza_general()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storyboards    integer;
  v_invitaciones   integer;
  v_confirmaciones integer;
  v_clientes       integer;
  v_conteo         jsonb := '{}'::jsonb;
  v_borradas       integer;
  v_tabla          text;
  -- Orden FK-safe: primero las hijas, al final los catálogos referenciados.
  v_tablas constant text[] := array[
    'llamado_respuestas',
    'crew_invitaciones',
    'pdr',
    'talento',
    'escenas',
    'crew_llamado',
    'shotlist',
    'llamados',
    'locaciones',
    'proyectos'
  ];
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- ── Guarda: los storyboards no se tocan ──────────────────────
  select count(*) into v_storyboards from public.storyboards;
  if v_storyboards > 0 then
    raise exception
      'Hay % storyboard(s) guardado(s). La limpieza borraría los proyectos y, con ellos, los storyboards. Bórralos primero desde la sección Storyboard y vuelve a intentarlo.',
      v_storyboards
      using errcode = 'P0001';
  end if;

  -- ── Cliente / Agencia: se conserva, solo queda sin llamado ───
  update public.cliente_agencia
     set llamado_id = null
   where llamado_id is not null;
  get diagnostics v_clientes = row_count;

  -- ── Borrado de las tablas del rodaje ─────────────────────────
  foreach v_tabla in array v_tablas loop
    execute format('delete from public.%I', v_tabla);
    get diagnostics v_borradas = row_count;
    v_conteo := v_conteo || jsonb_build_object(v_tabla, v_borradas);
  end loop;

  v_invitaciones := coalesce((v_conteo ->> 'crew_invitaciones')::integer, 0);
  v_confirmaciones := coalesce((v_conteo ->> 'llamado_respuestas')::integer, 0);

  -- ── Reinicio de contadores (el próximo id vuelve a ser 1) ────
  foreach v_tabla in array v_tablas loop
    execute format('alter table public.%I alter column id restart with 1', v_tabla);
  end loop;

  return jsonb_build_object(
    'tablas', v_conteo,
    'invitaciones', v_invitaciones,
    'confirmaciones', v_confirmaciones,
    'clientes_sin_llamado', v_clientes
  );
end;
$$;

comment on function public.admin_limpieza_general() is
  'Admin: vacía el rodaje (proyectos, llamados, locaciones, escenas, shotlist, pdr, talento, crew_llamado, invitaciones y confirmaciones) y reinicia sus IDs. Conserva Centros médicos, Crew, Cliente/Agencia, Ciudades y Storyboard.';

-- ─────────────────────────────────────────────────────────────
--  Permisos
-- ─────────────────────────────────────────────────────────────
revoke all on function public.admin_limpieza_general() from public, anon;
grant execute on function public.admin_limpieza_general() to authenticated, service_role;

notify pgrst, 'reload schema';
