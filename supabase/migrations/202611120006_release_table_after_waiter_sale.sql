-- El cobro desde Mesero también libera la mesa inmediatamente. La limpieza
-- no forma parte del flujo de disponibilidad y no debe bloquear pedidos.
create or replace function public.complete_waiter_table_sale(
  requested_table_session_id uuid,
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
  shift_record public.shifts%rowtype;
  existing_receipt_id uuid;
  existing_session_id uuid;
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
  if not (public.has_permission('payments.collect') or public.has_permission('cash.manage')) then
    raise exception 'No tienes permiso para cobrar cuentas.';
  end if;
  if requested_method is null or requested_tip_cents is null or requested_received_cents is null then
    raise exception 'El método y los importes del cobro son obligatorios.';
  end if;
  if requested_tip_cents < 0 or requested_received_cents < 0 then
    raise exception 'Los importes no pueden ser negativos.';
  end if;
  if requested_idempotency_key is null
     or length(requested_idempotency_key) < 16
     or length(requested_idempotency_key) > 128 then
    raise exception 'La clave de operación no es válida.';
  end if;

  select * into profile_record
  from public.user_profiles
  where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null then
    raise exception 'El usuario no tiene una sucursal activa.';
  end if;

  select payment.table_session_id, receipt.id
    into existing_session_id, existing_receipt_id
  from public.payments payment
  join public.receipts receipt on receipt.table_session_id = payment.table_session_id
  where payment.organization_id = profile_record.organization_id
    and payment.idempotency_key = requested_idempotency_key;
  if existing_receipt_id is not null then
    if existing_session_id <> requested_table_session_id then
      raise exception 'La clave de cobro ya fue usada para otra cuenta.';
    end if;
    return existing_receipt_id;
  end if;

  select * into session_record
  from public.table_sessions
  where id = requested_table_session_id
    and organization_id = profile_record.organization_id
    and branch_id = profile_record.branch_id
  for update;
  if not found or session_record.status in ('closed', 'cancelled') then
    raise exception 'La cuenta ya no está disponible para cobro.';
  end if;
  if not public.has_permission('cash.manage') and session_record.waiter_id <> profile_record.id then
    raise exception 'Sólo el mesero asignado puede cobrar esta cuenta.';
  end if;

  select id into existing_receipt_id
  from public.receipts
  where table_session_id = session_record.id;
  if existing_receipt_id is not null then return existing_receipt_id; end if;

  select * into shift_record
  from public.shifts
  where branch_id = profile_record.branch_id
    and organization_id = profile_record.organization_id
    and status = 'open'
  for update;
  if not found then raise exception 'No hay turno abierto. Pide al administrador que lo abra desde la PC.'; end if;

  select coalesce(sum(customer_order.subtotal_cents), 0),
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
    raise exception 'El importe recibido no cubre la cuenta y la propina.';
  end if;
  if requested_method <> 'cash' and requested_received_cents <> due_total + requested_tip_cents then
    raise exception 'En tarjeta, transferencia u otro medio, captura el importe exacto.';
  end if;
  change_total := requested_received_cents - due_total - requested_tip_cents;

  insert into public.payments (
    organization_id, branch_id, table_session_id, shift_id, method,
    amount_cents, status, idempotency_key, received_by, paid_at
  ) values (
    profile_record.organization_id, profile_record.branch_id, session_record.id,
    shift_record.id, requested_method, due_total, 'completed',
    requested_idempotency_key, profile_record.id, now()
  ) returning id into payment_id;

  if requested_tip_cents > 0 then
    insert into public.tips (organization_id, branch_id, payment_id, amount_cents)
    values (profile_record.organization_id, profile_record.branch_id, payment_id, requested_tip_cents);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', menu_item.name, 'quantity', order_item.quantity,
    'unit_price_cents', order_item.unit_price_cents, 'total_cents', order_item.total_cents,
    'notes', order_item.notes, 'allergy_alert', order_item.allergy_alert
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
    receipt_folio, sale_subtotal, sale_tax, discount_total, requested_tip_cents,
    sale_total - discount_total + requested_tip_cents,
    jsonb_build_object(
      'items', line_items, 'payment_method', requested_method,
      'payment_cents', due_total, 'received_cents', requested_received_cents,
      'change_cents', change_total, 'received_by', profile_record.id,
      'shift_id', shift_record.id
    )
  ) returning id into receipt_id;

  update public.orders
     set status = 'closed', closed_at = now(), version = version + 1
   where table_session_id = session_record.id and status <> 'cancelled';
  update public.table_sessions
     set status = 'closed', closed_at = now(), version = version + 1
   where id = session_record.id;
  update public.tables
     set status = 'free', version = version + 1, updated_at = now()
   where id = session_record.table_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, role_id, action, entity_type,
    entity_id, new_value
  ) values (
    profile_record.organization_id, profile_record.branch_id, profile_record.id,
    profile_record.role_id, 'sale.completed_by_waiter', 'receipt', receipt_id,
    jsonb_build_object(
      'payment_id', payment_id, 'shift_id', shift_record.id,
      'method', requested_method, 'amount_cents', due_total,
      'tip_cents', requested_tip_cents, 'change_cents', change_total
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

revoke all on function public.complete_waiter_table_sale(uuid, public.payment_method, bigint, bigint, text) from public;
grant execute on function public.complete_waiter_table_sale(uuid, public.payment_method, bigint, bigint, text) to authenticated;
