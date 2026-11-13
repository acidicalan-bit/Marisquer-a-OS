-- La captura de comandas no depende de existencias ni de la bandera de
-- disponibilidad: Administración puede mantener la carta informativa y el
-- mesero registra lo que el cliente solicita.
do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_offline_events(uuid,jsonb)'::regprocedure)
    into function_sql;

  if position('and menu_item.is_active and menu_item.is_available' in function_sql) > 0 then
    function_sql := replace(
      function_sql,
      'and menu_item.is_active and menu_item.is_available',
      ''
    );
    execute function_sql;
  end if;
end;
$$;
