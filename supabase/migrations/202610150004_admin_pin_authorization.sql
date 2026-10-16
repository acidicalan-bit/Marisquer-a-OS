-- Autorizaciones sensibles: el PIN sólo se almacena como hash y se valida en
-- SECURITY DEFINER. Nunca se entrega el hash al cliente ni se usa como password.

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
  values (target.organization_id, target.branch_id, target.id, crypt(candidate_pin, gen_salt('bf')), now())
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

-- Los wrappers exigen NIP antes de llamar a los RPC históricos. El RPC de cinco
-- argumentos se revoca para que no exista una ruta de cobro sin autorización.
create or replace function public.complete_waiter_table_sale(
  requested_table_session_id uuid,
  requested_method public.payment_method,
  requested_received_cents bigint,
  requested_tip_cents bigint,
  requested_idempotency_key text,
  requested_admin_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare profile_record public.user_profiles%rowtype; result uuid;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then raise exception 'Perfil activo con sucursal requerido.'; end if;
  if not public.verify_admin_approval_pin(profile_record.branch_id, requested_admin_pin) then
    raise exception 'NIP de Administración incorrecto o temporalmente bloqueado.';
  end if;
  select public.complete_waiter_table_sale(
    requested_table_session_id, requested_method, requested_received_cents,
    requested_tip_cents, requested_idempotency_key
  ) into result;
  return result;
end;
$$;

create or replace function public.complete_table_sale(
  requested_table_session_id uuid,
  requested_cash_register_id uuid,
  requested_method public.payment_method,
  requested_received_cents bigint,
  requested_tip_cents bigint,
  requested_idempotency_key text,
  requested_admin_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare profile_record public.user_profiles%rowtype; result uuid;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then raise exception 'Perfil activo con sucursal requerido.'; end if;
  if not public.verify_admin_approval_pin(profile_record.branch_id, requested_admin_pin) then
    raise exception 'NIP de Administración incorrecto o temporalmente bloqueado.';
  end if;
  select public.complete_table_sale(
    requested_table_session_id, requested_cash_register_id, requested_method,
    requested_received_cents, requested_tip_cents, requested_idempotency_key
  ) into result;
  return result;
end;
$$;

create or replace function public.cancel_order_item_with_admin_pin(
  requested_order_item_id uuid,
  requested_reason text,
  requested_admin_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_profiles%rowtype;
  item public.order_items%rowtype;
  order_record public.orders%rowtype;
  table_name text;
begin
  select * into actor from public.user_profiles where id = auth.uid() and is_active;
  if not found or actor.branch_id is null then raise exception 'Perfil activo con sucursal requerido.'; end if;
  if not public.verify_admin_approval_pin(actor.branch_id, requested_admin_pin) then
    raise exception 'NIP de Administración incorrecto o temporalmente bloqueado.';
  end if;
  if char_length(trim(coalesce(requested_reason, ''))) < 3 then raise exception 'Indica el motivo de cancelación.'; end if;
  select * into item from public.order_items where id = requested_order_item_id
    and organization_id = actor.organization_id and branch_id = actor.branch_id for update;
  if not found or item.status = 'cancelled' then raise exception 'La partida ya no está disponible para cancelar.'; end if;
  select * into order_record from public.orders where id = item.order_id for update;
  if not found or order_record.status in ('closed', 'cancelled') then raise exception 'La cuenta ya está cerrada.'; end if;
  select restaurant_table.name into table_name
  from public.table_sessions session join public.tables restaurant_table on restaurant_table.id = session.table_id
  where session.id = order_record.table_session_id;

  update public.order_items set status = 'cancelled', cancelled_at = now(), cancellation_reason = left(trim(requested_reason), 240), version = version + 1, updated_at = now()
  where id = item.id;
  insert into public.audit_logs (organization_id, branch_id, user_id, role_id, action, entity_type, entity_id, new_value)
  values (actor.organization_id, actor.branch_id, actor.id, actor.role_id, 'order_item.cancelled_with_admin_pin', 'order_item', item.id,
    jsonb_build_object('reason', left(trim(requested_reason), 240), 'order_id', item.order_id));
  insert into public.outbox_events (organization_id, branch_id, aggregate_type, aggregate_id, event_type, payload)
  values (actor.organization_id, actor.branch_id, 'order_item', item.id, 'order_item.cancelled', jsonb_build_object('reason', left(trim(requested_reason), 240)));
  insert into public.print_jobs (organization_id, branch_id, station_id, document_type, routing_key, idempotency_key, payload)
  values (actor.organization_id, actor.branch_id, item.station_id, 'cancellation',
    case when (select station_type from public.preparation_stations where id = item.station_id) = 'hot_kitchen' then 'hot_kitchen' else 'cold_kitchen' end,
    'cancellation:' || item.id || ':' || item.version,
    jsonb_build_object('title', 'CANCELACIÓN', 'tableName', coalesce(table_name, 'SIN MESA'), 'reason', left(trim(requested_reason), 240), 'orderItemId', item.id));
  return true;
end;
$$;

revoke all on function public.set_admin_security_pin(uuid, text) from public;
revoke all on function public.verify_admin_approval_pin(uuid, text) from public;
revoke all on function public.complete_waiter_table_sale(uuid, public.payment_method, bigint, bigint, text) from public, authenticated;
revoke all on function public.complete_table_sale(uuid, uuid, public.payment_method, bigint, bigint, text) from public, authenticated;
revoke all on function public.complete_waiter_table_sale(uuid, public.payment_method, bigint, bigint, text, text) from public;
revoke all on function public.complete_table_sale(uuid, uuid, public.payment_method, bigint, bigint, text, text) from public;
revoke all on function public.cancel_order_item_with_admin_pin(uuid, text, text) from public;
grant execute on function public.set_admin_security_pin(uuid, text) to authenticated;
grant execute on function public.verify_admin_approval_pin(uuid, text) to authenticated;
grant execute on function public.complete_waiter_table_sale(uuid, public.payment_method, bigint, bigint, text, text) to authenticated;
grant execute on function public.complete_table_sale(uuid, uuid, public.payment_method, bigint, bigint, text, text) to authenticated;
grant execute on function public.cancel_order_item_with_admin_pin(uuid, text, text) to authenticated;
