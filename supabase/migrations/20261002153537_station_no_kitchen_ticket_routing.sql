-- Una estación de barra puede preparar bebidas sin generar comanda de cocina.
alter table public.preparation_stations
  add column sends_to_kitchen boolean not null default true;

update public.preparation_stations
set sends_to_kitchen = false,
    updated_at = now()
where station_type = 'bar';

create or replace function public.skip_unrouted_kitchen_ticket()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  should_send boolean;
begin
  select station.sends_to_kitchen
    into should_send
  from public.preparation_stations as station
  where station.id = new.station_id
    and station.organization_id = new.organization_id
    and station.branch_id = new.branch_id;

  if not found then
    raise exception 'La estación de preparación no pertenece a esta sucursal.';
  end if;

  if not should_send then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.skip_unrouted_kitchen_ticket() from public, anon, authenticated;

create trigger kitchen_ticket_station_routing
before insert on public.kitchen_tickets
for each row execute function public.skip_unrouted_kitchen_ticket();
