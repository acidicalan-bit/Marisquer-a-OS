-- Cola durable para APK offline-first. Las mutaciones se aplican una sola vez.

create table public.offline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  device_session_id uuid not null references public.device_sessions(id),
  user_id uuid not null references public.user_profiles(id),
  client_event_id uuid not null,
  event_type text not null check (
    event_type in (
      'order.submitted',
      'table.status_changed',
      'kitchen.item_status_changed'
    )
  ),
  entity_id uuid not null,
  base_version integer,
  payload jsonb not null,
  occurred_at timestamptz not null,
  status text not null default 'received' check (
    status in ('received', 'applied', 'conflict', 'rejected')
  ),
  result jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (device_session_id, client_event_id)
);

create table public.offline_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  offline_event_id uuid not null references public.offline_events(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  client_version integer,
  server_version integer,
  client_value jsonb not null,
  server_value jsonb not null,
  resolution text not null default 'server_wins' check (
    resolution in ('server_wins', 'client_wins', 'manual')
  ),
  resolved_by uuid references public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offline_event_id)
);

create index offline_events_user_status_idx
on public.offline_events(user_id, status, created_at desc);

create index offline_conflicts_unresolved_idx
on public.offline_conflicts(branch_id, created_at desc)
where resolved_at is null;

alter table public.offline_events enable row level security;
alter table public.offline_conflicts enable row level security;

create policy offline_events_own_read
on public.offline_events for select to authenticated
using (
  user_id = auth.uid()
  and organization_id = public.current_organization_id()
  and branch_id = public.current_branch_id()
);

create policy offline_conflicts_scoped_read
on public.offline_conflicts for select to authenticated
using (
  organization_id = public.current_organization_id()
  and branch_id = public.current_branch_id()
  and (
    public.has_permission('audit.read')
    or exists (
      select 1
      from public.offline_events event
      where event.id = offline_event_id
        and event.user_id = auth.uid()
    )
  )
);

create or replace function public.apply_offline_events(
  requested_device_id uuid,
  requested_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_record public.user_profiles%rowtype;
  role_code text;
  registered_user_id uuid;
  requested_event jsonb;
  event_id uuid;
  event_type text;
  entity_id uuid;
  base_version integer;
  event_payload jsonb;
  event_occurred_at timestamptz;
  stored_event public.offline_events%rowtype;
  event_result jsonb;
  results jsonb := '[]'::jsonb;
  current_value jsonb;
  current_version integer;
  requested_status text;
  table_record public.tables%rowtype;
  table_session_id uuid;
  submitted_order_id uuid;
  order_item jsonb;
  order_item_id uuid;
  menu_record public.menu_items%rowtype;
  quantity integer;
  line_subtotal bigint;
  line_tax bigint;
  order_subtotal bigint;
  order_tax bigint;
  order_total bigint;
begin
  if jsonb_typeof(requested_events) <> 'array'
    or jsonb_array_length(requested_events) < 1
    or jsonb_array_length(requested_events) > 100
  then
    raise exception 'El lote offline debe contener entre 1 y 100 eventos.';
  end if;

  select * into profile_record
  from public.user_profiles
  where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then
    raise exception 'Perfil activo con sucursal requerido.';
  end if;
  if not public.has_permission('data.write') then
    raise exception 'No tienes permiso para sincronizar operaciones.';
  end if;

  select role.code into role_code
  from public.roles role
  where role.id = profile_record.role_id
    and role.organization_id = profile_record.organization_id;

  select device.user_id into registered_user_id
  from public.device_sessions device
  where device.id = requested_device_id;
  if found and registered_user_id <> profile_record.id then
    raise exception 'Este dispositivo pertenece a otro usuario.';
  end if;

  insert into public.device_sessions (
    id, organization_id, branch_id, user_id, device_name, last_active_at
  ) values (
    requested_device_id, profile_record.organization_id,
    profile_record.branch_id, profile_record.id, 'APK offline-first', now()
  )
  on conflict (id) do update
  set last_active_at = now(), branch_id = excluded.branch_id;

  for requested_event in select value from jsonb_array_elements(requested_events)
  loop
    event_id := (requested_event->>'id')::uuid;
    event_type := requested_event->>'type';
    entity_id := (requested_event->>'entity_id')::uuid;
    base_version := nullif(requested_event->>'base_version', '')::integer;
    event_payload := coalesce(requested_event->'payload', '{}'::jsonb);
    event_occurred_at := (requested_event->>'occurred_at')::timestamptz;

    select * into stored_event
    from public.offline_events event
    where event.device_session_id = requested_device_id
      and event.client_event_id = event_id;
    if found then
      results := results || jsonb_build_array(stored_event.result);
      continue;
    end if;

    insert into public.offline_events (
      organization_id, branch_id, device_session_id, user_id,
      client_event_id, event_type, entity_id, base_version, payload, occurred_at
    ) values (
      profile_record.organization_id, profile_record.branch_id,
      requested_device_id, profile_record.id, event_id, event_type,
      entity_id, base_version, event_payload, event_occurred_at
    )
    returning * into stored_event;

    begin
      if event_type = 'table.status_changed' then
        if role_code not in ('administrator', 'manager', 'captain', 'host') then
          raise exception 'El rol no puede modificar mesas offline.';
        end if;
        if base_version is null then
          raise exception 'La versión base de la mesa es obligatoria.';
        end if;
        requested_status := event_payload->>'status';
        if requested_status not in (
          'free', 'reserved', 'occupied', 'check_requested',
          'paying', 'needs_cleaning', 'blocked'
        ) then
          raise exception 'Estado de mesa inválido.';
        end if;

        update public.tables
        set status = requested_status::public.table_status,
            version = version + 1,
            updated_at = now()
        where id = entity_id
          and organization_id = profile_record.organization_id
          and branch_id = profile_record.branch_id
          and version = base_version
          and deleted_at is null
        returning version into current_version;

        if current_version is null then
          select jsonb_build_object(
            'status', current.status, 'version', current.version
          ), current.version
          into current_value, current_version
          from public.tables current
          where current.id = entity_id
            and current.branch_id = profile_record.branch_id;
          if current_value is null then
            raise exception 'Mesa inexistente.';
          end if;
          insert into public.offline_conflicts (
            organization_id, branch_id, offline_event_id, entity_type,
            entity_id, client_version, server_version, client_value, server_value
          ) values (
            profile_record.organization_id, profile_record.branch_id,
            stored_event.id, 'table', entity_id, base_version, current_version,
            event_payload, current_value
          );
          event_result := jsonb_build_object(
            'eventId', event_id, 'status', 'conflict',
            'detail', jsonb_build_object('server', current_value)
          );
        else
          event_result := jsonb_build_object(
            'eventId', event_id, 'status', 'applied',
            'detail', jsonb_build_object('version', current_version)
          );
        end if;

      elsif event_type = 'kitchen.item_status_changed' then
        if role_code not in (
          'administrator', 'manager', 'cold_kitchen', 'hot_kitchen',
          'bar', 'runner'
        ) then
          raise exception 'El rol no puede modificar cocina offline.';
        end if;
        if base_version is null then
          raise exception 'La versión base de la partida es obligatoria.';
        end if;
        requested_status := event_payload->>'status';
        if requested_status not in ('received', 'preparing', 'ready', 'delivered') then
          raise exception 'Estado de cocina inválido.';
        end if;

        update public.order_items
        set status = requested_status::public.order_item_status,
            started_at = case when requested_status = 'preparing'
              then coalesce(started_at, now()) else started_at end,
            ready_at = case when requested_status = 'ready'
              then coalesce(ready_at, now()) else ready_at end,
            delivered_at = case when requested_status = 'delivered'
              then coalesce(delivered_at, now()) else delivered_at end,
            version = version + 1,
            updated_at = now()
        where id = entity_id
          and organization_id = profile_record.organization_id
          and branch_id = profile_record.branch_id
          and version = base_version
          and (
            (status = 'received' and requested_status in ('preparing', 'ready'))
            or (status = 'preparing' and requested_status = 'ready')
            or (status = 'ready' and requested_status = 'delivered')
          )
        returning version into current_version;

        if current_version is null then
          select jsonb_build_object(
            'status', current.status, 'version', current.version
          ), current.version
          into current_value, current_version
          from public.order_items current
          where current.id = entity_id
            and current.branch_id = profile_record.branch_id;
          if current_value is null then
            raise exception 'Partida de cocina inexistente.';
          end if;
          insert into public.offline_conflicts (
            organization_id, branch_id, offline_event_id, entity_type,
            entity_id, client_version, server_version, client_value, server_value
          ) values (
            profile_record.organization_id, profile_record.branch_id,
            stored_event.id, 'order_item', entity_id, base_version,
            current_version, event_payload, current_value
          );
          event_result := jsonb_build_object(
            'eventId', event_id, 'status', 'conflict',
            'detail', jsonb_build_object('server', current_value)
          );
        else
          event_result := jsonb_build_object(
            'eventId', event_id, 'status', 'applied',
            'detail', jsonb_build_object('version', current_version)
          );
        end if;

      elsif event_type = 'order.submitted' then
        if role_code not in ('administrator', 'manager', 'captain', 'waiter') then
          raise exception 'El rol no puede capturar pedidos offline.';
        end if;
        if jsonb_typeof(event_payload->'items') <> 'array'
          or jsonb_array_length(event_payload->'items') < 1
          or jsonb_array_length(event_payload->'items') > 100
        then
          raise exception 'El pedido debe contener entre 1 y 100 partidas.';
        end if;

        select * into table_record
        from public.tables requested_table
        where requested_table.id = (event_payload->>'table_id')::uuid
          and requested_table.organization_id = profile_record.organization_id
          and requested_table.branch_id = profile_record.branch_id
          and requested_table.deleted_at is null
        for update;
        if not found then raise exception 'Mesa inexistente.'; end if;

        select session.id into table_session_id
        from public.table_sessions session
        where session.table_id = table_record.id
          and session.status in ('open', 'check_requested', 'paying')
        for update;
        if table_session_id is null then
          insert into public.table_sessions (
            organization_id, branch_id, table_id, waiter_id,
            guest_count, status, notes
          ) values (
            profile_record.organization_id, profile_record.branch_id,
            table_record.id, profile_record.id,
            greatest(1, least(50, coalesce((event_payload->>'guest_count')::integer, 1))),
            'open', nullif(event_payload->>'notes', '')
          )
          on conflict do nothing
          returning id into table_session_id;
          if table_session_id is null then
            select session.id into table_session_id
            from public.table_sessions session
            where session.table_id = table_record.id
              and session.status in ('open', 'check_requested', 'paying')
            for update;
          end if;
        end if;

        submitted_order_id := entity_id;
        insert into public.orders (
          id, organization_id, branch_id, table_session_id, waiter_id,
          status, notes, submitted_at
        ) values (
          submitted_order_id, profile_record.organization_id, profile_record.branch_id,
          table_session_id, profile_record.id, 'submitted',
          nullif(event_payload->>'notes', ''), now()
        );

        order_subtotal := 0;
        order_tax := 0;
        order_total := 0;
        for order_item in select value from jsonb_array_elements(event_payload->'items')
        loop
          order_item_id := (order_item->>'id')::uuid;
          quantity := (order_item->>'quantity')::integer;
          if quantity < 1 or quantity > 50 then
            raise exception 'Cantidad inválida.';
          end if;
          select * into menu_record
          from public.menu_items menu_item
          where menu_item.id = (order_item->>'menu_item_id')::uuid
            and menu_item.organization_id = profile_record.organization_id
            and menu_item.branch_id = profile_record.branch_id
            and menu_item.is_active and menu_item.is_available
            and menu_item.deleted_at is null;
          if not found then raise exception 'Producto no disponible.'; end if;

          line_subtotal := menu_record.price_cents * quantity;
          line_tax := (
            line_subtotal * menu_record.tax_rate_basis_points + 5000
          ) / 10000;
          insert into public.order_items (
            id, organization_id, branch_id, order_id, menu_item_id,
            station_id, quantity, unit_price_cents, subtotal_cents,
            tax_cents, total_cents, status, notes, allergy_alert
          ) values (
            order_item_id, profile_record.organization_id,
            profile_record.branch_id, submitted_order_id, menu_record.id,
            menu_record.station_id, quantity, menu_record.price_cents,
            line_subtotal, line_tax, line_subtotal + line_tax, 'received',
            nullif(order_item->>'notes', ''),
            nullif(order_item->>'allergy_alert', '')
          );
          order_subtotal := order_subtotal + line_subtotal;
          order_tax := order_tax + line_tax;
          order_total := order_total + line_subtotal + line_tax;
        end loop;

        update public.orders
        set subtotal_cents = order_subtotal,
            tax_cents = order_tax,
            total_cents = order_total,
            updated_at = now()
        where public.orders.id = entity_id;
        update public.tables
        set status = 'occupied', version = version + 1, updated_at = now()
        where id = table_record.id;
        insert into public.kitchen_tickets (
          organization_id, branch_id, order_id, station_id, status
        )
        select distinct
          profile_record.organization_id, profile_record.branch_id,
          entity_id, item.station_id, 'open'
        from public.order_items item
        where item.order_id = entity_id
        on conflict (order_id, station_id) do nothing;
        insert into public.outbox_events (
          organization_id, branch_id, aggregate_type, aggregate_id,
          event_type, payload
        ) values (
          profile_record.organization_id, profile_record.branch_id,
          'order', submitted_order_id, 'order.submitted.offline',
          jsonb_build_object('device_id', requested_device_id, 'total_cents', order_total)
        );
        event_result := jsonb_build_object(
          'eventId', event_id, 'status', 'applied',
          'detail', jsonb_build_object('orderId', submitted_order_id, 'totalCents', order_total)
        );
      else
        raise exception 'Tipo de evento offline no permitido.';
      end if;

    exception when others then
      event_result := jsonb_build_object(
        'eventId', event_id, 'status', 'rejected',
        'detail', jsonb_build_object('message', 'Evento rechazado de forma segura.')
      );
    end;

    update public.offline_events
    set status = event_result->>'status',
        result = event_result,
        processed_at = now()
    where id = stored_event.id;
    results := results || jsonb_build_array(event_result);
  end loop;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action,
    entity_type, new_value, device_session_id
  ) values (
    profile_record.organization_id, profile_record.branch_id,
    profile_record.id, profile_record.role_id, 'offline.sync',
    'device_session', jsonb_build_object(
      'event_count', jsonb_array_length(requested_events),
      'result_count', jsonb_array_length(results)
    ), requested_device_id
  );
  return results;
end;
$$;

revoke all on function public.apply_offline_events(uuid, jsonb) from public;
grant execute on function public.apply_offline_events(uuid, jsonb) to authenticated;
grant select on public.offline_events, public.offline_conflicts to authenticated;

