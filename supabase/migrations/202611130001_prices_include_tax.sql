-- Los precios de la carta son precios finales. No se agrega IVA al cobrar.
alter table public.menu_items
  alter column tax_rate_basis_points set default 0;

update public.menu_items
   set tax_rate_basis_points = 0,
       updated_at = now()
 where tax_rate_basis_points <> 0;

update public.order_items
   set tax_cents = 0,
       total_cents = subtotal_cents,
       updated_at = now()
 where status <> 'cancelled'
   and tax_cents <> 0;

update public.orders customer_order
   set subtotal_cents = totals.subtotal_cents,
       tax_cents = 0,
       total_cents = totals.subtotal_cents,
       updated_at = now()
  from (
    select item.order_id,
           coalesce(sum(item.subtotal_cents), 0)::bigint as subtotal_cents
      from public.order_items item
     where item.status <> 'cancelled'
     group by item.order_id
  ) totals
 where customer_order.id = totals.order_id
   and customer_order.status <> 'cancelled';
