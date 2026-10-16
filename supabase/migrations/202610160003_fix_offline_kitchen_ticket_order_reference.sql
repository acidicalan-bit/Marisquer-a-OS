-- La lista SELECT de kitchen_tickets también tenía `order_id` ambiguo:
-- order_items expone una columna con el mismo nombre. Usa el id del evento,
-- que es el pedido recién creado, sin cambiar el contrato de la función.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_offline_events(uuid,jsonb)'::regprocedure)
    into function_sql;

  if position('order_id, item.station_id' in function_sql) > 0 then
    function_sql := replace(
      function_sql,
      'order_id, item.station_id',
      'entity_id, item.station_id'
    );
    execute function_sql;
  end if;
end;
$$;
