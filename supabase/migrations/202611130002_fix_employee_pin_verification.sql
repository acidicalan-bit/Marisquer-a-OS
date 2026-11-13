-- Corrige la validación del NIP de meseros cuando la función usa search_path vacío.
-- El hash nunca sale de Supabase ni se guarda en el cliente.
create or replace function public.verify_employee_pin(
  requested_branch_id uuid,
  requested_employee_number text,
  candidate_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_record public.employee_pins%rowtype;
begin
  if candidate_pin is null or candidate_pin !~ '^[0-9]{4,8}$' then
    return false;
  end if;

  select pins.* into pin_record
  from public.employee_pins pins
  join public.user_profiles profile on profile.id = pins.user_id
  where pins.branch_id = requested_branch_id
    and profile.employee_number = requested_employee_number
    and profile.is_active
  for update;

  if not found or (pin_record.locked_until is not null and pin_record.locked_until > now()) then
    return false;
  end if;

  if pin_record.pin_hash = extensions.crypt(candidate_pin, pin_record.pin_hash) then
    update public.employee_pins
       set failed_attempts = 0, locked_until = null
     where id = pin_record.id;
    return true;
  end if;

  update public.employee_pins
     set failed_attempts = failed_attempts + 1,
         locked_until = case
           when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
           else locked_until
         end
   where id = pin_record.id;
  return false;
end;
$$;

revoke all on function public.verify_employee_pin(uuid, text, text) from public;
grant execute on function public.verify_employee_pin(uuid, text, text) to anon, authenticated;
