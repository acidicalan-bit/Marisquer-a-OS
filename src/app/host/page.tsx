import { Armchair, LogOut, Users } from "lucide-react";

import { logoutAction } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HOST_ROLE_CODES, requireRolePage } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";
export default async function HostPage() {
  const { supabase } = await requireRolePage(HOST_ROLE_CODES);
  const { data: tables, error } = await supabase
    .from("tables")
    .select("id,name,capacity,status,section:restaurant_sections(name)")
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw error;
  return (
    <main className="min-h-screen bg-[#f6f3ec]">
      <header className="flex h-17 items-center gap-3 border-b bg-white/80 px-4 backdrop-blur sm:px-7">
        <span className="grid size-10 place-items-center rounded-xl bg-teal-900 text-white">
          <Armchair className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Recepción</p>
          <p className="text-xs text-slate-500">Disponibilidad del salón</p>
        </div>
        <form action={logoutAction}>
          <Button size="icon" variant="ghost">
            <LogOut />
          </Button>
        </form>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-7">
        <div className="mb-6">
          <p className="text-sm font-semibold text-teal-700">Anfitrión</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Elige la mejor mesa.
          </h1>
        </div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(tables ?? []).map((table) => (
            <article
              key={table.id}
              className={`rounded-3xl border p-5 shadow-sm ${table.status === "free" ? "border-emerald-100 bg-white" : "border-slate-200 bg-slate-100"}`}
            >
              <div className="flex justify-between">
                <span
                  className={`size-3 rounded-full ${table.status === "free" ? "bg-emerald-500" : "bg-amber-400"}`}
                />
                <Badge variant="outline" className="bg-white/60">
                  {relationName(table.section)}
                </Badge>
              </div>
              <h2 className="mt-8 text-xl font-semibold">{table.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <Users className="size-4" />
                {table.capacity} personas
              </p>
              <p className="mt-4 text-xs font-medium tracking-wide text-slate-400 uppercase">
                {table.status === "free" ? "Disponible" : table.status}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
function relationName(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && "name" in item
    ? String(item.name)
    : "Salón";
}
