-- Agrega los platillos solicitados. La mojarra conserva su precio actual para
-- no afectar ventas; su ficha queda marcada como precio ajustable. El filete
-- se crea deshabilitado hasta que Administración capture su precio real.
do $$
declare
  target_branch_id uuid;
  target_organization_id uuid;
  target_category_id uuid;
  target_station_id uuid;
  mojarra_id uuid;
begin
  select branch.id, branch.organization_id
    into target_branch_id, target_organization_id
  from public.branches branch
  where lower(branch.name) = 'barlovento'
  order by branch.created_at
  limit 1;

  if target_branch_id is null then
    select branch.id, branch.organization_id
      into target_branch_id, target_organization_id
    from public.branches branch
    order by branch.created_at
    limit 1;
  end if;

  if target_branch_id is null then
    raise exception 'No existe una sucursal para agregar platillos.';
  end if;

  select category.id into target_category_id
  from public.menu_categories category
  where category.branch_id = target_branch_id
    and category.deleted_at is null
  order by category.sort_order, category.created_at
  limit 1;

  select station.id into target_station_id
  from public.preparation_stations station
  where station.branch_id = target_branch_id
    and station.is_active
  order by station.created_at
  limit 1;

  if target_category_id is null or target_station_id is null then
    raise exception 'La sucursal no tiene categoría o estación de preparación activa.';
  end if;

  select item.id into mojarra_id
  from public.menu_items item
  where item.branch_id = target_branch_id
    and item.name ilike '%mojarra%'
    and item.deleted_at is null
  order by item.created_at
  limit 1;

  if mojarra_id is not null then
    update public.menu_items
       set description = case
         when coalesce(description, '') ilike '%precio ajustable%' then description
         when coalesce(description, '') = '' then 'Precio ajustable.'
         else description || ' · Precio ajustable.'
       end,
       updated_at = now()
     where id = mojarra_id;
  end if;

  insert into public.menu_items (
    organization_id, branch_id, category_id, station_id, name,
    description, price_cents, tax_rate_basis_points, expected_minutes,
    is_available, is_active
  ) values (
    target_organization_id, target_branch_id, target_category_id,
    target_station_id, 'Filete empapelado',
    'Precio ajustable. Define el precio en Administración → Menú antes de habilitarlo.',
    0, 1600, 20, false, true
  )
  on conflict do nothing;
end $$;
