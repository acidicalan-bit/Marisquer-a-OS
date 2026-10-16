import {
  ChefHat,
  CircleDollarSign,
  LogOut,
  Store,
  UsersRound,
  UtensilsCrossed,
  Wifi,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { logoutAction } from "@/app/login/actions";
import { MenuList } from "@/components/dashboard/menu-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableFloor } from "@/components/dashboard/table-floor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiConcierge } from "@/components/assistant/ai-concierge";
import { WaiterOrderComposer } from "@/components/dashboard/waiter-order-composer";
import { WaiterOrderBoard, type WaiterOrder } from "@/components/dashboard/waiter-order-board";
import { WaiterCheckoutPanel, type WaiterAccount } from "@/components/dashboard/waiter-checkout-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Operación" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const settingsResult = await supabase
    .from("sales_assistant_settings")
    .select("lookback_days")
    .maybeSingle();
  const lookbackDays = Math.min(
    365,
    Math.max(7, Number(settingsResult.data?.lookback_days ?? 30)),
  );
  const recommendationEnd = new Date();
  const recommendationStart = new Date(
    recommendationEnd.getTime() - lookbackDays * 86_400_000,
  );
  const [
    profileResult,
    tablesResult,
    menuResult,
    ordersResult,
    adminPermissionResult,
    cashPermissionResult,
    paymentPermissionResult,
    recommendationResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "full_name, employee_number, branch:branches!user_profiles_branch_organization_fkey(name), role:roles!user_profiles_role_organization_fkey(code)",
      )
      .eq("id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("tables")
      .select("id, name, capacity, status, section:restaurant_sections(name)")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select(
        "id, name, description, image_url, price_cents, is_available, category_id, category:menu_categories(name)",
      )
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("orders")
      .select("id, folio, status, total_cents, submitted_at, session:table_sessions(table:tables(name)), items:order_items(id, quantity, status, notes, allergy_alert, menu_item:menu_items(name))")
      .eq("waiter_id", auth.user.id)
      .in("status", ["submitted", "in_progress", "ready"])
      .order("submitted_at", { ascending: false })
      .limit(16),
    supabase.rpc("has_permission", { permission_code: "menu.manage" }),
    supabase.rpc("has_permission", { permission_code: "cash.manage" }),
    supabase.rpc("has_permission", { permission_code: "payments.collect" }),
    supabase.rpc("menu_performance", {
      requested_start: recommendationStart.toISOString(),
      requested_end: recommendationEnd.toISOString(),
    }),
  ]);

  if (profileResult.error || tablesResult.error || menuResult.error || ordersResult.error) {
    throw new Error(
      "No se pudo cargar el contexto de la sucursal. Revisa las migraciones y las políticas RLS.",
    );
  }

  const waiterAccountsResult = paymentPermissionResult.data
    ? await supabase.rpc("list_waiter_accounts")
    : { data: [], error: null };
  if (waiterAccountsResult.error) {
    throw new Error("No se pudieron cargar las cuentas listas para cobro.");
  }
  const waiterAccounts: WaiterAccount[] = (
    (waiterAccountsResult.data ?? []) as unknown as Array<{
      table_session_id: string;
      table_name: string;
      session_status: string;
      due_cents: number | string;
    }>
  ).map((account) => ({
      sessionId: String(account.table_session_id),
      tableName: String(account.table_name),
      status: String(account.session_status),
      dueCents: Number(account.due_cents),
    }));

  const profile = profileResult.data;
  const tables = (tablesResult.data ?? []).map((table) => ({
    id: String(table.id),
    name: String(table.name),
    capacity: Number(table.capacity),
    status: String(table.status),
    section: firstRelation(table.section),
  }));
  const menu = (menuResult.data ?? []).map((item) => ({
    id: String(item.id),
    name: String(item.name),
    price_cents: Number(item.price_cents),
    is_available: Boolean(item.is_available),
    category: firstRelation(item.category),
    category_id: String(item.category_id ?? "uncategorized"),
    description: String(item.description ?? ""),
    image_url: item.image_url,
  }));
  const available = menu.filter((item) => item.is_available).length;
  const recommendation = (
    (recommendationResult.data ?? []) as Array<{
      item_name: string;
      units_sold: number;
      gross_margin_basis_points: number;
      recommendation_score: number;
    }>
  )
    .sort(
      (left, right) =>
        Number(right.recommendation_score) - Number(left.recommendation_score),
    )
    .find((item) => Number(item.recommendation_score) > 0);
  const recommendationAvailable = !recommendationResult.error;
  const fullName =
    typeof profile?.full_name === "string" ? profile.full_name : null;
  const branch = firstRelation(profile?.branch);
  const assignedRole = relation(profile?.role)?.code;
  const canTakeOrders = ["administrator", "manager", "captain", "waiter"].includes(String(assignedRole ?? ""));
  const orderTables = tables.map((table) => ({ ...table, sectionName: table.section?.name ?? "Salón" }));
  const orderMenu = menu.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    priceCents: item.price_cents,
    categoryId: item.category_id,
    categoryName: item.category?.name ?? "Sin categoría",
    imageUrl: item.image_url,
    available: item.is_available,
  }));
  const myOrders: WaiterOrder[] = (ordersResult.data ?? []).map((order) => ({
    id: order.id,
    folio: Number(order.folio),
    status: order.status,
    totalCents: Number(order.total_cents),
    submittedAt: order.submitted_at,
    tableName: relationName(relation(order.session)?.table) ?? "Mesa",
    items: (order.items ?? []).map((line) => ({
      id: line.id,
      name: relationName(line.menu_item) ?? "Producto",
      quantity: line.quantity,
      status: line.status,
      notes: line.notes,
      allergy: line.allergy_alert,
    })),
  }));
  const initials = (fullName ?? auth.user.email ?? "MO")
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="dashboard-page min-h-screen">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl">
              <Store className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Marisquería OS</p>
              <p className="text-slate-700 text-xs font-medium">
                {branch?.name ?? "Sucursal asignada"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-card hidden gap-1.5 sm:flex">
              <Wifi className="size-3" /> Conectado
            </Badge>
            <Avatar className="size-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {adminPermissionResult.data && (
              <Button
                asChild
                size="icon"
                variant="ghost"
                aria-label="Abrir administración"
              >
                <Link href="/admin">
                  <Settings />
                </Link>
              </Button>
            )}
            {cashPermissionResult.data && (
              <Button
                asChild
                size="icon"
                variant="ghost"
                aria-label="Ver ventas"
              >
                <Link href="/cash">
                  <CircleDollarSign />
                </Link>
              </Button>
            )}
            <form action={logoutAction}>
              <Button size="icon" variant="ghost" aria-label="Cerrar sesión">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7">
          <p className="text-primary text-sm font-medium">Operación · Hoy</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Buen servicio, {fullName?.split(" ")[0] ?? "equipo"}.
          </h1>
          <p className="text-slate-700 mt-2">
            Vista inicial de mesas y menú autorizados por tu sucursal.
          </p>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Mesas"
            value={tables.length}
            detail="configuradas"
            icon={UtensilsCrossed}
          />
          <StatCard
            label="Disponibles"
            value={tables.filter((table) => table.status === "free").length}
            detail="listas para abrir"
            icon={UsersRound}
          />
          <StatCard
            label="Productos"
            value={available}
            detail="disponibles ahora"
            icon={ChefHat}
          />
          <StatCard
            label="Venta abierta"
            value="$0"
            detail={
              cashPermissionResult.data
                ? "abrir caja en la barra superior"
                : "visible para caja"
            }
            icon={CircleDollarSign}
          />
        </section>
        <section className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-r from-teal-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl shadow-teal-950/10 sm:flex sm:items-center sm:gap-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-300/15 text-teal-300">
            <Sparkles className="size-6" />
          </span>
          <div className="mt-4 flex-1 sm:mt-0">
            <p className="text-xs font-semibold tracking-[.18em] text-teal-300 uppercase">
              Sugerencia de venta inteligente
            </p>
            <p className="mt-1 text-lg font-semibold">
              {recommendation
                ? `Puedes recomendar ${recommendation.item_name}.`
                : recommendationAvailable
                  ? "Las sugerencias aparecerán con ventas, recetas y margen suficientes."
                  : "No se pudo calcular una sugerencia confiable."}
            </p>
            {recommendation && (
              <p className="mt-1 text-sm text-white/80">
                {recommendation.units_sold} vendidos · margen estimado{" "}
                {(
                  Number(recommendation.gross_margin_basis_points) / 100
                ).toFixed(1)}
                %
              </p>
            )}
          </div>
          <Badge className="mt-4 bg-white/10 text-white hover:bg-white/10 sm:mt-0">
            Últimos {lookbackDays} días
          </Badge>
        </section>
        {canTakeOrders ? <Tabs defaultValue="new-order" className="mt-7 space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-card p-1.5 shadow-sm sm:max-w-3xl sm:grid-cols-4">
            <TabsTrigger value="new-order" className="min-h-12 min-w-0 whitespace-normal break-words rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight sm:text-sm">Nuevo pedido</TabsTrigger>
            <TabsTrigger value="orders" className="min-h-12 min-w-0 whitespace-normal break-words rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight sm:text-sm">Mis comandas</TabsTrigger>
            <TabsTrigger value="checkout" className="min-h-12 min-w-0 whitespace-normal break-words rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight sm:text-sm">Cobrar cuenta · {waiterAccounts.length}</TabsTrigger>
            <TabsTrigger value="floor" className="min-h-12 min-w-0 whitespace-normal break-words rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight sm:text-sm">Salón y carta</TabsTrigger>
          </TabsList>
          <TabsContent value="new-order">
            <WaiterOrderComposer tables={orderTables} menu={orderMenu} initialOrderId={randomUUID()} initialEventId={randomUUID()} deviceId={randomUUID()} />
          </TabsContent>
          <TabsContent value="orders"><WaiterOrderBoard orders={myOrders} /></TabsContent>
          <TabsContent value="checkout"><WaiterCheckoutPanel accounts={waiterAccounts} /></TabsContent>
          <TabsContent value="floor" className="grid gap-6 lg:grid-cols-3"><TableFloor tables={tables} /><MenuList items={menu} /></TabsContent>
        </Tabs> : <section className="mt-7 grid gap-6 lg:grid-cols-3"><TableFloor tables={tables} /><MenuList items={menu} /></section>}
      </div>
      <AiConcierge />
    </main>
  );
}

function firstRelation(value: unknown): { name: string } | null {
  const relation = Array.isArray(value) ? value[0] : value;
  if (
    relation &&
    typeof relation === "object" &&
    "name" in relation &&
    typeof relation.name === "string"
  ) {
    return { name: relation.name };
  }
  return null;
}

function relation(value: unknown): Record<string, unknown> | null {
  const current = Array.isArray(value) ? value[0] : value;
  return current && typeof current === "object" ? current as Record<string, unknown> : null;
}

function relationName(value: unknown): string | null {
  return typeof relation(value)?.name === "string" ? String(relation(value)?.name) : null;
}
