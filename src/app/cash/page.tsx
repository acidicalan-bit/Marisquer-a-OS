import {
  ArrowLeft,
  Banknote,
  CircleDollarSign,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { RefreshCashButton } from "@/components/cash/refresh-cash-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CASH_ROLE_CODES, requireRolePage } from "@/lib/auth/role-access";
import { formatMoney } from "@/lib/cash/money";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

export default async function CashPage() {
  const { supabase, user } = await requireRolePage(CASH_ROLE_CODES);
  const [
    profileResult,
    shiftResult,
    sessionsResult,
    receiptsResult,
    todayReceiptsResult,
    todayPaymentsResult,
    pastOrdersResult,
    waitersResult,
    shiftsHistoryResult,
    shiftPaymentsHistoryResult,
    cashRegistersResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "full_name, branch_id, branch:branches!user_profiles_branch_organization_fkey(name)",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("shifts")
      .select("id, name, opened_at, closed_at, status")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("table_sessions")
      .select("id, status, guest_count, opened_at, table:tables(name)")
      .in("status", ["open", "check_requested", "paying"])
      .order("opened_at"),
    supabase
      .from("receipts")
      .select("id, folio, total_cents, issued_at")
      .order("issued_at", { ascending: false })
      .limit(20),
    supabase
      .from("receipts")
      .select(
        "id, folio, subtotal_cents, tax_cents, discount_cents, tip_cents, total_cents, payload, issued_at, session:table_sessions(waiter_id, table:tables(name))",
      )
      .gte("issued_at", dayRange.start)
      .lt("issued_at", dayRange.end)
      .order("issued_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select(
        "id, method, amount_cents, paid_at, table_session_id, session:table_sessions(table:tables(name))",
      )
      .eq("status", "completed")
      .gte("paid_at", dayRange.start)
      .lt("paid_at", dayRange.end)
      .order("paid_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select(
        "id, folio, status, subtotal_cents, tax_cents, total_cents, waiter_id, submitted_at, closed_at, created_at, session:table_sessions(table:tables(name)), items:order_items(quantity, status, notes, allergy_alert, menu_item:menu_items(name))",
      )
      .neq("status", "draft")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("user_profiles").select("id, full_name").order("full_name"),
    supabase
      .from("shifts")
      .select("id, name, opened_at, closed_at, status")
      .order("opened_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, shift_id, method, amount_cents, paid_at, status")
      .eq("status", "completed")
      .order("paid_at", { ascending: false })
      .limit(500),
    supabase
      .from("cash_registers")
      .select("id, shift_id, opening_amount_cents, closing_amount_cents, expected_amount_cents, status, opened_at, closed_at")
      .order("opened_at", { ascending: false })
      .limit(20),
  ]);
  const failed = [
    profileResult,
    shiftResult,
    sessionsResult,
    receiptsResult,
    todayReceiptsResult,
    todayPaymentsResult,
    pastOrdersResult,
    waitersResult,
    shiftsHistoryResult,
    shiftPaymentsHistoryResult,
    cashRegistersResult,
  ].find((result) => result.error);
  if (failed?.error)
    throw new Error(`No se pudo cargar caja: ${failed.error.message}`);
  if (!profileResult.data)
    throw new Error("No se encontró el perfil activo de caja.");

  const sessions = sessionsResult.data ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const [ordersResult, discountsResult, paymentsResult] = sessionIds.length
    ? await Promise.all([
        supabase
          .from("orders")
          .select("table_session_id, total_cents, status")
          .in("table_session_id", sessionIds)
          .neq("status", "cancelled"),
        supabase
          .from("discounts")
          .select("table_session_id, amount_cents, authorized_by")
          .in("table_session_id", sessionIds)
          .not("authorized_by", "is", null),
        supabase
          .from("payments")
          .select("table_session_id, amount_cents, status")
          .in("table_session_id", sessionIds)
          .eq("status", "completed"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (ordersResult.error || discountsResult.error || paymentsResult.error)
    throw new Error("No se pudieron calcular los saldos de las cuentas.");

  const shiftPaymentsResult = shiftResult.data
    ? await supabase
        .from("payments")
        .select("method, amount_cents")
        .eq("shift_id", shiftResult.data.id)
        .eq("status", "completed")
    : { data: [], error: null };
  if (shiftPaymentsResult.error)
    throw new Error("No se pudieron cargar las ventas del turno.");
  const shiftPayments = shiftPaymentsResult.data ?? [];
  const shiftSalesCents = shiftPayments.reduce(
    (sum, payment) => sum + Number(payment.amount_cents),
    0,
  );

  const dueBySession = new Map<string, number>();
  for (const session of sessions) {
    const ordered = (ordersResult.data ?? [])
      .filter((order) => order.table_session_id === session.id)
      .reduce((sum, order) => sum + Number(order.total_cents), 0);
    const discounted = (discountsResult.data ?? [])
      .filter((discount) => discount.table_session_id === session.id)
      .reduce((sum, discount) => sum + Number(discount.amount_cents), 0);
    const paid = (paymentsResult.data ?? [])
      .filter((payment) => payment.table_session_id === session.id)
      .reduce((sum, payment) => sum + Number(payment.amount_cents), 0);
    dueBySession.set(session.id, Math.max(ordered - discounted - paid, 0));
  }

  const profile = profileResult.data;
  const shift = shiftResult.data;
  const branchName = relationName(profile.branch) ?? "Sucursal";
  const dailyReceipts = (todayReceiptsResult.data ?? []).map((receipt) => {
    const payload = recordValue(receipt.payload);
    return {
      id: receipt.id,
      folio: receipt.folio,
      tableName: relationName(
        (receipt as { session?: unknown }).session &&
          (receipt as { session?: { table?: unknown } }).session?.table,
      ) ?? "Mostrador",
      waiterId: String(
        ((receipt as { session?: { waiter_id?: string } }).session?.waiter_id ?? ""),
      ),
      subtotalCents: Number(receipt.subtotal_cents),
      taxCents: Number(receipt.tax_cents),
      discountCents: Number(receipt.discount_cents),
      tipCents: Number(receipt.tip_cents),
      totalCents: Number(receipt.total_cents),
      method: paymentMethodName(payload.payment_method),
      issuedAt: receipt.issued_at,
    };
  });
  const dailyPayments = (todayPaymentsResult.data ?? []).map((payment) => ({
    id: payment.id,
    method: paymentMethodName(payment.method),
    amountCents: Number(payment.amount_cents),
    tableName: relationName(
      (payment as { session?: unknown }).session &&
        (payment as { session?: { table?: unknown } }).session?.table,
    ) ?? "Mostrador",
    paidAt: payment.paid_at,
  }));
  const waiterNames = new Map(
    (waitersResult.data ?? []).map((waiter) => [waiter.id, waiter.full_name]),
  );
  const waiterSales = dailyReceipts.reduce<Record<string, { name: string; totalCents: number; receipts: number }>>(
    (result, receipt) => {
      const key = receipt.waiterId || "unassigned";
      const current = result[key] ?? {
        name: waiterNames.get(key) ?? "Sin mesero asignado",
        totalCents: 0,
        receipts: 0,
      };
      current.totalCents += receipt.totalCents;
      current.receipts += 1;
      result[key] = current;
      return result;
    },
    {},
  );
  const pastOrders = (pastOrdersResult.data ?? []).map((order) => ({
    id: order.id,
    folio: Number(order.folio),
    status: order.status,
    totalCents: Number(order.total_cents),
    waiterName: waiterNames.get(order.waiter_id) ?? "Mesero no identificado",
    tableName: relationName(
      (order as { session?: { table?: unknown } }).session?.table,
    ) ?? "Mostrador",
    createdAt: order.created_at,
    closedAt: order.closed_at,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          quantity: Number(item.quantity),
          name: relationName(item.menu_item) ?? "Producto",
          status: item.status,
        }))
      : [],
  }));
  const shiftsHistory = (shiftsHistoryResult.data ?? []).map((shift) => {
    const shiftPayments = (shiftPaymentsHistoryResult.data ?? []).filter(
      (payment) => payment.shift_id === shift.id,
    );
    const register = (cashRegistersResult.data ?? []).find(
      (candidate) => candidate.shift_id === shift.id,
    );
    const salesCents = shiftPayments.reduce(
      (sum, payment) => sum + Number(payment.amount_cents),
      0,
    );
    const byMethod = shiftPayments.reduce<Record<string, number>>(
      (result, payment) => {
        const method = paymentMethodName(payment.method);
        result[method] = (result[method] ?? 0) + Number(payment.amount_cents);
        return result;
      },
      {},
    );
    return {
      id: shift.id,
      name: shift.name,
      status: shift.status,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      salesCents,
      payments: shiftPayments.length,
      byMethod,
      openingCents: Number(register?.opening_amount_cents ?? 0),
      closingCents: register?.closing_amount_cents == null ? null : Number(register.closing_amount_cents),
      expectedCents: register?.expected_amount_cents == null ? null : Number(register.expected_amount_cents),
    };
  });
  const dailyTotals = dailyReceipts.reduce(
    (totals, receipt) => ({
      subtotalCents: totals.subtotalCents + receipt.subtotalCents,
      taxCents: totals.taxCents + receipt.taxCents,
      discountCents: totals.discountCents + receipt.discountCents,
      tipCents: totals.tipCents + receipt.tipCents,
      totalCents: totals.totalCents + receipt.totalCents,
    }),
    { subtotalCents: 0, taxCents: 0, discountCents: 0, tipCents: 0, totalCents: 0 },
  );

  return (
    <main className="cash-page min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Button
            asChild
            size="icon"
            variant="ghost"
            aria-label="Volver a operación"
          >
            <Link href="/dashboard">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="grid size-10 place-items-center rounded-xl bg-teal-950 text-teal-200">
            <CircleDollarSign />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Ventas · {branchName}</p>
            <p className="truncate text-xs text-slate-500">
              {profile.full_name}
            </p>
          </div>
          <Badge variant={shift?.status === "open" ? "default" : "outline"}>
            {shift?.status === "open" ? "Turno abierto" : "Turno cerrado"}
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        <Tabs defaultValue="accounts" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-white p-1.5 shadow-sm">
            <TabsTrigger value="accounts" className="min-h-12 rounded-xl font-semibold">Cuentas · {sessions.filter((session) => (dueBySession.get(session.id) ?? 0) > 0).length}</TabsTrigger>
            <TabsTrigger value="register" className="min-h-12 rounded-xl font-semibold">Ventas del turno</TabsTrigger>
            <TabsTrigger value="tickets" className="min-h-12 rounded-xl font-semibold">Tickets</TabsTrigger>
          </TabsList>
          <TabsContent value="register" className="space-y-4">
        <SalesSummary
          receipts={dailyReceipts}
          payments={dailyPayments}
          totals={dailyTotals}
            waiterSales={Object.values(waiterSales).sort((a, b) => b.totalCents - a.totalCents)}
            pastOrders={pastOrders}
            shifts={shiftsHistory}
        />
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-teal-700">
                Turno operativo
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {shift?.status === "open" ? shift.name : shift ? `Último turno · ${shift.name}` : "No hay turnos registrados"}
              </h1>
              <p className="text-sm text-slate-500">
                {shift
                  ? `${shift.status === "open" ? "Abierto" : "Cerrado"} · inició ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(shift.opened_at))}${shift.closed_at ? ` · cerró ${new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(shift.closed_at))}` : ""}`
                  : "Un administrador debe abrir el turno antes de operar caja."}
              </p>
            </CardHeader>
            <CardContent>
              {shift ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <CashMetric
                    icon={Banknote}
                    label={shift.status === "open" ? "Ventas cobradas en este turno" : "Ventas del último turno"}
                    value={formatMoney(shiftSalesCents)}
                  />
                  <CashMetric
                    icon={ReceiptText}
                    label="Cobros confirmados"
                    value={String(shiftPayments.length)}
                  />
                  <p className="sm:col-span-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                    {shift.status === "open"
                      ? "Los meseros cobran desde su aplicación. El administrador abre y cierra el turno en la PC."
                      : "Consulta el cierre de este turno. Para abrir el siguiente, usa Administración en la PC."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  No hay turnos registrados. El administrador puede abrir uno desde Administración en la PC.
                  <Button asChild variant="outline" className="mt-3 min-h-11 w-full sm:w-auto">
                    <Link href="/admin">Ir a Administración</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
          </TabsContent>

          <TabsContent value="accounts">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                Cobro de cuentas
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Mesas con saldo
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Actualiza para consultar comandas o solicitudes de cuenta recientes.
              </p>
            </div>
            <RefreshCashButton />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions
              .filter((session) => (dueBySession.get(session.id) ?? 0) > 0)
              .map((session) => {
                const due = dueBySession.get(session.id) ?? 0;
                return (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {relationName(session.table) ?? "Mesa"}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {session.guest_count} comensales · {session.status}
                          </p>
                        </div>
                        <p className="text-2xl font-semibold text-teal-800">
                          {formatMoney(due)}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                        El mesero asignado confirma el cobro desde su aplicación. La PC conserva el resumen del turno y los tickets.
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            {!sessions.some(
              (session) => (dueBySession.get(session.id) ?? 0) > 0,
            ) && (
              <div className="col-span-full rounded-3xl border border-dashed bg-white p-12 text-center text-slate-500">
                No hay cuentas pendientes de cobro.
              </div>
            )}
          </div>
        </section>
          </TabsContent>

          <TabsContent value="tickets">
        <section>
          <h2 className="text-xl font-semibold">Tickets recientes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(receiptsResult.data ?? []).map((receipt) => (
              <Link
                key={receipt.id}
                href={`/cash/receipt/${receipt.id}`}
                className="min-h-20 rounded-2xl border bg-white p-4 transition hover:border-teal-300"
              >
                <p className="font-mono text-xs text-slate-500">
                  {receipt.folio}
                </p>
                <p className="mt-1 font-semibold">
                  {formatMoney(Number(receipt.total_cents))}
                </p>
              </Link>
            ))}
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" && "name" in relation
    ? String(relation.name)
    : null;
}

const mexicoCityTimeZone = "America/Mexico_City";

function getTodayRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: mexicoCityTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const start = new Date(`${date}T00:00:00-06:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const dayRange = getTodayRange();

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function paymentMethodName(value: unknown) {
  const names: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    other: "Otro",
  };
  return names[String(value ?? "other")] ?? "Otro";
}

type DailyReceipt = {
  id: string;
  folio: string;
  tableName: string;
  waiterId: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  method: string;
  issuedAt: string;
};

type DailyPayment = {
  id: string;
  method: string;
  amountCents: number;
  tableName: string;
  paidAt: string | null;
};

function SalesSummary({
  receipts,
  payments,
  totals,
  waiterSales,
  pastOrders,
  shifts,
}: {
  receipts: DailyReceipt[];
  payments: DailyPayment[];
  totals: {
    subtotalCents: number;
    taxCents: number;
    discountCents: number;
    tipCents: number;
    totalCents: number;
  };
  waiterSales: { name: string; totalCents: number; receipts: number }[];
  pastOrders: {
    id: string;
    folio: number;
    status: string;
    totalCents: number;
    waiterName: string;
    tableName: string;
    createdAt: string;
    closedAt: string | null;
    items: { quantity: number; name: string; status: string }[];
  }[];
  shifts: {
    id: string;
    name: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
    salesCents: number;
    payments: number;
    byMethod: Record<string, number>;
    openingCents: number;
    closingCents: number | null;
    expectedCents: number | null;
  }[];
}) {
  const byMethod = payments.reduce<Record<string, number>>((result, payment) => {
    result[payment.method] = (result[payment.method] ?? 0) + payment.amountCents;
    return result;
  }, {});
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: mexicoCityTimeZone,
  });
  const dateTime = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: mexicoCityTimeZone,
  });
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CashMetric icon={Banknote} label="Ventas de hoy" value={formatMoney(totals.totalCents)} />
        <CashMetric icon={ReceiptText} label="Cuentas cobradas" value={String(receipts.length)} />
        <CashMetric icon={CircleDollarSign} label="Descuentos" value={formatMoney(totals.discountCents)} />
        <CashMetric icon={Banknote} label="Propinas" value={formatMoney(totals.tipCents)} />
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="min-w-0">
          <CardHeader>
            <h2 className="text-xl font-semibold">Desglose de ventas</h2>
            <p className="text-sm text-slate-500">Cobros completados del día, por método de pago.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(byMethod).length ? Object.entries(byMethod).map(([method, amount]) => (
              <div key={method} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                <span className="truncate text-sm font-medium">{method}</span>
                <span className="shrink-0 font-semibold text-teal-800">{formatMoney(amount)}</span>
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Todavía no hay cobros registrados hoy.</p>}
            <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
              <span>Total sin impuesto adicional</span>
              <span>{formatMoney(totals.subtotalCents)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <h2 className="text-xl font-semibold">Cuentas pasadas</h2>
            <p className="text-sm text-slate-500">Tickets cobrados hoy, del más reciente al más antiguo.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {receipts.length ? receipts.map((receipt) => (
              <Link key={receipt.id} href={`/cash/receipt/${receipt.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-teal-300">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{receipt.tableName} · {receipt.folio}</span>
                  <span className="block truncate text-xs text-slate-500">{receipt.method} · {time.format(new Date(receipt.issuedAt))}</span>
                </span>
                <span className="shrink-0 font-semibold text-teal-800">{formatMoney(receipt.totalCents)}</span>
              </Link>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay cuentas cobradas hoy.</p>}
          </CardContent>
        </Card>
      </div>
      <Card className="min-w-0">
        <CardHeader>
          <h2 className="text-xl font-semibold">Historial de ventas del día</h2>
          <p className="text-sm text-slate-500">Cada cobro confirmado, con mesa, hora y método.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length ? payments.map((payment) => (
            <div key={payment.id} className="flex min-w-0 items-center justify-between gap-3 border-b py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{payment.tableName}</p>
                <p className="truncate text-xs text-slate-500">{payment.method} · {payment.paidAt ? time.format(new Date(payment.paidAt)) : "Hora no disponible"}</p>
              </div>
              <span className="shrink-0 font-semibold">{formatMoney(payment.amountCents)}</span>
            </div>
          )) : <p className="py-4 text-sm text-slate-500">No hay cobros confirmados hoy.</p>}
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <h2 className="text-xl font-semibold">Ventas por mesero</h2>
            <p className="text-sm text-slate-500">Cuentas cobradas hoy, agrupadas por el mesero de la mesa.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {waiterSales.length ? waiterSales.map((waiter) => (
              <div key={waiter.name} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{waiter.name}</span>
                  <span className="block text-xs text-slate-500">{waiter.receipts} cuenta{waiter.receipts === 1 ? "" : "s"}</span>
                </span>
                <span className="shrink-0 font-semibold text-teal-800">{formatMoney(waiter.totalCents)}</span>
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay ventas asignadas a meseros hoy.</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <h2 className="text-xl font-semibold">Ventas por turno</h2>
            <p className="text-sm text-slate-500">Resumen financiero de los últimos turnos registrados.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {shifts.length ? shifts.map((shift) => (
              <details key={shift.id} className="rounded-xl border p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{shift.name}</span>
                    <span className="block truncate text-xs text-slate-500">{dateTime.format(new Date(shift.openedAt))} · {shift.payments} cobros · {shift.status === "open" ? "Abierto" : "Cerrado"}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-teal-800">{formatMoney(shift.salesCents)}</span>
                </summary>
                <div className="mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                  <p>Fondo inicial: <strong>{formatMoney(shift.openingCents)}</strong></p>
                  <p>Esperado: <strong>{shift.expectedCents == null ? "Pendiente" : formatMoney(shift.expectedCents)}</strong></p>
                  <p>Cierre contado: <strong>{shift.closingCents == null ? "Pendiente" : formatMoney(shift.closingCents)}</strong></p>
                  <p className="sm:col-span-2">{Object.entries(shift.byMethod).map(([method, amount]) => `${method}: ${formatMoney(amount)}`).join(" · ") || "Sin desglose"}</p>
                </div>
              </details>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay turnos registrados.</p>}
          </CardContent>
        </Card>
      </div>
      <Card className="min-w-0">
        <CardHeader>
          <h2 className="text-xl font-semibold">Comandas pasadas</h2>
          <p className="text-sm text-slate-500">Consulta folio, mesa, mesero, estado y productos de las comandas recientes.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {pastOrders.length ? pastOrders.map((order) => (
            <details key={order.id} className="rounded-xl border p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">Comanda #{order.folio} · {order.tableName}</span>
                  <span className="block truncate text-xs text-slate-500">{order.waiterName} · {dateTime.format(new Date(order.closedAt ?? order.createdAt))} · {order.status}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatMoney(order.totalCents)}</span>
              </summary>
              <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                {order.items.length ? order.items.map((item, index) => <p key={`${order.id}-${index}`} className="flex justify-between gap-3"><span className="min-w-0 truncate">{item.quantity}× {item.name}</span><span className="shrink-0 text-slate-500">{item.status}</span></p>) : <p className="text-slate-500">Sin detalle de productos.</p>}
              </div>
            </details>
          )) : <p className="py-4 text-sm text-slate-500">No hay comandas pasadas para mostrar.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function CashMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon className="size-5 text-teal-700" />
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
