-- Evita otra resolución ambigua en el UPDATE de orders. Se califica la
-- columna y se usa entity_id, que es el id autoritativo del pedido.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_offline_events(uuid,jsonb)'::regprocedure)
    into function_sql;

  if position('where id = order_id' in function_sql) > 0 then
    function_sql := replace(
      function_sql,
      'where id = order_id',
      'where public.orders.id = entity_id'
    );
    execute function_sql;
  end if;
end;
$$;
