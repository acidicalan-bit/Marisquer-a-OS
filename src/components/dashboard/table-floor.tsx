import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RestaurantTable = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  section: { name: string } | null;
};

const statusLabel: Record<string, string> = {
  free: "Libre",
  reserved: "Reservada",
  seating: "Sentando",
  occupied: "Ocupada",
  waiting_food: "Esperando",
  food_ready: "Listo",
  eating: "Comiendo",
  check_requested: "Cuenta",
  paying: "Pagando",
  needs_cleaning: "Por limpiar",
  blocked: "Bloqueada",
};

export function TableFloor({
  tables,
  markTableCleanAction,
}: {
  tables: RestaurantTable[];
  markTableCleanAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Plano de mesas</CardTitle>
        <Badge variant="outline">En vivo</Badge>
      </CardHeader>
      <CardContent>
        {tables.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            No hay mesas visibles para esta sucursal.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => (
              <div key={table.id}>
                <button
                  type="button"
                  className="touch-target bg-card hover:border-primary/40 focus-visible:ring-ring min-h-28 w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2"
                >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold">{table.name}</span>
                  <span
                    className={`size-2.5 rounded-full ${table.status === "free" ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {table.section?.name ?? "Sin sección"} · {table.capacity}{" "}
                  lugares
                </p>
                <Badge
                  className="mt-4"
                  variant={table.status === "free" ? "secondary" : "outline"}
                >
                  {statusLabel[table.status] ?? table.status}
                </Badge>
                </button>
                {table.status === "needs_cleaning" && markTableCleanAction && (
                  <form action={markTableCleanAction} className="mt-2">
                    <input type="hidden" name="table_id" value={table.id} />
                    <button
                      type="submit"
                      className="min-h-11 w-full rounded-xl bg-teal-900 px-3 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                    >
                      Marcar mesa limpia
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
