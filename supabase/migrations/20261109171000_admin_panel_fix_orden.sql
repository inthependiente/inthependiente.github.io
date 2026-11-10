-- ═══════════════════════════════════════════════════════════════════════════
--  Corrección de tipo en admin_panel_invitaciones
--
--  crew_llamado.orden es integer, pero la función lo declaraba numeric y
--  PostgREST rechazaba la respuesta (42804). Se recrea con el tipo real.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.admin_panel_invitaciones(bigint);

create or replace function public.admin_panel_invitaciones(p_llamado_id bigint)
returns table (
  crew_id       bigint,
  nombre        text,
  cargo         text,
  departamento  text,
  hora_llamado  text,
  celular       text,
  orden         integer,
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

revoke all on function public.admin_panel_invitaciones(bigint) from public, anon;
grant execute on function public.admin_panel_invitaciones(bigint) to authenticated, service_role;

notify pgrst, 'reload schema';
