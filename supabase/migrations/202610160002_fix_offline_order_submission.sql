-- Corrige el rechazo de comandas offline causado por una referencia ambigua.
-- En la consulta de kitchen_tickets, `order_id` podía resolverse como la
-- columna de order_items y no como la variable del evento (SQLSTATE 42702).
-- Reutilizamos la definición instalada para conservar los controles de
-- permisos/estación que ya existan en el proyecto remoto.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_offline_events(uuid,jsonb)'::regprocedure)
    into function_sql;

  if position('where item.order_id = order_id' in function_sql) > 0 then
    function_sql := replace(
      function_sql,
      'where item.order_id = order_id',
      'where item.order_id = entity_id'
    );
    execute function_sql;
  end if;
end;
$$;
