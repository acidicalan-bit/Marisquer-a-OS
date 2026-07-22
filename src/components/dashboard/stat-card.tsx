import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight">
            {value}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
        </div>
        <span className="bg-secondary text-secondary-foreground grid size-10 place-items-center rounded-xl">
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
