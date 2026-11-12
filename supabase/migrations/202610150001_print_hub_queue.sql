-- Cola duradera para Print Hub. El Hub usa un JWT de usuario autorizado; nunca service_role.

create table if not exists public.print_hubs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  owner_user_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 120),
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  station_id uuid references public.preparation_stations(id),
  document_type text not null check (document_type in ('kitchen', 'customer', 'modification', 'cancellation')),
  routing_key text not null check (routing_key in ('cold_kitchen', 'hot_kitchen', 'customer')),
  payload jsonb not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'printing', 'printed', 'retry', 'failed', 'unknown')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_by_hub_id uuid references public.print_hubs(id),
  claim_token uuid,
  claimed_at timestamptz,
  printed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists print_jobs_claim_idx on public.print_jobs (branch_id, status, created_at)
  where status in ('pending', 'retry', 'claimed');
create index if not exists print_jobs_hub_idx on public.print_jobs (claimed_by_hub_id, status, claimed_at);

alter table public.print_hubs enable row level security;
alter table public.print_jobs enable row level security;

create policy "print_hubs_select_own_branch" on public.print_hubs for select to authenticated
  using (organization_id = public.current_organization_id() and branch_id = public.current_branch_id());
create policy "print_jobs_select_own_branch" on public.print_jobs for select to authenticated
  using (organization_id = public.current_organization_id() and branch_id = public.current_branch_id());

create or replace function public.register_print_hub(requested_hub_id uuid, requested_name text)
returns public.print_hubs
language plpgsql security definer set search_path = '' as $$
declare profile_record public.user_profiles%rowtype; result public.print_hubs%rowtype;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  if not found or profile_record.branch_id is null or not public.has_permission('data.write') then
    raise exception 'Usuario no autorizado para operar Print Hub.';
  end if;
  if requested_hub_id is null or char_length(trim(coalesce(requested_name, ''))) = 0 then raise exception 'Hub y nombre requeridos.'; end if;
  insert into public.print_hubs (id, organization_id, branch_id, owner_user_id, name, last_seen_at)
  values (requested_hub_id, profile_record.organization_id, profile_record.branch_id, profile_record.id, left(trim(requested_name), 120), now())
  on conflict (id) do update set name = excluded.name, is_active = true, last_seen_at = now(), updated_at = now()
  where public.print_hubs.organization_id = profile_record.organization_id and public.print_hubs.branch_id = profile_record.branch_id
  returning * into result;
  if result.id is null then raise exception 'Ese Hub pertenece a otra sucursal.'; end if;
  return result;
end; $$;

create or replace function public.claim_print_jobs(requested_hub_id uuid, requested_limit integer default 5)
returns setof public.print_jobs
language plpgsql security definer set search_path = '' as $$
declare profile_record public.user_profiles%rowtype; hub public.print_hubs%rowtype;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  select * into hub from public.print_hubs where id = requested_hub_id and is_active;
  if not found or hub.organization_id <> profile_record.organization_id or hub.branch_id <> profile_record.branch_id or not public.has_permission('data.write') then raise exception 'Hub no autorizado.'; end if;
  update public.print_hubs set last_seen_at = now(), updated_at = now() where id = hub.id;
  -- Un claim sin impresión puede recuperarse. Un trabajo en printing se conserva para revisión humana.
  update public.print_jobs set status = 'retry', claimed_by_hub_id = null, claim_token = null, claimed_at = null, updated_at = now(), last_error = 'Claim expirado antes de iniciar impresión.'
  where branch_id = hub.branch_id and status = 'claimed' and claimed_at < now() - interval '2 minutes';
  return query
  with candidates as (
    select id from public.print_jobs where organization_id = profile_record.organization_id and branch_id = hub.branch_id and status in ('pending', 'retry')
    order by created_at for update skip locked limit greatest(1, least(coalesce(requested_limit, 5), 20))
  ) update public.print_jobs job set status = 'claimed', claimed_by_hub_id = hub.id, claim_token = gen_random_uuid(), claimed_at = now(), attempts = attempts + 1, updated_at = now()
  from candidates where job.id = candidates.id returning job.*;
end; $$;

create or replace function public.mark_print_job_printing(requested_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_record public.user_profiles%rowtype;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  update public.print_jobs set status = 'printing', updated_at = now()
  where id = requested_job_id and claimed_by_hub_id in (select id from public.print_hubs where organization_id = profile_record.organization_id and branch_id = profile_record.branch_id);
  if not found then raise exception 'Trabajo de impresión no reclamado por este Hub.'; end if;
end; $$;

create or replace function public.finish_print_job(requested_job_id uuid, requested_result text, requested_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_record public.user_profiles%rowtype; next_status text;
begin
  select * into profile_record from public.user_profiles where id = auth.uid() and is_active;
  if requested_result not in ('printed', 'retry', 'failed', 'unknown') then raise exception 'Resultado de impresión inválido.'; end if;
  next_status := requested_result;
  update public.print_jobs set status = next_status, printed_at = case when next_status = 'printed' then now() else printed_at end,
    last_error = left(nullif(requested_error, ''), 500), updated_at = now()
  where id = requested_job_id and claimed_by_hub_id in (select id from public.print_hubs where organization_id = profile_record.organization_id and branch_id = profile_record.branch_id);
  if not found then raise exception 'Trabajo de impresión no autorizado.'; end if;
end; $$;

create or replace function public.enqueue_kitchen_print_job()
returns trigger language plpgsql security definer set search_path = '' as $$
declare station public.preparation_stations%rowtype; order_record public.orders%rowtype; table_name text; route text;
begin
  select * into station from public.preparation_stations where id = new.station_id;
  if station.station_type not in ('cold_kitchen', 'hot_kitchen') then return new; end if;
  select * into order_record from public.orders where id = new.order_id;
  select restaurant_table.name into table_name from public.table_sessions session
    join public.tables restaurant_table on restaurant_table.id = session.table_id
    where session.id = order_record.table_session_id;
  route := station.station_type::text;
  insert into public.print_jobs (organization_id, branch_id, station_id, document_type, routing_key, idempotency_key, payload)
  select new.organization_id, new.branch_id, new.station_id, 'kitchen', route, 'kitchen-ticket:' || new.id,
    jsonb_build_object('title', 'COMANDA ' || upper(replace(route, '_', ' ')), 'tableName', coalesce(table_name, 'SIN MESA'), 'items', coalesce(jsonb_agg(jsonb_build_object('quantity', item.quantity, 'name', menu_item.name, 'notes', nullif(concat_ws(' · ', item.notes, modifiers.names), '')) order by item.created_at), '[]'::jsonb))
  from public.order_items item
  join public.menu_items menu_item on menu_item.id = item.menu_item_id
  left join lateral (select string_agg(modifier.name_snapshot, ', ' order by modifier.created_at) as names from public.order_item_modifiers modifier where modifier.order_item_id = item.id) modifiers on true
  where item.order_id = new.order_id and item.station_id = new.station_id
  on conflict (organization_id, idempotency_key) do nothing;
  return new;
end; $$;

drop trigger if exists enqueue_kitchen_print_job_after_ticket on public.kitchen_tickets;
create trigger enqueue_kitchen_print_job_after_ticket after insert on public.kitchen_tickets for each row execute function public.enqueue_kitchen_print_job();

create or replace function public.enqueue_customer_print_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.print_jobs (organization_id, branch_id, document_type, routing_key, idempotency_key, payload)
  values (new.organization_id, new.branch_id, 'customer', 'customer', 'receipt:' || new.id,
    coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('title', 'TICKET DE VENTA'))
  on conflict (organization_id, idempotency_key) do nothing;
  return new;
end; $$;

drop trigger if exists enqueue_customer_print_job_after_receipt on public.receipts;
create trigger enqueue_customer_print_job_after_receipt after insert on public.receipts for each row execute function public.enqueue_customer_print_job();

revoke all on function public.register_print_hub(uuid, text) from public;
revoke all on function public.claim_print_jobs(uuid, integer) from public;
revoke all on function public.mark_print_job_printing(uuid) from public;
revoke all on function public.finish_print_job(uuid, text, text) from public;
grant execute on function public.register_print_hub(uuid, text) to authenticated;
grant execute on function public.claim_print_jobs(uuid, integer) to authenticated;
grant execute on function public.mark_print_job_printing(uuid) to authenticated;
grant execute on function public.finish_print_job(uuid, text, text) to authenticated;
revoke all on function public.enqueue_kitchen_print_job() from public, anon, authenticated;
revoke all on function public.enqueue_customer_print_job() from public, anon, authenticated;
