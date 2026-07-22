"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <Card className="max-w-lg">
        <CardHeader>
          <span className="bg-destructive/10 text-destructive grid size-11 place-items-center rounded-xl">
            <AlertTriangle />
          </span>
          <CardTitle className="mt-3">No pudimos cargar la operación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-5 text-sm leading-6">
            Comprueba que la migración y el seed fueron aplicados al proyecto
            correcto de Supabase.
          </p>
          <Button onClick={reset}>
            <RotateCcw /> Reintentar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
