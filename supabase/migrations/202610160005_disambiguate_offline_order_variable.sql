-- Evita colisiones de nombres entre la variable PL/pgSQL y las columnas
-- order_id de las consultas de la transacción offline.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_offline_events(uuid,jsonb)'::regprocedure)
    into function_sql;

  if position('  order_id uuid;' in function_sql) > 0 then
    function_sql := replace(function_sql, '  order_id uuid;', '  submitted_order_id uuid;');
    function_sql := replace(function_sql, '        order_id := entity_id;', '        submitted_order_id := entity_id;');
    function_sql := replace(function_sql, '          order_id, profile_record.organization_id', '          submitted_order_id, profile_record.organization_id');
    function_sql := replace(function_sql, '            profile_record.branch_id, order_id, menu_record.id', '            profile_record.branch_id, submitted_order_id, menu_record.id');
    function_sql := replace(function_sql, '          ''order'', order_id, ''order.submitted.offline''', '          ''order'', submitted_order_id, ''order.submitted.offline''');
    function_sql := replace(function_sql, '''orderId'', order_id, ''totalCents''', '''orderId'', submitted_order_id, ''totalCents''');
    execute function_sql;
  end if;
end;
$$;
