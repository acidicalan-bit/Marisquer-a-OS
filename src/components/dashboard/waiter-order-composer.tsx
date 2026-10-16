"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingBag, Utensils } from "lucide-react";

import { submitWaiterOrderAction, type WaiterOrderState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { createUuid } from "@/lib/uuid";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
  available: boolean;
};
type Table = { id: string; name: string; status: string; capacity: number; sectionName: string };
type CartLine = { id: string; quantity: number; notes: string; allergy: string };
type StepName = "table" | "menu" | "review";
const initialState: WaiterOrderState = {};
const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const pageSize = 12;

export function WaiterOrderComposer({
  tables, menu, initialOrderId, initialEventId, deviceId,
}: {
  tables: Table[]; menu: MenuItem[]; initialOrderId: string; initialEventId: string; deviceId: string;
}) {
  const [state, action, pending] = useActionState(submitWaiterOrderAction, initialState);
  const [step, setStep] = useState<StepName>("table");
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(menu.map((item) => item.categoryName).filter(Boolean)))], [menu]);
  const filtered = menu.filter((item) => item.available && (category === "Todas" || item.categoryName === category) && `${item.name} ${item.description}`.toLocaleLowerCase("es-MX").includes(search.trim().toLocaleLowerCase("es-MX")));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleMenu = filtered.slice((page - 1) * pageSize, page * pageSize);
  const cartItems = Object.entries(cart).filter(([, line]) => line.quantity > 0);
  const unitCount = cartItems.reduce((sum, [, line]) => sum + line.quantity, 0);
  const estimatedCents = cartItems.reduce((sum, [id, line]) => sum + (menu.find((item) => item.id === id)?.priceCents ?? 0) * line.quantity, 0);
  const selectedTable = tables.find((table) => table.id === tableId);
  const payload = cartItems.map(([menu_item_id, line]) => ({
    id: line.id, menu_item_id, quantity: line.quantity,
    notes: line.notes.trim(), allergy_alert: line.allergy.trim(),
  }));

  function changeQuantity(id: string, amount: number) {
    const candidateId = createUuid();
    setCart((current) => {
      const previous = current[id];
      const quantity = Math.max(0, Math.min(50, (previous?.quantity ?? 0) + amount));
      return { ...current, [id]: { id: previous?.id ?? candidateId, quantity, notes: previous?.notes ?? "", allergy: previous?.allergy ?? "" } };
    });
  }
  function updateLine(id: string, key: "notes" | "allergy", value: string) {
    const candidateId = createUuid();
    setCart((current) => ({ ...current, [id]: { id: current[id]?.id ?? candidateId, quantity: current[id]?.quantity ?? 0, notes: current[id]?.notes ?? "", allergy: current[id]?.allergy ?? "", [key]: value } }));
  }
  function chooseCategory(value: string) { setCategory(value); setPage(1); }
  function chooseSearch(value: string) { setSearch(value); setPage(1); }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm" aria-labelledby="new-order-title">
      <div className="border-b bg-gradient-to-r from-teal-950 to-slate-900 px-5 py-5 text-white sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-teal-300 text-teal-950"><Utensils className="size-5" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-200">Servicio · Nueva comanda</p><h2 id="new-order-title" className="mt-1 text-2xl font-semibold">Captura pedido</h2></div>
        </div>
        <ol aria-label="Pasos para tomar pedido" className="mt-5 grid gap-2 text-xs font-semibold sm:grid-cols-3">
          <Step number="1" label={selectedTable?.name ?? "Elige mesa"} active={step === "table"} done={Boolean(selectedTable)} onClick={() => setStep("table")} />
          <Step number="2" label={unitCount ? `${unitCount} productos` : "Elige productos"} active={step === "menu"} done={unitCount > 0} disabled={!selectedTable} onClick={() => selectedTable && setStep("menu")} />
          <Step number="3" label="Revisa y envía" active={step === "review"} done={Boolean(state.success)} disabled={!unitCount} onClick={() => unitCount && setStep("review")} />
        </ol>
      </div>

      <form action={action} className="space-y-6 p-4 sm:p-7">
        <input type="hidden" name="order_id" value={initialOrderId} />
        <input type="hidden" name="event_id" value={initialEventId} />
        <input type="hidden" name="device_id" value={deviceId} />
        <input type="hidden" name="table_id" value={tableId} />
        <input type="hidden" name="guest_count" value={guests} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="items" value={JSON.stringify(payload)} />

        {step === "table" && <section aria-labelledby="table-choice-title">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Paso 1 de 3</p><h3 id="table-choice-title" className="mt-1 text-xl font-semibold">Selecciona la mesa</h3>
          {tables.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tables.map((table) => {
            const unavailable = table.status !== "free" && table.status !== "occupied";
            return <button key={table.id} type="button" disabled={unavailable} aria-pressed={tableId === table.id} onClick={() => { setTableId(table.id); setStep("menu"); }} className={`min-h-20 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-45 ${tableId === table.id ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700" : "border-slate-200 hover:border-teal-300 hover:bg-slate-50"}`}><span className="flex items-center justify-between gap-2"><strong>{table.name}</strong><span className={`size-2.5 rounded-full ${table.status === "free" ? "bg-emerald-500" : "bg-amber-400"}`} /></span><small className="mt-1 block truncate text-slate-500">{table.sectionName} · {table.capacity} lugares · {table.status === "free" ? "Libre" : table.status === "occupied" ? "Ocupada" : "No disponible"}</small></button>;
          })}</div> : <EmptyState>El administrador aún no configuró mesas para esta sucursal.</EmptyState>}
        </section>}

        {step === "menu" && selectedTable && <section aria-labelledby="menu-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-50 p-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Paso 2 de 3 · Mesa seleccionada</p><p className="font-semibold text-teal-950">{selectedTable.name} <span className="font-normal text-teal-800">· {selectedTable.sectionName}</span></p></div><Button type="button" variant="outline" className="min-h-11" onClick={() => setStep("table")}>Cambiar mesa</Button></div>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 id="menu-title" className="text-xl font-semibold">¿Qué van a ordenar?</h3><p className="mt-1 text-sm text-slate-500">Elige una categoría o busca directamente en la carta.</p></div><label className="relative block w-full sm:max-w-xs"><span className="sr-only">Buscar en el menú</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => chooseSearch(event.target.value)} placeholder="Buscar platillo o bebida" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-teal-600" /></label></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por categoría">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => chooseCategory(item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${category === item ? "border-teal-900 bg-teal-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`}>{item}</button>)}</div>
          {visibleMenu.length ? <div className="waiter-menu-grid mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleMenu.map((item) => {
            const quantity = cart[item.id]?.quantity ?? 0;
            return <article key={item.id} className={`min-w-0 overflow-hidden rounded-2xl border transition ${quantity ? "border-teal-300 ring-1 ring-teal-100" : "border-slate-200"}`}>
              <div className="relative aspect-[16/8] bg-gradient-to-br from-teal-50 to-amber-50">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 640px) 50vw, 30vw" className="object-cover" /> : <div className="grid h-full place-items-center text-3xl text-teal-800/35"><Utensils /></div>}<span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.categoryName}</span></div>
              <div className="min-w-0 p-3"><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words font-semibold">{item.name}</h4>{item.description && <p className="mt-1 line-clamp-2 break-words text-xs text-slate-500">{item.description}</p>}</div><strong className="shrink-0 text-sm text-teal-900">{currency.format(item.priceCents / 100)}</strong></div>
                <div className="mt-3 flex items-center justify-between"><button type="button" className="min-h-11 text-left text-xs font-semibold text-teal-800 underline-offset-2 hover:underline" onClick={() => setExpandedNotes(expandedNotes === item.id ? null : item.id)}>{cart[item.id]?.notes || cart[item.id]?.allergy ? "Editar indicaciones" : "Agregar indicaciones"}</button><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" aria-label={`Quitar ${item.name}`} disabled={!quantity} onClick={() => changeQuantity(item.id, -1)} className="size-11 rounded-xl"><Minus /></Button><strong className="min-w-5 text-center" aria-label={`${quantity} de ${item.name}`}>{quantity}</strong><Button type="button" size="icon" aria-label={`Agregar ${item.name}`} onClick={() => changeQuantity(item.id, 1)} className="size-11 rounded-xl bg-teal-900 hover:bg-teal-800"><Plus /></Button></div></div>
                {expandedNotes === item.id && <div className="mt-3 space-y-2 border-t pt-3"><label className="block text-xs font-medium">Indicaciones<input aria-label={`Nota especial para ${item.name}`} maxLength={500} placeholder="Ej. sin cebolla, extra limón" value={cart[item.id]?.notes ?? ""} onChange={(event) => updateLine(item.id, "notes", event.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="block text-xs font-medium">Alergias o restricciones<input aria-label={`Alergia para ${item.name}`} maxLength={300} placeholder="Si aplica" value={cart[item.id]?.allergy ?? ""} onChange={(event) => updateLine(item.id, "allergy", event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-red-100 px-3" /></label></div>}
              </div>
            </article>;
          })}</div> : <EmptyState>No hay productos en esta categoría. Prueba otra búsqueda.</EmptyState>}
          {filtered.length > pageSize && <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4"><p aria-live="polite" className="text-xs text-slate-500">{filtered.length} productos · página {page} de {pageCount}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 size-4" />Anterior</Button><Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Siguiente<ChevronRight className="ml-1 size-4" /></Button></div></div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-4 text-white"><div><p className="text-xs text-white/65">Tu pedido hasta ahora</p><p className="font-semibold">{unitCount} productos · {currency.format(estimatedCents / 100)}</p></div><Button type="button" disabled={!unitCount} onClick={() => setStep("review")} className="min-h-12 rounded-xl bg-teal-300 px-5 font-bold text-teal-950 hover:bg-teal-200"><ShoppingBag className="mr-2 size-4" />Revisar comanda</Button></div>
        </section>}

        {step === "review" && selectedTable && <section aria-labelledby="review-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Paso 3 de 3</p><h3 id="review-title" className="mt-1 text-xl font-semibold">Revisa antes de enviar</h3><p className="mt-1 text-sm text-slate-500">{selectedTable.name} · {unitCount} productos</p></div><Button type="button" variant="outline" className="min-h-11" onClick={() => setStep("menu")}>Volver a la carta</Button></div>
          <div className="divide-y rounded-2xl border">{cartItems.map(([id, line]) => { const item = menu.find((candidate) => candidate.id === id); if (!item) return null; return <div key={id} className="flex items-start gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{line.quantity} × {item.name}</p><p className="mt-1 text-sm text-slate-500">{currency.format(item.priceCents * line.quantity / 100)}</p>{line.notes && <p className="mt-1 text-xs text-slate-600">Indicaciones: {line.notes}</p>}{line.allergy && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Alergia/restricción: {line.allergy}</p>}<button type="button" className="mt-2 min-h-10 text-sm font-semibold text-teal-800 underline" onClick={() => { setExpandedNotes(id); setStep("menu"); }}>Editar artículo</button></div><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" aria-label={`Quitar ${item.name}`} className="size-11" onClick={() => { changeQuantity(id, -1); if (unitCount <= 1) setStep("menu"); }}><Minus /></Button><span className="min-w-5 text-center font-bold">{line.quantity}</span><Button type="button" size="icon" aria-label={`Agregar ${item.name}`} className="size-11" onClick={() => changeQuantity(id, 1)}><Plus /></Button></div></div>; })}</div>
          <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[1fr_1fr]">
            <label className="text-sm font-semibold">Personas<input aria-label="Número de personas" type="number" min={1} max={50} value={guests} onChange={(event) => setGuests(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-center" /></label>
            <label className="text-sm font-semibold">Nota para toda la comanda<input maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. servir todo junto" className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-teal-900 bg-teal-50 p-4"><div><p className="text-sm text-teal-900">Total estimado</p><p className="text-2xl font-bold text-teal-950">{currency.format(estimatedCents / 100)}</p></div><Button type="submit" disabled={pending || !tableId || unitCount === 0 || Boolean(state.success)} className="min-h-12 min-w-48 rounded-xl bg-teal-900 px-5 font-semibold hover:bg-teal-800">{pending ? "Enviando…" : state.success ? <><Check className="mr-2 size-4" />Enviada</> : "Confirmar y enviar a cocina"}</Button></div>
        </section>}
        {state.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><span>{state.error}</span>{/sesión expiró|sesión requerida/i.test(state.error) && <Button type="button" variant="outline" onClick={() => { window.location.href = "/login?next=/dashboard"; }}>Volver a entrar</Button>}</div>}
        {state.success && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><span className="font-semibold">{state.success}</span><Button type="button" variant="outline" onClick={() => window.location.reload()}>Capturar siguiente pedido</Button></div>}
      </form>
    </section>
  );
}

function Step({ number, label, active, done, disabled, onClick }: { number: string; label: string; active: boolean; done: boolean; disabled?: boolean; onClick: () => void }) {
  return <li><button type="button" disabled={disabled} aria-current={active ? "step" : undefined} onClick={onClick} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${done ? "bg-teal-300/20 text-teal-100" : active ? "bg-white/15 text-white" : "bg-white/5 text-white/60"}`}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15">{done ? <Check className="size-3.5" /> : number}</span><span className="truncate">{label}</span></button></li>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">{children}</div>;
}
