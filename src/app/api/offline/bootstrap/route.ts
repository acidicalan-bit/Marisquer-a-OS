import { NextResponse } from "next/server";

import type { OfflineSnapshot } from "@/lib/offline/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const profileResult = await supabase
    .from("user_profiles")
    .select(
      "id, full_name, branch_id, is_active, role:roles!user_profiles_role_organization_fkey(code), branch:branches(name)",
    )
    .eq("id", auth.user.id)
    .single();
  const profile = profileResult.data;
  if (profileResult.error || !profile?.is_active || !profile.branch_id) {
    return NextResponse.json(
      { error: "Perfil no disponible." },
      { status: 403 },
    );
  }

  const role = relation(profile.role as { code: string } | { code: string }[]);
  const privilegedOrderReader = ["administrator", "manager", "cashier"].includes(role?.code ?? "");
  let ordersQuery = supabase
    .from("orders")
    .select("id,folio,status,submitted_at,total_cents,session:table_sessions!inner(waiter_id,table:tables(name)),items:order_items(id,quantity,status,notes,allergy_alert,menu_item:menu_items(name))")
    .eq("branch_id", profile.branch_id)
    .in("status", ["submitted", "in_progress", "ready"])
    .order("submitted_at", { ascending: false })
    .limit(16);
  if (!privilegedOrderReader) {
    ordersQuery = ordersQuery.eq("waiter_id", auth.user.id);
  }

  const [tablesResult, menuResult, kitchenResult, ordersResult] = await Promise.all([
    supabase
      .from("tables")
      .select("id,name,capacity,status,version")
      .eq("branch_id", profile.branch_id)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select("id,category_id,station_id,name,price_cents,is_available,image_url,category:menu_categories(name)")
      .eq("branch_id", profile.branch_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("order_items")
      .select(
        "id,order_id,quantity,notes,status,version,created_at,menu_item:menu_items(name),station:preparation_stations!inner(sends_to_kitchen)",
      )
      .eq("branch_id", profile.branch_id)
      .in("status", ["received", "preparing", "ready"])
      .eq("station.sends_to_kitchen", true)
      .order("created_at"),
    ordersQuery,
  ]);

  if (tablesResult.error || menuResult.error || kitchenResult.error || ordersResult.error) {
    return NextResponse.json(
      { error: "No se pudo preparar el modo sin conexión." },
      { status: 503 },
    );
  }

  const branch = relation(
    profile.branch as { name: string } | { name: string }[],
  );
  const snapshot: OfflineSnapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    user: {
      id: profile.id,
      name: profile.full_name,
      roleCode: role?.code ?? "unknown",
      branchId: profile.branch_id,
      branchName: branch?.name ?? "Sucursal",
    },
    tables: (tablesResult.data ?? []).map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      status: table.status,
      version: table.version,
    })),
    menu: (menuResult.data ?? []).map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      stationId: item.station_id,
      name: item.name,
      priceCents: Number(item.price_cents),
      available: item.is_available,
      categoryName: relation(item.category as { name: string } | { name: string }[] | null)?.name ?? "Sin categoría",
      imageUrl: item.image_url,
    })),
    kitchenItems: (kitchenResult.data ?? []).map((item) => ({
      id: item.id,
      orderId: item.order_id,
      menuItemName:
        relation(item.menu_item as { name: string } | { name: string }[] | null)
          ?.name ?? "Producto",
      quantity: item.quantity,
      notes: item.notes,
      status: item.status,
      version: item.version,
      createdAt: item.created_at,
    })),
    orders: (ordersResult.data ?? []).map((order) => {
      const session = relation(order.session as { table: { name: string } | { name: string }[] | null } | { table: { name: string } | { name: string }[] | null }[] | null);
      return {
        id: order.id,
        folio: Number(order.folio),
        status: order.status,
        submittedAt: order.submitted_at,
        tableName: relation(session?.table as { name: string } | { name: string }[] | null)?.name ?? "Mesa",
        totalCents: Number(order.total_cents),
        items: (order.items ?? []).map((line) => ({
          id: line.id,
          name: relation(line.menu_item as { name: string } | { name: string }[] | null)?.name ?? "Producto",
          quantity: line.quantity,
          status: line.status,
          notes: line.notes,
          allergy: line.allergy_alert,
        })),
      };
    }),
  };

  return NextResponse.json(snapshot, {
    headers: { "cache-control": "no-store" },
  });
}
