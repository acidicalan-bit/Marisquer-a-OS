"use client";

import { useActionState } from "react";

import { setAdminSecurityPinAction } from "@/app/admin/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: { ok?: boolean; error?: string } = {};

export function SecurityPinForm() {
  const [state, action, pending] = useActionState(
    (_state: typeof initialState, formData: FormData) => setAdminSecurityPinAction(formData),
    initialState,
  );
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Autorización sensible</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">NIP de Administración</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Este NIP se solicita para cancelar platillos ya enviados y cerrar cuentas desde Meseros o Caja. Se guarda como hash en Supabase; nunca se muestra ni se guarda en la APK.
      </p>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-slate-700">
          Nuevo NIP
          <Input name="admin_pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete="new-password" className="mt-1 h-11 bg-white" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Confirmar NIP
          <Input name="admin_pin_confirmation" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete="new-password" className="mt-1 h-11 bg-white" required />
        </label>
        <Button type="submit" disabled={pending} className="h-11 bg-amber-700 text-white hover:bg-amber-800">
          {pending ? "Guardando…" : "Guardar NIP"}
        </Button>
      </form>
      {state.error && <Alert variant="destructive" className="mt-3"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.ok && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">NIP actualizado. Administración debe proporcionarlo al momento de autorizar un cobro o cancelación.</p>}
    </section>
  );
}
