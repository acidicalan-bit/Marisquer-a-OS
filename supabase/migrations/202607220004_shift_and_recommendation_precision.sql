-- Turnos exclusivos de administración y recomendaciones sin puntajes ficticios.

insert into public.permissions (organization_id, code, description)
select organization.id, 'shifts.manage', 'Abrir y cerrar turnos de la sucursal'
from public.organizations organization
on conflict (organization_id, code) do update set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.organization_id = role.organization_id
where role.code = 'administrator' and permission.code = 'shifts.manage'
on conflict do nothing;

drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts for all to authenticated
using (
  organization_id = public.current_organization_id()
  and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  and public.has_permission('shifts.manage')
)
with check (
  organization_id = public.current_organization_id()
  and (branch_id = public.current_branch_id() or public.has_permission('branches.all'))
  and public.has_permission('shifts.manage')
);

create unique index if not exists one_open_shift_per_branch
on public.shifts(branch_id) where status = 'open';

alter function public.menu_performance(timestamptz, timestamptz)
rename to menu_performance_unadjusted;

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
  select performance.menu_item_id, performance.item_name, performance.category_name,
    performance.units_sold, performance.previous_units_sold, performance.revenue_cents,
    performance.estimated_cost_cents, performance.gross_margin_cents,
    performance.gross_margin_basis_points, performance.sales_trend_percent,
    case
      when sum(performance.units_sold) over () = 0 then 0
      when exists (
        select 1 from public.recipes recipe
        where recipe.menu_item_id = performance.menu_item_id
      ) then performance.recommendation_score
      else greatest(0, performance.recommendation_score - coalesce(settings.margin_weight, 45))
    end recommendation_score
  from public.menu_performance_unadjusted(requested_start, requested_end) performance
  join public.menu_items item on item.id = performance.menu_item_id
  left join public.sales_assistant_settings settings on settings.branch_id = item.branch_id;
$$;

revoke all on function public.menu_performance_unadjusted(timestamptz, timestamptz) from public;
grant execute on function public.menu_performance(timestamptz, timestamptz) to authenticated;
