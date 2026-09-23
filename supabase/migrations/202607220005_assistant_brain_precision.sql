-- Corrige la precisión del cerebro comercial: ámbito de sucursal, costo unitario,
-- margen mínimo, disponibilidad real de inventario y pesos normalizados.

drop function if exists public.menu_performance(timestamptz, timestamptz);
drop function if exists public.menu_performance_unadjusted(timestamptz, timestamptz);

create function public.menu_performance(
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
  with recipe_metrics as (
    select recipe.menu_item_id,
      round(sum(recipe.quantity * ingredient.cost_cents))::bigint unit_cost_cents,
      min(
        greatest(0, ingredient.stock_quantity - ingredient.minimum_quantity)
        / recipe.quantity
      ) stock_portions_above_minimum
    from public.recipes recipe
    join public.ingredients ingredient on ingredient.id = recipe.ingredient_id
    where ingredient.is_active
    group by recipe.menu_item_id
  ), current_sales as (
    select order_item.menu_item_id,
      sum(order_item.quantity)::bigint units,
      sum(order_item.subtotal_cents)::bigint revenue
    from public.order_items order_item
    join public.orders customer_order on customer_order.id = order_item.order_id
    where order_item.branch_id = public.current_branch_id()
      and customer_order.branch_id = public.current_branch_id()
      and order_item.created_at >= requested_start
      and order_item.created_at < requested_end
      and order_item.status <> 'cancelled'
      and customer_order.status <> 'cancelled'
    group by order_item.menu_item_id
  ), previous_sales as (
    select order_item.menu_item_id,
      sum(order_item.quantity)::bigint units
    from public.order_items order_item
    join public.orders customer_order on customer_order.id = order_item.order_id
    where order_item.branch_id = public.current_branch_id()
      and customer_order.branch_id = public.current_branch_id()
      and order_item.created_at >= requested_start - (requested_end - requested_start)
      and order_item.created_at < requested_start
      and order_item.status <> 'cancelled'
      and customer_order.status <> 'cancelled'
    group by order_item.menu_item_id
  ), base as (
    select item.id,
      item.name,
      category.name category_name,
      item.price_cents,
      coalesce(current_sales.units, 0)::bigint units,
      coalesce(previous_sales.units, 0)::bigint previous_units,
      coalesce(current_sales.revenue, 0)::bigint revenue,
      coalesce(recipe_metrics.unit_cost_cents, 0)::bigint unit_cost,
      recipe_metrics.menu_item_id is not null has_recipe,
      coalesce(recipe_metrics.stock_portions_above_minimum, 0) stock_portions,
      coalesce(settings.margin_weight, 45) margin_weight,
      coalesce(settings.low_sales_weight, 35) low_sales_weight,
      coalesce(settings.inventory_weight, 20) inventory_weight,
      coalesce(settings.minimum_margin_basis_points, 3000) minimum_margin,
      coalesce(settings.is_active, true) recommendations_active,
      greatest(1::numeric, extract(epoch from (requested_end - requested_start)) / 86400) period_days
    from public.menu_items item
    join public.menu_categories category on category.id = item.category_id
    left join current_sales on current_sales.menu_item_id = item.id
    left join previous_sales on previous_sales.menu_item_id = item.id
    left join recipe_metrics on recipe_metrics.menu_item_id = item.id
    left join public.sales_assistant_settings settings on settings.branch_id = item.branch_id
    where item.deleted_at is null
      and item.is_active
      and item.is_available
      and item.organization_id = public.current_organization_id()
      and item.branch_id = public.current_branch_id()
  ), normalized as (
    select base.*,
      max(units) over () max_units,
      sum(units) over () total_units,
      case
        when has_recipe and price_cents > 0 then
          round(((price_cents - unit_cost)::numeric / price_cents) * 10000)::integer
        else 0
      end unit_margin_basis_points,
      least(
        100::numeric,
        (stock_portions / greatest(1::numeric, units::numeric / period_days)) * 100
      ) inventory_readiness
    from base
  )
  select id,
    name,
    normalized.category_name,
    units,
    previous_units,
    revenue,
    (units * unit_cost)::bigint,
    (revenue - (units * unit_cost))::bigint,
    unit_margin_basis_points,
    case
      when previous_units > 0 then
        round(((units - previous_units)::numeric / previous_units) * 100, 1)
      when units > 0 then 100
      else 0
    end,
    case
      when total_units = 0
        or not recommendations_active
        or not has_recipe
        or unit_margin_basis_points < minimum_margin
        or margin_weight + low_sales_weight + inventory_weight <= 0
      then 0
      else round(
        (
          least(100::numeric, greatest(0::numeric, unit_margin_basis_points::numeric / 100)) * margin_weight
          + (case when max_units > 0 then (1 - units::numeric / max_units) * 100 else 0 end) * low_sales_weight
          + inventory_readiness * inventory_weight
        ) / (margin_weight + low_sales_weight + inventory_weight),
        2
      )
    end
  from normalized
  order by units desc, revenue desc, name;
$$;

revoke all on function public.menu_performance(timestamptz, timestamptz) from public;
grant execute on function public.menu_performance(timestamptz, timestamptz) to authenticated;
