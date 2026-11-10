-- ═══════════════════════════════════════════════════════════════════════════
--  LlamadoAPP · Código corto personal
--
--  Sustituye el link `?id=1&t=<uuid>` (83 caracteres) por `?c=K7P2QX9`
--  (49 caracteres). El uuid deja de viajar en la URL: el código lo resuelve
--  en el servidor y es revocable regenerándolo.
--
--  Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para poder dictarlo por
--  teléfono: 31 símbolos ^ 6 = ~887 millones de combinaciones.
--
--  Aplicar con:  supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  Columna + generador
-- ─────────────────────────────────────────────────────────────
alter table public.crew_invitaciones add column if not exists codigo text;

comment on column public.crew_invitaciones.codigo is
  'Código corto público del link personal (6 caracteres, sin 0/O/1/I/L).';

create or replace function public.generar_codigo_personal()
returns text
language sql
volatile
as $$
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
                  1 + floor(random() * 31)::int,
                  1),
           ''
         )
    from generate_series(1, 6);
$$;

comment on function public.generar_codigo_personal() is
  'Genera un código de 6 caracteres con alfabeto sin ambigüedades.';

-- ─────────────────────────────────────────────────────────────
--  Relleno de las invitaciones existentes, sin colisiones
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r       record;
  v_cod   text;
begin
  for r in select id from public.crew_invitaciones where codigo is null order by id loop
    loop
      v_cod := public.generar_codigo_personal();
      exit when not exists (select 1 from public.crew_invitaciones where codigo = v_cod);
    end loop;

    update public.crew_invitaciones set codigo = v_cod where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crew_invitaciones_codigo_key') then
    alter table public.crew_invitaciones add constraint crew_invitaciones_codigo_key unique (codigo);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'crew_codigo_formato') then
    alter table public.crew_invitaciones
      add constraint crew_codigo_formato check (codigo ~ '^[2-9A-HJKMNP-Z]{6}$');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
--  RPC pública · resolver código y registrar acceso/confirmación
--  Se recrea con p_codigo opcional; PostgREST resuelve por nombre, así que
--  los links antiguos con ?t=<uuid> siguen funcionando.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.movil_registrar_evento(uuid, text);

create or replace function public.movil_registrar_evento(
  p_evento text,
  p_token  uuid default null,
  p_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv        public.crew_invitaciones;
  v_confirmado timestamptz;
  v_nombre     text;
  v_headers    jsonb;
  v_codigo     text;
begin
  if p_evento is null or p_evento not in ('acceso', 'confirmacion') then
    return jsonb_build_object('ok', false, 'error', 'evento_invalido');
  end if;

  v_codigo := upper(btrim(coalesce(p_codigo, '')));

  if p_token is null and v_codigo = '' then
    return jsonb_build_object('ok', false, 'error', 'sin_credencial');
  end if;

  if p_token is not null then
    select * into v_inv from public.crew_invitaciones where token = p_token;
  else
    select * into v_inv from public.crew_invitaciones where codigo = v_codigo;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_invalido');
  end if;

  select nombre into v_nombre from public.crew where id = v_inv.crew_id;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  insert into public.llamado_respuestas
    (llamado_id, crew_id, invitacion_id, evento, user_agent, plataforma)
  values (
    v_inv.llamado_id,
    v_inv.crew_id,
    v_inv.id,
    p_evento,
    nullif(left(coalesce(v_headers->>'user-agent', ''), 400), ''),
    nullif(left(trim(both '"' from coalesce(v_headers->>'sec-ch-ua-platform', '')), 40), '')
  )
  on conflict do nothing;

  select min(creado_en) into v_confirmado
    from public.llamado_respuestas
   where llamado_id = v_inv.llamado_id
     and crew_id = v_inv.crew_id
     and evento = 'confirmacion';

  return jsonb_build_object(
    'ok', true,
    'llamado_id', v_inv.llamado_id,
    'crew_id', v_inv.crew_id,
    'nombre', v_nombre,
    'confirmado_en', v_confirmado,
    'evento', p_evento
  );
end;
$$;

comment on function public.movil_registrar_evento(text, uuid, text) is
  'App móvil: registra acceso y confirmación a partir del código corto o del token del link.';

-- ─────────────────────────────────────────────────────────────
--  Generar invitaciones incluyendo el código
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_generar_invitaciones(p_llamado_id bigint)
returns table (creados integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes integer;
  v_total integer;
  r       record;
  v_cod   text;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'service_role') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select count(*) into v_antes from public.crew_invitaciones where llamado_id = p_llamado_id;

  for r in
    select cl.crew_id
      from public.crew_llamado cl
     where cl.llamado_id = p_llamado_id
       and not exists (
         select 1 from public.crew_invitaciones ci
          where ci.llamado_id = p_llamado_id and ci.crew_id = cl.crew_id
       )
  loop
    loop
      v_cod := public.generar_codigo_personal();
      exit when not exists (select 1 from public.crew_invitaciones where codigo = v_cod);
    end loop;

    insert into public.crew_invitaciones (llamado_id, crew_id, codigo)
    values (p_llamado_id, r.crew_id, v_cod);
  end loop;

  select count(*) into v_total from public.crew_invitaciones where llamado_id = p_llamado_id;

  return query select (v_total - v_antes)::integer, v_total::integer;
end;
$$;

comment on function public.admin_generar_invitaciones(bigint) is
  'Admin: crea el token y el código personal de cada persona del llamado que aún no los tenga.';

-- ─────────────────────────────────────────────────────────────
--  Panel: incluye el código
-- ─────────────────────────────────────────────────────────────
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
  codigo        text,
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
         ci.codigo,
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
  'Admin: estado de invitación, código, acceso y confirmación de todo el crew del llamado.';

-- ─────────────────────────────────────────────────────────────
--  Permisos
-- ─────────────────────────────────────────────────────────────
revoke all on function public.movil_registrar_evento(text, uuid, text) from public;
revoke all on function public.admin_generar_invitaciones(bigint) from public, anon;
revoke all on function public.admin_panel_invitaciones(bigint) from public, anon;
revoke all on function public.generar_codigo_personal() from public, anon, authenticated;

grant execute on function public.movil_registrar_evento(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_generar_invitaciones(bigint) to authenticated, service_role;
grant execute on function public.admin_panel_invitaciones(bigint) to authenticated, service_role;

notify pgrst, 'reload schema';
