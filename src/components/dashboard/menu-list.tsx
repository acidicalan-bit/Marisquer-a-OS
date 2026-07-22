import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MenuItem = {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  category: { name: string } | null;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Menú disponible</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            No hay productos visibles.
          </p>
        ) : (
          items.slice(0, 8).map((item) => (
            <div
              key={item.id}
              className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-xl px-2 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">
                  {item.category?.name ?? "Sin categoría"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">
                  {money.format(item.price_cents / 100)}
                </p>
                <Badge
                  variant={item.is_available ? "secondary" : "destructive"}
                  className="mt-1"
                >
                  {item.is_available ? "Disponible" : "Agotado"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
