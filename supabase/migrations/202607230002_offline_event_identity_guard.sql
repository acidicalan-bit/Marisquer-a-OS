-- Impide que una cola creada por un usuario o sucursal se aplique bajo otra sesión.

create or replace function public.apply_offline_events_v2(
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

  if exists (
    select 1
    from jsonb_array_elements(requested_events) event
    where event->>'user_id' is null
      or event->>'branch_id' is null
      or (event->>'user_id')::uuid <> profile_record.id
      or (event->>'branch_id')::uuid <> profile_record.branch_id
  ) then
    raise exception 'La cola offline pertenece a otro usuario o sucursal.';
  end if;

  return public.apply_offline_events(requested_device_id, requested_events);
end;
$$;

revoke all on function public.apply_offline_events(uuid, jsonb) from authenticated;
revoke all on function public.apply_offline_events_v2(uuid, jsonb) from public;
grant execute on function public.apply_offline_events_v2(uuid, jsonb) to authenticated;
