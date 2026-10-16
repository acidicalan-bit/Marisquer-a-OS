-- NIP de acceso rápido para meseros. El PIN sólo se almacena como hash.
create or replace function public.set_employee_pin(
  requested_user_id uuid,
  candidate_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_profiles%rowtype;
  target public.user_profiles%rowtype;
begin
  if candidate_pin is null or candidate_pin !~ '^[0-9]{4,8}$' then
    raise exception 'El NIP debe contener entre 4 y 8 dígitos.';
  end if;

  select * into actor
  from public.user_profiles
  where id = auth.uid() and is_active;

  if not found or actor.branch_id is null then
    raise exception 'Perfil activo con sucursal requerido.';
  end if;

  if not exists (
    select 1
    from public.roles role
    where role.id = actor.role_id
      and role.organization_id = actor.organization_id
      and role.code in ('administrator', 'manager')
  ) then
    raise exception 'Sólo Administración puede configurar NIP de meseros.';
  end if;

  select profile.* into target
  from public.user_profiles profile
  join public.roles role on role.id = profile.role_id
    and role.organization_id = profile.organization_id
  where profile.id = requested_user_id
    and profile.organization_id = actor.organization_id
    and profile.branch_id = actor.branch_id
    and profile.is_active
    and role.code in ('waiter', 'captain');

  if not found then
    raise exception 'El usuario no es un mesero activo de esta sucursal.';
  end if;

  insert into public.employee_pins (
    organization_id, branch_id, user_id, pin_hash, failed_attempts, locked_until, changed_at
  ) values (
    target.organization_id, target.branch_id, target.id,
    extensions.crypt(candidate_pin, extensions.gen_salt('bf')), 0, null, now()
  )
  on conflict (user_id) do update set
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = null,
    changed_at = now();

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action,
    entity_type, entity_id, new_value, reason
  ) values (
    actor.organization_id, actor.branch_id, actor.id, actor.role_id,
    'employee.pin_changed', 'user_profile', target.id,
    jsonb_build_object('employee_number', target.employee_number),
    'NIP de acceso rápido configurado por Administración'
  );
  return true;
end;
$$;

revoke all on function public.set_employee_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.set_employee_pin(uuid, text) to authenticated;
