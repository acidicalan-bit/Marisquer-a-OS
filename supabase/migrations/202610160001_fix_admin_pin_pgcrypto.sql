-- Supabase instala pgcrypto en el esquema extensions. Las funciones SECURITY
-- DEFINER usan search_path vacío, por lo que deben calificar crypt/gen_salt.

create or replace function public.set_admin_security_pin(
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
  target_role text;
begin
  select * into actor from public.user_profiles
  where id = auth.uid() and is_active;
  if not found or not public.has_permission('users.manage') then
    raise exception 'Sólo Administración puede configurar PIN.';
  end if;
  if candidate_pin is null or candidate_pin !~ '^[0-9]{4,8}$' then
    raise exception 'El NIP debe contener entre 4 y 8 dígitos.';
  end if;
  select * into target from public.user_profiles
  where id = requested_user_id
    and organization_id = actor.organization_id
    and branch_id = actor.branch_id
    and is_active;
  if not found then raise exception 'El administrador seleccionado no es válido.'; end if;
  select role.code into target_role from public.roles role
  where role.id = target.role_id and role.organization_id = target.organization_id;
  if target_role not in ('administrator', 'manager') then
    raise exception 'El NIP de autorización sólo puede pertenecer a Administración.';
  end if;
  insert into public.employee_pins (organization_id, branch_id, user_id, pin_hash, changed_at)
  values (target.organization_id, target.branch_id, target.id, extensions.crypt(candidate_pin, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update set
    organization_id = excluded.organization_id,
    branch_id = excluded.branch_id,
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = null,
    changed_at = now();
  insert into public.audit_logs (organization_id, branch_id, user_id, role_id, action, entity_type, entity_id, new_value)
  values (actor.organization_id, actor.branch_id, actor.id, actor.role_id,
    'admin.security_pin_changed', 'user_profile', target.id,
    jsonb_build_object('target_role', target_role));
  return true;
end;
$$;

create or replace function public.verify_admin_approval_pin(
  requested_branch_id uuid,
  candidate_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_record public.employee_pins%rowtype;
begin
  if candidate_pin is null or candidate_pin !~ '^[0-9]{4,8}$' then return false; end if;
  select pins.* into pin_record
  from public.employee_pins pins
  join public.user_profiles profile on profile.id = pins.user_id
  join public.roles role on role.id = profile.role_id and role.organization_id = profile.organization_id
  where pins.branch_id = requested_branch_id
    and profile.branch_id = requested_branch_id
    and profile.is_active
    and role.code in ('administrator', 'manager')
  order by pins.changed_at desc
  limit 1
  for update;
  if not found or pin_record.locked_until > now() then return false; end if;
  if pin_record.pin_hash = extensions.crypt(candidate_pin, pin_record.pin_hash) then
    update public.employee_pins set failed_attempts = 0, locked_until = null where id = pin_record.id;
    return true;
  end if;
  update public.employee_pins
  set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
  where id = pin_record.id;
  return false;
end;
$$;

revoke all on function public.set_admin_security_pin(uuid, text) from public;
revoke all on function public.verify_admin_approval_pin(uuid, text) from public;
grant execute on function public.set_admin_security_pin(uuid, text) to authenticated;
grant execute on function public.verify_admin_approval_pin(uuid, text) to authenticated;
