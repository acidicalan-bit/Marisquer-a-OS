-- Las funciones de trigger no son una API RPC y no deben ser invocables desde PostgREST.
revoke all on function public.enqueue_kitchen_print_job() from public, anon, authenticated;
revoke all on function public.enqueue_customer_print_job() from public, anon, authenticated;
