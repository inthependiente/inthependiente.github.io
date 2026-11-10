-- ═══════════════════════════════════════════════════════════════════════════
--  LlamadoAPP · Panel de invitaciones del admin
--
--  Reemplaza las funciones anteriores por una sola consulta que devuelve a
--  TODO el crew del llamado (aunque todavía no tenga token), junto con su
--  acceso y su confirmación. Así el panel puede mostrar el estado real sin
--  filas faltantes.
--
--  Aplicar con:  supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

-- La firma de retorno cambia, por eso hay que eliminar antes de recrear.
drop function if exists public.admin_generar_invitaciones(bigint);
drop function if exists public.admin_resumen_confirmaciones(bigint);

-- ─────────────────────────────────────────────────────────────
--  Generar los tokens que falten
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_generar_invitaciones(p_llamado_id bigint)
returns table (creados integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes  integer;
  v_total  integer;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select count(*) into v_antes from public.crew_invitaciones where llamado_id = p_llamado_id;

  insert into public.crew_invitaciones (llamado_id, crew_id)
  select cl.llamado_id, cl.crew_id
    from public.crew_llamado cl
   where cl.llamado_id = p_llamado_id
  on conflict (llamado_id, crew_id) do nothing;

  select count(*) into v_total from public.crew_invitaciones where llamado_id = p_llamado_id;

  return query select (v_total - v_antes)::integer, v_total::integer;
end;
$$;

comment on function public.admin_generar_invitaciones(bigint) is
  'Admin: crea el token personal de cada persona del llamado que aún no lo tenga.';

-- ─────────────────────────────────────────────────────────────
--  Panel: crew + token + acceso + confirmación
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_panel_invitaciones(p_llamado_id bigint)
returns table (
  crew_id       bigint,
  nombre        text,
  cargo         text,
  departamento  text,
  hora_llamado  text,
  celular       text,
  orden         numeric,
  token         uuid,
  acceso_en     timestamptz,
  confirmado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select cl.crew_id,
         c.nombre,
         c.cargo,
         c.departamento,
         coalesce(cl.hora_llamado, c.llamado_hora)::text,
         c.celular,
         cl.orden,
         ci.token,
         (select min(r.creado_en) from public.llamado_respuestas r
           where r.llamado_id = cl.llamado_id
             and r.crew_id = cl.crew_id
             and r.evento = 'acceso'),
         (select min(r.creado_en) from public.llamado_respuestas r
           where r.llamado_id = cl.llamado_id
             and r.crew_id = cl.crew_id
             and r.evento = 'confirmacion')
    from public.crew_llamado cl
    join public.crew c on c.id = cl.crew_id
    left join public.crew_invitaciones ci
      on ci.llamado_id = cl.llamado_id and ci.crew_id = cl.crew_id
   where cl.llamado_id = p_llamado_id
   order by cl.orden nulls last, c.nombre;
end;
$$;

comment on function public.admin_panel_invitaciones(bigint) is
  'Admin: estado de invitación, acceso y confirmación de todo el crew del llamado.';

-- ─────────────────────────────────────────────────────────────
--  Permisos
-- ─────────────────────────────────────────────────────────────
revoke all on function public.admin_generar_invitaciones(bigint) from public, anon;
revoke all on function public.admin_panel_invitaciones(bigint) from public, anon;

grant execute on function public.admin_generar_invitaciones(bigint) to authenticated, service_role;
grant execute on function public.admin_panel_invitaciones(bigint) to authenticated, service_role;

notify pgrst, 'reload schema';
