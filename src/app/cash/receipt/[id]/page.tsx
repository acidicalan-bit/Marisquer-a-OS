import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintReceiptButton } from "@/components/cash/print-receipt-button";
import { Button } from "@/components/ui/button";
import { CASH_ROLE_CODES, requireRolePage } from "@/lib/auth/role-access";
import { formatMoney } from "@/lib/cash/money";

export const metadata: Metadata = { title: "Ticket de venta" };
export const dynamic = "force-dynamic";

type ReceiptItem = {
  name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireRolePage(CASH_ROLE_CODES);
  const { data: receipt, error } = await supabase
    .from("receipts")
    .select(
      "id, folio, subtotal_cents, tax_cents, discount_cents, tip_cents, total_cents, payload, issued_at, branch:branches(name, phone, address), session:table_sessions(table:tables(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo abrir el ticket: ${error.message}`);
  if (!receipt) notFound();

  const payload =
    receipt.payload && typeof receipt.payload === "object"
      ? (receipt.payload as Record<string, unknown>)
      : {};
  const items = Array.isArray(payload.items)
    ? payload.items.filter(isReceiptItem)
    : [];
  const branch = firstRelation(receipt.branch);
  const session = firstRelation(receipt.session);
  const table =
    session && "table" in session ? firstRelation(session.table) : null;
  const methodLabels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    other: "Otro",
  };
  const method = methodLabels[String(payload.payment_method)] ?? "Pago";
  const received = Number(payload.received_cents ?? 0);
  const change = Number(payload.change_cents ?? 0);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-5 flex max-w-md items-center justify-between">
        <Button asChild variant="ghost">
          <Link href="/cash">
            <ArrowLeft /> Caja
          </Link>
        </Button>
        <PrintReceiptButton />
      </div>
      <article
        id="sale-receipt"
        className="receipt-paper mx-auto w-full max-w-[80mm] bg-white p-5 font-mono text-[12px] leading-5 text-black shadow-xl"
      >
        <header className="text-center">
          <h1 className="text-lg font-bold">
            {relationText(branch, "name") ?? "Marisquería OS"}
          </h1>
          {relationText(branch, "phone") && (
            <p>Tel. {relationText(branch, "phone")}</p>
          )}
          <p className="mt-2 text-[10px] tracking-widest">TICKET DE VENTA</p>
        </header>
        <div className="my-3 border-y border-dashed border-black py-2">
          <p>Folio: {receipt.folio}</p>
          <p>Mesa: {relationText(table, "name") ?? "Venta mostrador"}</p>
          <p>
            {new Intl.DateTimeFormat("es-MX", {
              dateStyle: "short",
              timeStyle: "medium",
              timeZone: "America/Mexico_City",
            }).format(new Date(receipt.issued_at))}
          </p>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <div className="flex justify-between gap-3">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatMoney(item.total_cents)}</span>
              </div>
              <p className="text-[10px] text-slate-600">
                {formatMoney(item.unit_price_cents)} c/u
              </p>
            </div>
          ))}
        </div>
        <div className="my-3 space-y-1 border-y border-dashed border-black py-2">
          <TicketRow label="Subtotal" value={Number(receipt.subtotal_cents)} />
          {Number(receipt.discount_cents) > 0 && (
            <TicketRow
              label="Descuento"
              value={-Number(receipt.discount_cents)}
            />
          )}
          <TicketRow
            label="Impuestos incluidos"
            value={Number(receipt.tax_cents)}
          />
          {Number(receipt.tip_cents) > 0 && (
            <TicketRow label="Propina" value={Number(receipt.tip_cents)} />
          )}
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>TOTAL</span>
            <span>{formatMoney(Number(receipt.total_cents))}</span>
          </div>
        </div>
        <div>
          <p>Método: {method}</p>
          {received > 0 && <p>Recibido: {formatMoney(received)}</p>}
          {change > 0 && <p>Cambio: {formatMoney(change)}</p>}
        </div>
        <footer className="mt-5 text-center">
          <p>Gracias por tu visita.</p>
          <p className="mt-3 text-[9px]">Este ticket no es un CFDI.</p>
        </footer>
      </article>
    </main>
  );
}

function isReceiptItem(value: unknown): value is ReceiptItem {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    "quantity" in value &&
    "unit_price_cents" in value &&
    "total_cents" in value,
  );
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object"
    ? (relation as Record<string, unknown>)
    : null;
}

function relationText(value: Record<string, unknown> | null, key: string) {
  return value && typeof value[key] === "string" ? String(value[key]) : null;
}

function TicketRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );
}
