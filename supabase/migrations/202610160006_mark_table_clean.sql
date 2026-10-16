-- Permite liberar una mesa cobrada después de verificar que quedó limpia.
-- La operación es atómica, limitada a la sucursal y queda auditada.

create or replace function public.mark_table_clean(requested_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_profiles%rowtype;
  cleaned_version integer;
begin
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
      and role.code in ('administrator', 'manager', 'captain', 'host')
  ) then
    raise exception 'Tu rol no puede liberar mesas.';
  end if;

  update public.tables
  set status = 'free', version = version + 1, updated_at = now()
  where id = requested_table_id
    and organization_id = actor.organization_id
    and branch_id = actor.branch_id
    and status = 'needs_cleaning'
    and deleted_at is null
  returning version into cleaned_version;

  if cleaned_version is null then
    raise exception 'La mesa no está pendiente de limpieza o ya fue liberada.';
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action,
    entity_type, entity_id, new_value, reason
  ) values (
    actor.organization_id, actor.branch_id, actor.id, actor.role_id,
    'table.marked_clean', 'table', requested_table_id,
    jsonb_build_object('status', 'free', 'version', cleaned_version),
    'Liberación posterior al cobro y limpieza'
  );

  return true;
end;
$$;

revoke all on function public.mark_table_clean(uuid) from public, anon, authenticated;
grant execute on function public.mark_table_clean(uuid) to authenticated;
