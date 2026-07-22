-- Marisquería OS · Fase 1
-- Ejecutar únicamente en el proyecto Supabase exclusivo de este repositorio.

create extension if not exists pgcrypto;

create type public.table_status as enum (
  'free', 'reserved', 'seating', 'occupied', 'waiting_food', 'food_ready',
  'eating', 'check_requested', 'paying', 'needs_cleaning', 'blocked'
);
create type public.station_type as enum ('cold_kitchen', 'hot_kitchen', 'bar', 'expedition');
create type public.order_status as enum ('draft', 'submitted', 'in_progress', 'ready', 'delivered', 'cancelled', 'closed');
create type public.order_item_status as enum ('pending', 'received', 'preparing', 'ready', 'delivered', 'paused', 'cancelled', 'remake');
create type public.payment_method as enum ('cash', 'card', 'transfer', 'other');
create type public.inventory_movement_type as enum ('purchase', 'sale', 'adjustment', 'waste', 'transfer_in', 'transfer_out');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  slug text not null,
  address jsonb not null default '{}'::jsonb,
  phone text,
  timezone text not null default 'America/Mexico_City',
  currency char(3) not null default 'MXN',
  tax_rate_basis_points integer not null default 1600 check (tax_rate_basis_points between 0 and 10000),
  suggested_tip_basis_points integer[] not null default array[1000, 1500, 2000],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  description text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.role_permissions (
  organization_id uuid not null references public.organizations(id),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  role_id uuid references public.roles(id),
  employee_number text,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number)
);

create table public.employee_pins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.restaurant_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (branch_id, name)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  section_id uuid references public.restaurant_sections(id),
  name text not null,
  capacity integer not null check (capacity > 0 and capacity <= 50),
  status public.table_status not null default 'free',
  position_x numeric(7,2) not null default 0,
  position_y numeric(7,2) not null default 0,
  width numeric(7,2) not null default 120,
  height numeric(7,2) not null default 90,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (branch_id, name)
);

create table public.preparation_stations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  station_type public.station_type not null,
  attention_minutes integer not null default 10 check (attention_minutes > 0),
  delayed_minutes integer not null default 18 check (delayed_minutes > attention_minutes),
  critical_minutes integer not null default 25 check (critical_minutes > delayed_minutes),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, station_type)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (branch_id, name)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  category_id uuid not null references public.menu_categories(id),
  station_id uuid not null references public.preparation_stations(id),
  sku text,
  name text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  tax_rate_basis_points integer not null default 1600 check (tax_rate_basis_points between 0 and 10000),
  expected_minutes integer not null default 15 check (expected_minutes > 0),
  image_url text,
  allergens text[] not null default '{}',
  tags text[] not null default '{}',
  is_available boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (branch_id, sku),
  unique (branch_id, name)
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  min_selections integer not null default 0,
  max_selections integer not null default 1 check (max_selections >= min_selections),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents bigint not null default 0,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.item_modifier_groups (
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (menu_item_id, modifier_group_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  contact jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  supplier_id uuid references public.suppliers(id),
  sku text,
  name text not null,
  unit text not null check (unit in ('g','kg','ml','l','piece','portion')),
  stock_quantity numeric(14,3) not null default 0 check (stock_quantity >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id, ingredient_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  ingredient_id uuid not null references public.ingredients(id),
  movement_type public.inventory_movement_type not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_cost_cents bigint check (unit_cost_cents >= 0),
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  opened_by uuid not null references public.user_profiles(id),
  closed_by uuid references public.user_profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  shift_id uuid not null references public.shifts(id),
  cashier_id uuid not null references public.user_profiles(id),
  opening_amount_cents bigint not null check (opening_amount_cents >= 0),
  closing_amount_cents bigint check (closing_amount_cents >= 0),
  expected_amount_cents bigint,
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  cash_register_id uuid not null references public.cash_registers(id),
  movement_type text not null check (movement_type in ('in','out','withdrawal','adjustment')),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_id uuid not null references public.tables(id),
  waiter_id uuid not null references public.user_profiles(id),
  guest_count integer not null check (guest_count > 0),
  status text not null default 'open' check (status in ('open','check_requested','paying','closed','cancelled')),
  notes text,
  version integer not null default 1,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_open_session_per_table on public.table_sessions(table_id)
  where status in ('open','check_requested','paying');

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  seat_number integer not null check (seat_number > 0),
  display_name text,
  created_at timestamptz not null default now(),
  unique (table_session_id, seat_number)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_session_id uuid not null references public.table_sessions(id),
  waiter_id uuid not null references public.user_profiles(id),
  folio bigint generated always as identity,
  round_number integer not null default 1 check (round_number > 0),
  status public.order_status not null default 'draft',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  allergy_alert text,
  submitted_at timestamptz,
  closed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  guest_id uuid references public.guests(id),
  menu_item_id uuid not null references public.menu_items(id),
  station_id uuid not null references public.preparation_stations(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  status public.order_item_status not null default 'pending',
  notes text,
  allergy_alert text,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id),
  name_snapshot text not null,
  price_delta_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  order_id uuid not null references public.orders(id),
  station_id uuid not null references public.preparation_stations(id),
  status text not null default 'open' check (status in ('open','preparing','ready','completed','cancelled')),
  priority integer not null default 0,
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, station_id)
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_session_id uuid not null references public.table_sessions(id),
  order_item_id uuid references public.order_items(id),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  requested_by uuid not null references public.user_profiles(id),
  authorized_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_session_id uuid not null references public.table_sessions(id),
  cash_register_id uuid references public.cash_registers(id),
  method public.payment_method not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  provider_reference text,
  idempotency_key text not null,
  received_by uuid not null references public.user_profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  payment_id uuid not null references public.payments(id),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  payment_id uuid not null references public.payments(id),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  requested_by uuid not null references public.user_profiles(id),
  authorized_by uuid not null references public.user_profiles(id),
  refunded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  table_session_id uuid not null references public.table_sessions(id),
  folio text not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tip_cents bigint not null default 0 check (tip_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  payload jsonb not null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (branch_id, folio)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid references public.user_profiles(id),
  role_id uuid references public.roles(id),
  notification_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  requires_acknowledgement boolean not null default false,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  user_id uuid not null references public.user_profiles(id),
  device_name text,
  user_agent text,
  ip_hash text,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  user_id uuid references public.user_profiles(id),
  role_id uuid references public.roles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  device_session_id uuid references public.device_sessions(id),
  occurred_at timestamptz not null default now()
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references public.user_profiles(id),
  key text not null,
  operation text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  locked_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  sequence_number bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index user_profiles_scope_idx on public.user_profiles(organization_id, branch_id);
create index tables_scope_status_idx on public.tables(branch_id, status) where deleted_at is null;
create index menu_items_scope_available_idx on public.menu_items(branch_id, is_available) where deleted_at is null;
create index orders_session_status_idx on public.orders(table_session_id, status);
create index order_items_station_status_idx on public.order_items(station_id, status, created_at);
create index kitchen_tickets_station_status_idx on public.kitchen_tickets(station_id, status, received_at);
create index inventory_movements_ingredient_idx on public.inventory_movements(ingredient_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);
create index outbox_unpublished_idx on public.outbox_events(sequence_number) where published_at is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','branches','roles','user_profiles','restaurant_sections','tables',
    'preparation_stations','menu_categories','menu_items','modifier_groups','modifiers',
    'suppliers','ingredients','recipes','shifts','cash_registers','table_sessions',
    'orders','order_items','kitchen_tickets','payments'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end $$;

create or replace function public.current_organization_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.user_profiles where id = auth.uid() and is_active;
$$;

create or replace function public.current_branch_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select branch_id from public.user_profiles where id = auth.uid() and is_active;
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles profile
    join public.role_permissions rp on rp.role_id = profile.role_id
    join public.permissions permission on permission.id = rp.permission_id
    where profile.id = auth.uid()
      and profile.is_active
      and permission.code = permission_code
  );
$$;

revoke all on function public.current_organization_id() from public;
revoke all on function public.current_branch_id() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_branch_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  org_id uuid := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;
  selected_branch_id uuid := nullif(new.raw_user_meta_data ->> 'branch_id', '')::uuid;
  selected_role_id uuid := nullif(new.raw_user_meta_data ->> 'role_id', '')::uuid;
begin
  if org_id is null then
    return new;
  end if;

  insert into public.user_profiles (
    id, organization_id, branch_id, role_id, employee_number, full_name
  ) values (
    new.id,
    org_id,
    selected_branch_id,
    selected_role_id,
    nullif(new.raw_user_meta_data ->> 'employee_number', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.verify_employee_pin(
  requested_branch_id uuid,
  requested_employee_number text,
  candidate_pin text
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare pin_record public.employee_pins%rowtype;
begin
  if candidate_pin !~ '^[0-9]{4,8}$' then return false; end if;

  select pins.* into pin_record
  from public.employee_pins pins
  join public.user_profiles profile on profile.id = pins.user_id
  where pins.branch_id = requested_branch_id
    and profile.employee_number = requested_employee_number
    and profile.is_active
  for update;

  if not found or pin_record.locked_until > now() then return false; end if;

  if pin_record.pin_hash = crypt(candidate_pin, pin_record.pin_hash) then
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

revoke all on function public.verify_employee_pin(uuid, text, text) from public;
grant execute on function public.verify_employee_pin(uuid, text, text) to anon, authenticated;

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.user_profiles enable row level security;

create policy organizations_read on public.organizations for select to authenticated
  using (id = public.current_organization_id());
create policy organizations_manage on public.organizations for update to authenticated
  using (id = public.current_organization_id() and public.has_permission('organization.manage'))
  with check (id = public.current_organization_id() and public.has_permission('organization.manage'));

create policy branches_read on public.branches for select to authenticated
  using (organization_id = public.current_organization_id() and (id = public.current_branch_id() or public.has_permission('branches.all')));
create policy branches_manage on public.branches for all to authenticated
  using (organization_id = public.current_organization_id() and public.has_permission('branches.manage'))
  with check (organization_id = public.current_organization_id() and public.has_permission('branches.manage'));

create policy profiles_read on public.user_profiles for select to authenticated
  using (id = auth.uid() or (organization_id = public.current_organization_id() and public.has_permission('users.read')));
create policy profiles_manage on public.user_profiles for update to authenticated
  using (organization_id = public.current_organization_id() and public.has_permission('users.manage'))
  with check (organization_id = public.current_organization_id() and public.has_permission('users.manage'));

do $$
declare table_name text;
begin
  foreach table_name in array array['roles','permissions','role_permissions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id())',
      table_name || '_read', table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and public.has_permission(''roles.manage'')) with check (organization_id = public.current_organization_id() and public.has_permission(''roles.manage''))',
      table_name || '_manage', table_name
    );
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'restaurant_sections','tables','preparation_stations','menu_categories',
    'menu_items','modifier_groups','modifiers','item_modifier_groups','suppliers','ingredients',
    'recipes','inventory_movements','shifts','cash_registers','cash_movements','table_sessions',
    'guests','orders','order_items','order_item_modifiers','kitchen_tickets','discounts',
    'payments','tips','refunds','receipts','notifications','idempotency_keys','outbox_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')))',
      table_name || '_read', table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''data.write'')) with check (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''data.write''))',
      table_name || '_write', table_name
    );
  end loop;
end $$;

alter table public.employee_pins enable row level security;
-- Los hashes nunca se exponen por PostgREST; sólo funciones SECURITY DEFINER los verifican.
create policy employee_pins_manage on public.employee_pins for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
    and public.has_permission('users.manage')
  );
create policy employee_pins_reset on public.employee_pins for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
    and public.has_permission('users.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
    and public.has_permission('users.manage')
  );

alter table public.device_sessions enable row level security;
create policy device_sessions_own on public.device_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and organization_id = public.current_organization_id());

alter table public.audit_logs enable row level security;
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (organization_id = public.current_organization_id() and public.has_permission('audit.read'));
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (organization_id = public.current_organization_id() and (branch_id is null or branch_id = public.current_branch_id() or public.has_permission('branches.all')) and user_id = auth.uid());

alter publication supabase_realtime add table
  public.tables,
  public.menu_items,
  public.table_sessions,
  public.orders,
  public.order_items,
  public.kitchen_tickets,
  public.notifications;
