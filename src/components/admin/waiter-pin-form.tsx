"use client";

import { useActionState } from "react";

import { setEmployeePinAction } from "@/app/admin/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WaiterOption = { id: string; label: string };
const initialState: { ok?: boolean; error?: string } = {};

export function WaiterPinForm({ users }: { users: WaiterOption[] }) {
  const [state, action, pending] = useActionState(
    (_state: typeof initialState, formData: FormData) => setEmployeePinAction(formData),
    initialState,
  );

  return (
    <section className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Acceso rápido</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">NIP para meseros</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Asigna un NIP de 4 a 8 dígitos. El valor se guarda sólo como hash; el mesero podrá entrar desde la pestaña “NIP de mesero” sin conocer la contraseña de correo.
      </p>
      {users.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Primero crea un usuario con rol Mesero o Capitán.</p>
      ) : (
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium text-slate-700">Mesero
            <select name="employee_user_id" className="mt-1 h-11 w-full rounded-lg border bg-white px-3" required defaultValue="">
              <option value="" disabled>Seleccionar…</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Nuevo NIP
            <Input name="employee_pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete="new-password" className="mt-1 h-11 bg-white" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Confirmar NIP
            <Input name="employee_pin_confirmation" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete="new-password" className="mt-1 h-11 bg-white" required />
          </label>
          <Button type="submit" disabled={pending} className="h-11 bg-teal-800 text-white hover:bg-teal-900">{pending ? "Guardando…" : "Guardar NIP"}</Button>
        </form>
      )}
      {state.error && <Alert variant="destructive" className="mt-3"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.ok && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">NIP de mesero actualizado.</p>}
    </section>
  );
}
