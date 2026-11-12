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
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, branch_id, branch:branches(name)")
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
      .limit(8),
  ]);
  const failed = [
    profileResult,
    shiftResult,
    sessionsResult,
    receiptsResult,
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

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
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
