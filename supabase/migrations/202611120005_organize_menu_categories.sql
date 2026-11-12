-- Ordena la carta operativa y concentra los productos en las siete categorías
-- que utiliza el restaurante. Las categorías siguen siendo editables desde
-- Administración → Menú → Categorías.
do $$
declare
  target_branch_id uuid;
  target_organization_id uuid;
  entradas_id uuid;
  aguachiles_id uuid;
  bebidas_id uuid;
  fuertes_id uuid;
  especialidades_id uuid;
  caldos_id uuid;
  barra_fria_id uuid;
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
    raise exception 'No existe una sucursal para ordenar la carta.';
  end if;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Entradas', 1, true)
  on conflict (branch_id, name) do update set sort_order = 1, is_active = true, updated_at = now()
  returning id into entradas_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Aguachiles y molcajetes', 2, true)
  on conflict (branch_id, name) do update set sort_order = 2, is_active = true, updated_at = now()
  returning id into aguachiles_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Bebidas', 3, true)
  on conflict (branch_id, name) do update set sort_order = 3, is_active = true, updated_at = now()
  returning id into bebidas_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Platos fuertes', 4, true)
  on conflict (branch_id, name) do update set sort_order = 4, is_active = true, updated_at = now()
  returning id into fuertes_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Especialidades', 5, true)
  on conflict (branch_id, name) do update set sort_order = 5, is_active = true, updated_at = now()
  returning id into especialidades_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Caldos', 6, true)
  on conflict (branch_id, name) do update set sort_order = 6, is_active = true, updated_at = now()
  returning id into caldos_id;

  insert into public.menu_categories (organization_id, branch_id, name, sort_order, is_active)
  values (target_organization_id, target_branch_id, 'Barra fría', 7, true)
  on conflict (branch_id, name) do update set sort_order = 7, is_active = true, updated_at = now()
  returning id into barra_fria_id;

  update public.menu_items item
     set category_id = entradas_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Empanada %' or item.name ilike 'Quesadilla %' or item.name ilike 'Taco %' or item.name ilike 'Filetito%');

  update public.menu_items item
     set category_id = aguachiles_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Aguachile %' or item.name ilike 'Molcajete %' or item.name ilike 'Ceviche %');

  update public.menu_items item
     set category_id = bebidas_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Agua %' or item.name ilike 'Cerveza%' or item.name ilike 'Limonada%'
       or item.name ilike 'Naranjada%' or item.name ilike 'Margarita%' or item.name ilike 'Michelada%'
       or item.name ilike 'Piña colada%' or item.name ilike 'Refresco%' or item.name ilike 'Sangría%'
       or item.name ilike 'Tehuacán%');

  update public.menu_items item
     set category_id = caldos_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Caldo %' or item.name ilike 'Sopa de mariscos%');

  update public.menu_items item
     set category_id = barra_fria_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Cóctel %' or item.name ilike 'Ostiones %' or item.name ilike 'Pata de mula%'
       or item.name ilike 'Tostada %' or item.name ilike 'Vuelve a la vida'
       or item.name ilike 'Almeja %');

  update public.menu_items item
     set category_id = fuertes_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Arroz %' or item.name ilike 'Pescado %' or item.name ilike 'Pulpo %'
       or item.name ilike 'Taco gobernador%' or item.name ilike 'Taco de pescado%'
       or item.name ilike 'Filete %' or item.name ilike 'Mojarra%');

  update public.menu_items item
     set category_id = especialidades_id, updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Camarones %' or item.name ilike 'Salmón %');

  update public.menu_categories category
     set is_active = false, updated_at = now()
   where category.branch_id = target_branch_id
     and category.id not in (
       entradas_id, aguachiles_id, bebidas_id, fuertes_id,
       especialidades_id, caldos_id, barra_fria_id
     );

  update public.menu_items item
     set description = case
       when coalesce(item.description, '') ilike '%precio ajustable%' then item.description
       when coalesce(item.description, '') = '' then 'Precio ajustable.'
       else item.description || ' · Precio ajustable.'
     end,
     is_available = false,
     updated_at = now()
   where item.branch_id = target_branch_id
     and item.deleted_at is null
     and (item.name ilike 'Mojarra%' or item.name ilike 'Filete empapelado%');
end $$;
