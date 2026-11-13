"use client";

import { useActionState, useState } from "react";
import { Banknote, CircleDollarSign } from "lucide-react";

import {
  collectWaiterSaleAction,
  type WaiterOrderState,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { createUuid } from "@/lib/uuid";

export type WaiterAccount = {
  sessionId: string;
  tableName: string;
  status: string;
  dueCents: number;
};

export type WaiterLastSale = {
  folio: string;
  tableName: string;
  totalCents: number;
  method: string;
  paidAt: string;
};

const initialState: WaiterOrderState = {};
const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function WaiterCheckoutPanel({
  accounts,
  lastSale,
}: {
  accounts: WaiterAccount[];
  lastSale?: WaiterLastSale | null;
}) {
  return (
    <section aria-labelledby="waiter-checkout-title" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Cobro desde Mesero
        </p>
        <h2 id="waiter-checkout-title" className="mt-1 text-2xl font-semibold">
          Cuentas listas para cobrar
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Registra el pago en la mesa. El cobro se confirma en el servidor y queda ligado al turno abierto por administración.
        </p>
      </div>
      {lastSale && <LastSaleCard sale={lastSale} />}
      {accounts.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {accounts.map((account) => (
            <WaiterCheckoutCard key={account.sessionId} account={account} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-600">
          No hay cuentas pendientes. Cuando un cliente pida la cuenta, la mesa aparecerá aquí.
        </div>
      )}
    </section>
  );
}

function LastSaleCard({ sale }: { sale: WaiterLastSale }) {
  const paidAt = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(sale.paidAt));
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Último pedido cobrado</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-950">{sale.tableName} · {sale.folio}</p>
          <p className="text-sm text-emerald-900/75">{paidAt} · {sale.method}</p>
        </div>
        <strong className="text-lg text-emerald-950">{currency.format(sale.totalCents / 100)}</strong>
      </div>
    </div>
  );
}

function WaiterCheckoutCard({ account }: { account: WaiterAccount }) {
  const [state, action, pending] = useActionState(
    collectWaiterSaleAction,
    initialState,
  );
  const [idempotencyKey] = useState(createUuid);
  const [method, setMethod] = useState("cash");

  return (
    <form action={action} className="rounded-2xl border bg-white p-4 shadow-sm">
      <input type="hidden" name="session_id" value={account.sessionId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{account.tableName}</h3>
          <p className="text-sm text-slate-500">
            {account.status === "check_requested" ? "Pidió la cuenta" : "Cuenta abierta"}
          </p>
        </div>
        <strong className="text-xl text-teal-900">
          {currency.format(account.dueCents / 100)}
        </strong>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Forma de pago
          <select
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border bg-white px-3"
            disabled={pending || Boolean(state.success)}
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Recibido
          <input
            name="received_amount"
            inputMode="decimal"
            defaultValue={(account.dueCents / 100).toFixed(2)}
            className="mt-1 h-11 w-full rounded-xl border px-3"
            required
            disabled={pending || Boolean(state.success)}
          />
        </label>
        <label className="text-sm font-medium">
          Propina
          <input
            name="tip_amount"
            inputMode="decimal"
            defaultValue="0.00"
            className="mt-1 h-11 w-full rounded-xl border px-3"
            required
            disabled={pending || Boolean(state.success)}
          />
        </label>
        <label className="text-sm font-medium sm:col-span-3">
          NIP de Administración
          <input
            name="admin_pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            autoComplete="off"
            placeholder="Lo introduce Administración"
            className="mt-1 h-11 w-full rounded-xl border px-3"
            required
            disabled={pending || Boolean(state.success)}
          />
        </label>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
        <Banknote className="mt-0.5 size-4 shrink-0" />
        Si se pierde la conexión, no marques el pago como confirmado. Revisa el estado antes de volver a cobrar.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {state.success}
        </p>
      )}
      <Button
        className="mt-4 min-h-12 w-full"
        disabled={pending || Boolean(state.success)}
      >
        <CircleDollarSign className="mr-2 size-4" />
        {pending ? "Confirmando cobro…" : state.success ? "Cuenta pagada" : "Confirmar cobro"}
      </Button>
    </form>
  );
}
