-- Endurece el aprovisionamiento de usuarios y obliga a que las operaciones
-- financieras pasen por las funciones transaccionales auditadas.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid;
  selected_branch_id uuid := nullif(new.raw_app_meta_data ->> 'branch_id', '')::uuid;
  selected_role_id uuid := nullif(new.raw_app_meta_data ->> 'role_id', '')::uuid;
begin
  -- Los metadatos de usuario son controlables durante un signup público.
  -- Sólo raw_app_meta_data, escrito mediante la API administrativa, puede
  -- aprovisionar un perfil con permisos de negocio.
  if org_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.organizations organization
    where organization.id = org_id and organization.is_active
  ) then
    raise exception 'Organización de usuario inválida.';
  end if;

  if selected_branch_id is not null and not exists (
    select 1 from public.branches branch
    where branch.id = selected_branch_id
      and branch.organization_id = org_id
      and branch.is_active
  ) then
    raise exception 'Sucursal de usuario inválida.';
  end if;

  if selected_role_id is not null and not exists (
    select 1 from public.roles role
    where role.id = selected_role_id
      and role.organization_id = org_id
      and role.is_active
  ) then
    raise exception 'Rol de usuario inválido.';
  end if;

  insert into public.user_profiles (
    id, organization_id, branch_id, role_id, employee_number, full_name
  ) values (
    new.id,
    org_id,
    selected_branch_id,
    selected_role_id,
    nullif(new.raw_user_meta_data ->> 'employee_number', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  ) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'branches_id_organization_unique'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_id_organization_unique unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'roles_id_organization_unique'
      and conrelid = 'public.roles'::regclass
  ) then
    alter table public.roles
      add constraint roles_id_organization_unique unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_branch_organization_fkey'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_branch_organization_fkey
      foreign key (branch_id, organization_id)
      references public.branches(id, organization_id)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_role_organization_fkey'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_role_organization_fkey
      foreign key (role_id, organization_id)
      references public.roles(id, organization_id)
      not valid;
  end if;
end $$;
alter table public.user_profiles
  validate constraint user_profiles_branch_organization_fkey;
alter table public.user_profiles
  validate constraint user_profiles_role_organization_fkey;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cash_registers', 'cash_movements', 'discounts', 'payments', 'tips',
    'refunds', 'receipts', 'idempotency_keys'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'revoke insert, update, delete on table public.%I from authenticated',
      table_name
    );
  end loop;
end $$;
