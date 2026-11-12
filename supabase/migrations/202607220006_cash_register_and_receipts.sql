-- Caja transaccional, cobro completo de mesa y ticket de venta.

insert into public.permissions (organization_id, code, description)
select organization.id, 'cash.manage', 'Abrir, operar y cerrar caja; cobrar cuentas'
from public.organizations organization
on conflict (organization_id, code) do update
set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission
  on permission.organization_id = role.organization_id
 and permission.code = 'cash.manage'
where role.code in ('administrator', 'manager', 'cashier')
on conflict do nothing;

create unique index if not exists one_open_cash_register_per_branch
on public.cash_registers(branch_id) where status = 'open';

create unique index if not exists one_receipt_per_table_session
on public.receipts(table_session_id);

create sequence if not exists public.receipt_folio_sequence;

create or replace function public.open_cash_register(
  requested_opening_amount_cents bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_record public.user_profiles%rowtype;
  shift_record public.shifts%rowtype;
  register_id uuid;
begin
  if requested_opening_amount_cents < 0 then
    raise exception 'El fondo inicial no puede ser negativo.';
  end if;
  if not public.has_permission('cash.manage') then
    raise exception 'No tienes permiso para operar caja.';
  end if;

  select * into profile_record
  from public.user_profiles
  where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then
    raise exception 'El usuario no tiene una sucursal activa.';
  end if;

  select * into shift_record
  from public.shifts
  where branch_id = profile_record.branch_id and status = 'open'
  for update;
  if not found then
    raise exception 'Primero un administrador debe abrir el turno.';
  end if;

  insert into public.cash_registers (
    organization_id, branch_id, shift_id, cashier_id, opening_amount_cents
  ) values (
    profile_record.organization_id, profile_record.branch_id, shift_record.id,
    profile_record.id, requested_opening_amount_cents
  ) returning id into register_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action, entity_type,
    entity_id, new_value
  ) values (
    profile_record.organization_id, profile_record.branch_id, profile_record.id,
    profile_record.role_id, 'cash_register.opened', 'cash_register', register_id,
    jsonb_build_object('opening_amount_cents', requested_opening_amount_cents)
  );

  return register_id;
end;
$$;

create or replace function public.complete_table_sale(
  requested_table_session_id uuid,
  requested_cash_register_id uuid,
  requested_method public.payment_method,
  requested_received_cents bigint,
  requested_tip_cents bigint,
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_record public.user_profiles%rowtype;
  session_record public.table_sessions%rowtype;
  register_record public.cash_registers%rowtype;
  existing_receipt_id uuid;
  payment_id uuid;
  receipt_id uuid;
  sale_subtotal bigint;
  sale_tax bigint;
  sale_total bigint;
  discount_total bigint;
  paid_total bigint;
  due_total bigint;
  change_total bigint;
  line_items jsonb;
  receipt_folio text;
begin
  if not public.has_permission('cash.manage') then
    raise exception 'No tienes permiso para cobrar cuentas.';
  end if;
  if requested_tip_cents < 0 or requested_received_cents < 0 then
    raise exception 'Los importes no pueden ser negativos.';
  end if;
  if requested_idempotency_key is null or length(requested_idempotency_key) < 16 then
    raise exception 'La clave de operación no es válida.';
  end if;

  select * into profile_record
  from public.user_profiles
  where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then
    raise exception 'El usuario no tiene una sucursal activa.';
  end if;

  select receipt.id into existing_receipt_id
  from public.payments payment
  join public.receipts receipt
    on receipt.table_session_id = payment.table_session_id
  where payment.organization_id = profile_record.organization_id
    and payment.idempotency_key = requested_idempotency_key;
  if existing_receipt_id is not null then return existing_receipt_id; end if;

  select * into session_record
  from public.table_sessions
  where id = requested_table_session_id
    and organization_id = profile_record.organization_id
    and branch_id = profile_record.branch_id
  for update;
  if not found or session_record.status in ('closed', 'cancelled') then
    raise exception 'La cuenta ya no está disponible para cobro.';
  end if;

  select id into existing_receipt_id
  from public.receipts
  where table_session_id = session_record.id;
  if existing_receipt_id is not null then return existing_receipt_id; end if;

  select * into register_record
  from public.cash_registers
  where id = requested_cash_register_id
    and branch_id = profile_record.branch_id
    and status = 'open'
  for update;
  if not found then raise exception 'La caja no está abierta.'; end if;

  select
    coalesce(sum(customer_order.subtotal_cents), 0),
    coalesce(sum(customer_order.tax_cents), 0),
    coalesce(sum(customer_order.total_cents), 0)
  into sale_subtotal, sale_tax, sale_total
  from public.orders customer_order
  where customer_order.table_session_id = session_record.id
    and customer_order.status <> 'cancelled';

  select coalesce(sum(discount.amount_cents), 0) into discount_total
  from public.discounts discount
  where discount.table_session_id = session_record.id
    and discount.authorized_by is not null;

  select coalesce(sum(payment.amount_cents), 0) into paid_total
  from public.payments payment
  where payment.table_session_id = session_record.id
    and payment.status = 'completed';

  due_total := greatest(sale_total - discount_total - paid_total, 0);
  if due_total <= 0 then raise exception 'La cuenta no tiene saldo pendiente.'; end if;
  if requested_received_cents < due_total + requested_tip_cents then
    raise exception 'El importe recibido no cubre cuenta y propina.';
  end if;
  if requested_method <> 'cash'
     and requested_received_cents <> due_total + requested_tip_cents then
    raise exception 'En pagos no efectivos el importe debe ser exacto.';
  end if;
  change_total := requested_received_cents - due_total - requested_tip_cents;

  insert into public.payments (
    organization_id, branch_id, table_session_id, cash_register_id, method,
    amount_cents, status, idempotency_key, received_by, paid_at
  ) values (
    profile_record.organization_id, profile_record.branch_id, session_record.id,
    register_record.id, requested_method, due_total, 'completed',
    requested_idempotency_key, profile_record.id, now()
  ) returning id into payment_id;

  if requested_tip_cents > 0 then
    insert into public.tips (
      organization_id, branch_id, payment_id, amount_cents
    ) values (
      profile_record.organization_id, profile_record.branch_id, payment_id,
      requested_tip_cents
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', menu_item.name,
    'quantity', order_item.quantity,
    'unit_price_cents', order_item.unit_price_cents,
    'total_cents', order_item.total_cents
  ) order by order_item.created_at), '[]'::jsonb)
  into line_items
  from public.order_items order_item
  join public.orders customer_order on customer_order.id = order_item.order_id
  join public.menu_items menu_item on menu_item.id = order_item.menu_item_id
  where customer_order.table_session_id = session_record.id
    and customer_order.status <> 'cancelled'
    and order_item.status <> 'cancelled';

  receipt_folio := 'V-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.receipt_folio_sequence')::text, 8, '0');

  insert into public.receipts (
    organization_id, branch_id, table_session_id, folio, subtotal_cents,
    tax_cents, discount_cents, tip_cents, total_cents, payload
  ) values (
    profile_record.organization_id, profile_record.branch_id, session_record.id,
    receipt_folio, sale_subtotal, sale_tax, discount_total,
    requested_tip_cents, sale_total - discount_total + requested_tip_cents,
    jsonb_build_object(
      'items', line_items,
      'payment_method', requested_method,
      'payment_cents', due_total,
      'received_cents', requested_received_cents,
      'change_cents', change_total,
      'cashier_id', profile_record.id
    )
  ) returning id into receipt_id;

  update public.orders
  set status = 'closed', closed_at = now(), version = version + 1
  where table_session_id = session_record.id and status <> 'cancelled';
  update public.table_sessions
  set status = 'closed', closed_at = now(), version = version + 1
  where id = session_record.id;
  update public.tables set status = 'needs_cleaning'
  where id = session_record.table_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action, entity_type,
    entity_id, new_value
  ) values (
    profile_record.organization_id, profile_record.branch_id, profile_record.id,
    profile_record.role_id, 'sale.completed', 'receipt', receipt_id,
    jsonb_build_object(
      'payment_id', payment_id, 'method', requested_method,
      'payment_cents', due_total, 'tip_cents', requested_tip_cents,
      'change_cents', change_total
    )
  );
  insert into public.outbox_events (
    organization_id, branch_id, aggregate_type, aggregate_id, event_type, payload
  ) values (
    profile_record.organization_id, profile_record.branch_id, 'receipt',
    receipt_id, 'sale.completed', jsonb_build_object('receipt_id', receipt_id)
  );

  return receipt_id;
end;
$$;

create or replace function public.close_cash_register(
  requested_cash_register_id uuid,
  requested_counted_amount_cents bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_record public.user_profiles%rowtype;
  register_record public.cash_registers%rowtype;
  cash_payments bigint;
  cash_movements bigint;
  expected_total bigint;
begin
  if requested_counted_amount_cents < 0 then
    raise exception 'El efectivo contado no puede ser negativo.';
  end if;
  if not public.has_permission('cash.manage') then
    raise exception 'No tienes permiso para cerrar caja.';
  end if;
  select * into profile_record from public.user_profiles
  where id = auth.uid() and is_active;
  select * into register_record from public.cash_registers
  where id = requested_cash_register_id
    and branch_id = profile_record.branch_id and status = 'open'
  for update;
  if not found then raise exception 'La caja no está abierta.'; end if;

  select coalesce(sum(
    payment.amount_cents + coalesce((
      select sum(tip.amount_cents)
      from public.tips tip
      where tip.payment_id = payment.id
    ), 0)
  ), 0) into cash_payments
  from public.payments payment
  where payment.cash_register_id = register_record.id
    and payment.method = 'cash' and payment.status = 'completed';
  select coalesce(sum(case when movement_type = 'in' then amount_cents else -amount_cents end), 0)
  into cash_movements
  from public.cash_movements
  where cash_register_id = register_record.id;
  expected_total := register_record.opening_amount_cents + cash_payments + cash_movements;

  update public.cash_registers
  set status = 'closed', closed_at = now(),
      closing_amount_cents = requested_counted_amount_cents,
      expected_amount_cents = expected_total
  where id = register_record.id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action, entity_type,
    entity_id, new_value
  ) values (
    profile_record.organization_id, profile_record.branch_id, profile_record.id,
    profile_record.role_id, 'cash_register.closed', 'cash_register',
    register_record.id, jsonb_build_object(
      'expected_amount_cents', expected_total,
      'closing_amount_cents', requested_counted_amount_cents,
      'difference_cents', requested_counted_amount_cents - expected_total
    )
  );
  return requested_counted_amount_cents - expected_total;
end;
$$;

revoke all on function public.open_cash_register(bigint) from public;
revoke all on function public.complete_table_sale(uuid, uuid, public.payment_method, bigint, bigint, text) from public;
revoke all on function public.close_cash_register(uuid, bigint) from public;
grant execute on function public.open_cash_register(bigint) to authenticated;
grant execute on function public.complete_table_sale(uuid, uuid, public.payment_method, bigint, bigint, text) to authenticated;
grant execute on function public.close_cash_register(uuid, bigint) to authenticated;
