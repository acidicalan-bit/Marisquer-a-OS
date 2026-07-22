-- Panel administrativo: permisos granulares y movimientos de inventario atómicos.

insert into public.permissions (organization_id, code, description)
select organization.id, permission.code, permission.description
from public.organizations organization
cross join (values
  ('restaurant.manage', 'Administrar salón, mesas y estaciones'),
  ('menu.manage', 'Administrar categorías, platillos, bebidas y recetas'),
  ('inventory.manage', 'Administrar proveedores, productos e inventario')
) as permission(code, description)
on conflict (organization_id, code) do update set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.organization_id = role.organization_id
where role.code = 'administrator'
  and permission.code in ('restaurant.manage', 'menu.manage', 'inventory.manage')
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.organization_id = role.organization_id
where role.code = 'manager'
  and permission.code in ('restaurant.manage', 'menu.manage', 'inventory.manage')
on conflict do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'restaurant_sections', 'tables', 'preparation_stations'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''restaurant.manage'')) with check (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''restaurant.manage''))',
      table_name || '_write', table_name
    );
  end loop;

  foreach table_name in array array[
    'menu_categories', 'menu_items', 'modifier_groups', 'modifiers',
    'item_modifier_groups', 'recipes'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''menu.manage'')) with check (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''menu.manage''))',
      table_name || '_write', table_name
    );
  end loop;

  foreach table_name in array array['suppliers', 'ingredients', 'inventory_movements'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''inventory.manage'')) with check (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''inventory.manage''))',
      table_name || '_write', table_name
    );
  end loop;
end $$;

create or replace function public.record_inventory_movement(
  requested_ingredient_id uuid,
  requested_movement_type public.inventory_movement_type,
  requested_quantity numeric,
  requested_unit_cost_cents bigint default null,
  requested_reason text default null
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  selected_ingredient public.ingredients%rowtype;
  resulting_stock numeric;
  movement_id uuid;
begin
  if not public.has_permission('inventory.manage') then
    raise exception 'Permiso inventory.manage requerido';
  end if;
  if requested_quantity = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;

  select * into selected_ingredient
  from public.ingredients
  where id = requested_ingredient_id
    and organization_id = public.current_organization_id()
    and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  for update;

  if not found then raise exception 'Ingrediente no encontrado'; end if;
  resulting_stock := selected_ingredient.stock_quantity + requested_quantity;
  if resulting_stock < 0 then raise exception 'Existencia insuficiente'; end if;

  update public.ingredients
  set stock_quantity = resulting_stock,
      cost_cents = coalesce(requested_unit_cost_cents, cost_cents)
  where id = selected_ingredient.id;

  insert into public.inventory_movements (
    organization_id, branch_id, ingredient_id, movement_type, quantity,
    unit_cost_cents, reason, created_by
  ) values (
    selected_ingredient.organization_id, selected_ingredient.branch_id,
    selected_ingredient.id, requested_movement_type, requested_quantity,
    requested_unit_cost_cents, nullif(trim(requested_reason), ''), auth.uid()
  ) returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.record_inventory_movement(uuid, public.inventory_movement_type, numeric, bigint, text) from public;
grant execute on function public.record_inventory_movement(uuid, public.inventory_movement_type, numeric, bigint, text) to authenticated;

alter table public.branches
  add column if not exists logo_url text,
  add column if not exists brand_settings jsonb not null default '{"logo_scale":100,"logo_position":"center","accent":"#ef8354"}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images', 'menu-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy menu_images_public_read on storage.objects
for select to public using (bucket_id = 'menu-images');

create policy menu_images_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'menu-images'
  and public.has_permission('menu.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

create policy menu_images_admin_update on storage.objects
for update to authenticated using (
  bucket_id = 'menu-images'
  and public.has_permission('menu.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
) with check (
  bucket_id = 'menu-images'
  and public.has_permission('menu.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

create policy menu_images_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'menu-images'
  and public.has_permission('menu.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets', 'brand-assets', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy brand_assets_public_read on storage.objects
for select to public using (bucket_id = 'brand-assets');

create policy brand_assets_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'brand-assets'
  and public.has_permission('branches.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

create policy brand_assets_admin_update on storage.objects
for update to authenticated using (
  bucket_id = 'brand-assets'
  and public.has_permission('branches.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
) with check (
  bucket_id = 'brand-assets'
  and public.has_permission('branches.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

create policy brand_assets_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'brand-assets'
  and public.has_permission('branches.manage')
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

insert into public.permissions (organization_id, code, description)
select organization.id, permission.code, permission.description
from public.organizations organization
cross join (values
  ('analytics.read', 'Consultar métricas de venta y rentabilidad'),
  ('recommendations.manage', 'Configurar el asistente de venta inteligente')
) as permission(code, description)
on conflict (organization_id, code) do update set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.organization_id = role.organization_id
where role.code in ('administrator', 'manager')
  and permission.code in ('analytics.read', 'recommendations.manage')
on conflict do nothing;

create table public.sales_assistant_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null unique references public.branches(id),
  margin_weight numeric(5,2) not null default 45 check (margin_weight between 0 and 100),
  low_sales_weight numeric(5,2) not null default 35 check (low_sales_weight between 0 and 100),
  inventory_weight numeric(5,2) not null default 20 check (inventory_weight between 0 and 100),
  minimum_margin_basis_points integer not null default 3000 check (minimum_margin_basis_points between 0 and 10000),
  lookback_days integer not null default 30 check (lookback_days between 7 and 365),
  recommendation_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_sales_assistant_settings_updated_at
before update on public.sales_assistant_settings
for each row execute function public.set_updated_at();

alter table public.sales_assistant_settings enable row level security;
create policy sales_assistant_settings_read on public.sales_assistant_settings
for select to authenticated using (
  organization_id = public.current_organization_id()
  and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
);
create policy sales_assistant_settings_manage on public.sales_assistant_settings
for all to authenticated using (
  organization_id = public.current_organization_id()
  and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  and public.has_permission('recommendations.manage')
) with check (
  organization_id = public.current_organization_id()
  and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  and public.has_permission('recommendations.manage')
);

insert into public.sales_assistant_settings (organization_id, branch_id)
select organization_id, id from public.branches
on conflict (branch_id) do nothing;

create or replace function public.menu_performance(
  requested_start timestamptz,
  requested_end timestamptz
)
returns table (
  menu_item_id uuid,
  item_name text,
  category_name text,
  units_sold bigint,
  previous_units_sold bigint,
  revenue_cents bigint,
  estimated_cost_cents bigint,
  gross_margin_cents bigint,
  gross_margin_basis_points integer,
  sales_trend_percent numeric,
  recommendation_score numeric
)
language sql stable security invoker
set search_path = ''
as $$
  with recipe_cost as (
    select recipe.menu_item_id,
      coalesce(sum(recipe.quantity * ingredient.cost_cents), 0)::bigint unit_cost_cents
    from public.recipes recipe
    join public.ingredients ingredient on ingredient.id = recipe.ingredient_id
    group by recipe.menu_item_id
  ), current_sales as (
    select order_item.menu_item_id,
      sum(order_item.quantity)::bigint units,
      sum(order_item.subtotal_cents)::bigint revenue
    from public.order_items order_item
    join public.orders customer_order on customer_order.id = order_item.order_id
    where order_item.created_at >= requested_start
      and order_item.created_at < requested_end
      and order_item.status <> 'cancelled'
      and customer_order.status <> 'cancelled'
    group by order_item.menu_item_id
  ), previous_sales as (
    select order_item.menu_item_id, sum(order_item.quantity)::bigint units
    from public.order_items order_item
    join public.orders customer_order on customer_order.id = order_item.order_id
    where order_item.created_at >= requested_start - (requested_end - requested_start)
      and order_item.created_at < requested_start
      and order_item.status <> 'cancelled'
      and customer_order.status <> 'cancelled'
    group by order_item.menu_item_id
  ), base as (
    select item.id, item.name, category.name category_name,
      coalesce(current_sales.units, 0)::bigint units,
      coalesce(previous_sales.units, 0)::bigint previous_units,
      coalesce(current_sales.revenue, 0)::bigint revenue,
      (coalesce(current_sales.units, 0) * coalesce(recipe_cost.unit_cost_cents, 0))::bigint estimated_cost,
      item.price_cents,
      coalesce(settings.margin_weight, 45) margin_weight,
      coalesce(settings.low_sales_weight, 35) low_sales_weight,
      coalesce(settings.inventory_weight, 20) inventory_weight
    from public.menu_items item
    join public.menu_categories category on category.id = item.category_id
    left join current_sales on current_sales.menu_item_id = item.id
    left join previous_sales on previous_sales.menu_item_id = item.id
    left join recipe_cost on recipe_cost.menu_item_id = item.id
    left join public.sales_assistant_settings settings on settings.branch_id = item.branch_id
    where item.deleted_at is null and item.is_active and item.is_available
      and item.organization_id = public.current_organization_id()
      and (item.branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  ), normalized as (
    select base.*,
      max(units) over () max_units,
      case when price_cents > 0 then greatest(0, ((price_cents - coalesce(nullif(estimated_cost / nullif(units, 0), 0), 0))::numeric / price_cents) * 100) else 0 end margin_percent
    from base
  )
  select id, name, normalized.category_name, units, previous_units, revenue,
    estimated_cost, revenue - estimated_cost,
    case when revenue > 0 then round(((revenue - estimated_cost)::numeric / revenue) * 10000)::integer else 0 end,
    case when previous_units > 0 then round(((units - previous_units)::numeric / previous_units) * 100, 1) when units > 0 then 100 else 0 end,
    round(
      (least(100, margin_percent) * margin_weight / 100)
      + ((case when max_units > 0 then (1 - units::numeric / max_units) * 100 else 100 end) * low_sales_weight / 100)
      + (50 * inventory_weight / 100), 2
    )
  from normalized
  order by units desc, revenue desc, name;
$$;

grant execute on function public.menu_performance(timestamptz, timestamptz) to authenticated;
