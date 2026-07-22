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

import { logoutAction } from "@/app/login/actions";
import { MenuList } from "@/components/dashboard/menu-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableFloor } from "@/components/dashboard/table-floor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiConcierge } from "@/components/assistant/ai-concierge";

export const metadata: Metadata = { title: "Operación" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const recommendationEnd = new Date();
  const recommendationStart = new Date(recommendationEnd);
  recommendationStart.setDate(recommendationStart.getDate() - 30);
  const [
    profileResult,
    tablesResult,
    menuResult,
    adminPermissionResult,
    recommendationResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, employee_number, branch:branches(name)")
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
        "id, name, price_cents, is_available, category:menu_categories(name)",
      )
      .is("deleted_at", null)
      .order("sort_order"),
    supabase.rpc("has_permission", { permission_code: "menu.manage" }),
    supabase.rpc("menu_performance", {
      requested_start: recommendationStart.toISOString(),
      requested_end: recommendationEnd.toISOString(),
    }),
  ]);

  if (profileResult.error || tablesResult.error || menuResult.error) {
    throw new Error(
      "No se pudo cargar el contexto de la sucursal. Revisa las migraciones y las políticas RLS.",
    );
  }

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
  const fullName =
    typeof profile?.full_name === "string" ? profile.full_name : null;
  const branch = firstRelation(profile?.branch);
  const initials = (fullName ?? auth.user.email ?? "MO")
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl">
              <Store className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Marisquería OS</p>
              <p className="text-muted-foreground text-xs">
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
          <p className="text-muted-foreground mt-2">
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
            detail="caja en fase 3"
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
                ? `Hoy puedes recomendar ${recommendation.item_name}.`
                : "Las sugerencias aparecerán con las primeras ventas."}
            </p>
            {recommendation && (
              <p className="mt-1 text-sm text-white/50">
                {recommendation.units_sold} vendidos · margen estimado{" "}
                {(
                  Number(recommendation.gross_margin_basis_points) / 100
                ).toFixed(1)}
                %
              </p>
            )}
          </div>
          <Badge className="mt-4 bg-white/10 text-white hover:bg-white/10 sm:mt-0">
            Actualizado en tiempo real
          </Badge>
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <TableFloor tables={tables} />
          <MenuList items={menu} />
        </section>
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
