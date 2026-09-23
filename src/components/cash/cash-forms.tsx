"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  closeCashRegisterAction,
  completeSaleAction,
  openCashRegisterAction,
  type CashActionState,
} from "@/app/cash/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CashActionState = {};

function ErrorMessage({ state }: { state: CashActionState }) {
  return state.error ? (
    <Alert variant="destructive">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  ) : null;
}

export function OpenRegisterForm() {
  const [state, action, pending] = useActionState(
    openCashRegisterAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="opening-amount">Fondo inicial en efectivo</Label>
        <Input
          id="opening-amount"
          name="opening_amount"
          inputMode="decimal"
          defaultValue="0.00"
          className="h-12"
          required
        />
      </div>
      <ErrorMessage state={state} />
      <Button className="h-12 w-full" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Abriendo…" : "Abrir caja"}
      </Button>
    </form>
  );
}

export function CompleteSaleForm({
  sessionId,
  registerId,
  totalCents,
  idempotencyKey,
}: {
  sessionId: string;
  registerId: string;
  totalCents: number;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    completeSaleAction,
    initialState,
  );
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="register_id" value={registerId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <div className="space-y-2">
        <Label htmlFor={`method-${sessionId}`}>Método</Label>
        <select
          id={`method-${sessionId}`}
          name="method"
          className="h-12 w-full rounded-lg border bg-white px-3"
          defaultValue="cash"
        >
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`received-${sessionId}`}>Importe recibido</Label>
        <Input
          id={`received-${sessionId}`}
          name="received_amount"
          inputMode="decimal"
          defaultValue={(totalCents / 100).toFixed(2)}
          className="h-12"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`tip-${sessionId}`}>Propina</Label>
        <Input
          id={`tip-${sessionId}`}
          name="tip_amount"
          inputMode="decimal"
          defaultValue="0.00"
          className="h-12"
          required
        />
      </div>
      <div className="flex items-end">
        <Button className="h-12 w-full" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {pending ? "Cobrando…" : "Cobrar y generar ticket"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <ErrorMessage state={state} />
      </div>
    </form>
  );
}

export function CloseRegisterForm({ registerId }: { registerId: string }) {
  const [state, action, pending] = useActionState(
    closeCashRegisterAction,
    initialState,
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="register_id" value={registerId} />
      <div className="flex-1 space-y-2">
        <Label htmlFor="counted-amount">Efectivo contado al cierre</Label>
        <Input
          id="counted-amount"
          name="counted_amount"
          inputMode="decimal"
          className="h-12"
          required
        />
      </div>
      <Button variant="outline" className="h-12" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Cerrando…" : "Cerrar caja"}
      </Button>
      <div className="sm:basis-full">
        <ErrorMessage state={state} />
      </div>
    </form>
  );
}
