import { ChefHat, Clock3, LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { updateKitchenItemStatus } from "@/app/kitchen/actions";
import { logoutAction } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: items, error } = await supabase
    .from("order_items")
    .select(
      "id, quantity, status, notes, allergy_alert, created_at, menu_item:menu_items(name), order:orders(folio), station:preparation_stations(name)",
    )
    .in("status", ["pending", "received", "preparing", "ready"])
    .order("created_at");
  if (error) throw error;
  const renderedAt = new Date().getTime();
  return (
    <main className="min-h-screen bg-[#071f29] text-white">
      <header className="sticky top-0 z-20 flex h-17 items-center gap-3 border-b border-white/10 bg-[#071f29]/90 px-4 backdrop-blur-xl sm:px-7">
        <span className="grid size-10 place-items-center rounded-xl bg-orange-400 text-slate-950">
          <ChefHat className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Cocina en vivo</p>
          <p className="text-xs text-white/45">Comandas sincronizadas</p>
        </div>
        <form action={logoutAction}>
          <Button size="icon" variant="ghost">
            <LogOut />
          </Button>
        </form>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-7">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-orange-300">Producción</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {items?.length ?? 0} preparaciones activas
            </h1>
          </div>
          <Badge className="bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/15">
            En tiempo real
          </Badge>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(items ?? []).map((item) => {
            const minutes = Math.max(
              0,
              Math.floor(
                (renderedAt - new Date(item.created_at).getTime()) / 60000,
              ),
            );
            return (
              <article
                key={item.id}
                className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-white/40">
                      Orden #{relationValue(item.order, "folio")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {item.quantity}× {relationValue(item.menu_item, "name")}
                    </h2>
                  </div>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${minutes > 20 ? "bg-red-400/15 text-red-300" : "bg-white/8 text-white/65"}`}
                  >
                    <Clock3 className="size-3" />
                    {minutes} min
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/45">
                  {relationValue(item.station, "name")}
                </p>
                {item.allergy_alert && (
                  <p className="mt-3 rounded-xl bg-red-400/15 p-3 text-sm font-medium text-red-200">
                    Alergia: {item.allergy_alert}
                  </p>
                )}
                {item.notes && (
                  <p className="mt-3 rounded-xl bg-white/6 p-3 text-sm text-white/70">
                    {item.notes}
                  </p>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <StatusButton
                    id={item.id}
                    status="preparing"
                    label="Preparar"
                  />
                  <StatusButton
                    id={item.id}
                    status="ready"
                    label="Marcar listo"
                  />
                </div>
              </article>
            );
          })}
          {items?.length === 0 && (
            <div className="col-span-full grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/15 text-white/35">
              No hay comandas pendientes.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function StatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updateKitchenItemStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button
        type="submit"
        className="w-full rounded-xl bg-white/10 hover:bg-orange-400 hover:text-slate-950"
      >
        {label}
      </Button>
    </form>
  );
}
function relationValue(value: unknown, key: string) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && key in item
    ? String(item[key as keyof typeof item])
    : "—";
}
