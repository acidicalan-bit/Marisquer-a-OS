"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDot, Clock3, RefreshCw } from "lucide-react";

import { cancelWaiterOrderItemAction, type WaiterOrderState } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type OrderLine = { id: string; name: string; quantity: number; status: string; notes: string | null; allergy: string | null };
export type WaiterOrder = { id: string; folio: number; status: string; totalCents: number; submittedAt: string | null; tableName: string; items: OrderLine[] };
const statusNames: Record<string, string> = { received: "Recibida", pending: "Pendiente", preparing: "Preparando", ready: "Lista", delivered: "Entregada", submitted: "Enviada", in_progress: "En preparación", closed: "Cerrada" };
const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const initialCancelState: WaiterOrderState = {};

function CancelOrderItemForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(cancelWaiterOrderItemAction, initialCancelState);
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <details className="mt-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-semibold text-red-800">Cancelar con NIP de Administración</summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="order_item_id" value={itemId} />
        <label className="text-xs font-medium text-slate-700">
          Motivo
          <input name="reason" required minLength={3} maxLength={240} className="mt-1 h-10 w-full rounded-lg border bg-white px-2 text-sm" placeholder="Ej. cliente cambió de opinión" disabled={pending || Boolean(state.success)} />
        </label>
        <label className="text-xs font-medium text-slate-700">
          NIP
          <input name="admin_pin" required minLength={4} maxLength={8} pattern="[0-9]{4,8}" inputMode="numeric" type="password" autoComplete="off" className="mt-1 h-10 w-full rounded-lg border bg-white px-2 text-sm" placeholder="4–8 dígitos" disabled={pending || Boolean(state.success)} />
        </label>
        <Button type="submit" variant="destructive" size="sm" disabled={pending || Boolean(state.success)}>{pending ? "Cancelando…" : state.success ? "Cancelado" : "Confirmar"}</Button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs font-medium text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-2 text-xs font-medium text-emerald-800">{state.success}</p>}
    </details>
  );
}

export function WaiterOrderBoard({ orders }: { orders: WaiterOrder[] }) {
  const router = useRouter();
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 20_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return <section aria-labelledby="my-orders-title" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Seguimiento · actualización automática cada 20 s</p><h2 id="my-orders-title" className="mt-1 text-2xl font-semibold">Mis comandas</h2></div><div className="flex items-center gap-2"><Badge variant="outline">{orders.length} activas</Badge><button type="button" onClick={() => router.refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><RefreshCw className="size-4" />Actualizar</button></div></div>
    {orders.length ? <div className="grid gap-4 xl:grid-cols-2">{orders.map((order) => <Card key={order.id} className="overflow-hidden rounded-2xl border-slate-200"><div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3"><div><p className="font-semibold">{order.tableName} <span className="font-normal text-slate-500">· Comanda #{order.folio}</span></p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="size-3" />{order.submittedAt ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.submittedAt)) : "Hora no disponible"}</p></div><strong>{currency.format(order.totalCents / 100)}</strong></div><CardContent className="divide-y px-4 py-1">{order.items.map((line) => <div key={line.id} className="py-3"><div className="flex items-start gap-3"><span className="mt-0.5 text-sm font-bold text-teal-900">{line.quantity}×</span><div className="min-w-0 flex-1"><p className="font-medium">{line.name}</p>{line.notes && <p className="mt-1 text-xs text-slate-500">Especial: {line.notes}</p>}{line.allergy && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Alergia: {line.allergy}</p>}</div><Badge className={line.status === "ready" || line.status === "delivered" ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-100" : "bg-amber-100 text-amber-900 hover:bg-amber-100"}>{line.status === "ready" || line.status === "delivered" ? <CheckCircle2 className="mr-1 size-3" /> : <CircleDot className="mr-1 size-3" />}{statusNames[line.status] ?? line.status}</Badge></div>{line.status !== "cancelled" && line.status !== "delivered" && <CancelOrderItemForm itemId={line.id} />}</div>)}</CardContent></Card>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><CircleDot className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold">Todavía no hay comandas activas</p><p className="mt-1 text-sm text-slate-500">Las que envíes aparecerán aquí con el estado de cada platillo.</p></div>}
  </section>;
}
