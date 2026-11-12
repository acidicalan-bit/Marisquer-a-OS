-- Configura el salón de Barlovento con 16 mesas y repara estados antiguos
-- de limpieza que ya no tienen una cuenta activa.
do $$
declare
  target_branch_id uuid;
  target_organization_id uuid;
  target_section_id uuid;
  table_number integer;
  target_capacity integer;
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
    raise exception 'No existe una sucursal para configurar el salón.';
  end if;

  select section.id
    into target_section_id
  from public.restaurant_sections section
  where section.branch_id = target_branch_id
    and section.deleted_at is null
  order by section.sort_order, section.created_at
  limit 1;

  for table_number in 1..16 loop
    target_capacity := case when table_number <= 7 then 6 else 4 end;

    insert into public.tables (
      organization_id, branch_id, section_id, name, capacity, status, sort_order
    ) values (
      target_organization_id,
      target_branch_id,
      target_section_id,
      format('Mesa %s', table_number),
      target_capacity,
      'free',
      table_number
    )
    on conflict (branch_id, name) do update
      set organization_id = excluded.organization_id,
          section_id = coalesce(public.tables.section_id, excluded.section_id),
          capacity = excluded.capacity,
          sort_order = excluded.sort_order,
          deleted_at = null,
          updated_at = now();
  end loop;

  update public.tables restaurant_table
     set status = 'free',
         version = restaurant_table.version + 1,
         updated_at = now()
   where restaurant_table.branch_id = target_branch_id
     and restaurant_table.status = 'needs_cleaning'
     and not exists (
       select 1
       from public.table_sessions session
       where session.table_id = restaurant_table.id
         and session.status in ('open', 'check_requested', 'paying')
     );
end $$;
