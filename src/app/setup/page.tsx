import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicEnv } from "@/lib/env";

export default function SetupPage() {
  const configured = Boolean(getPublicEnv());
  const steps = [
    ["Repositorio aislado", true],
    ["Rama feat/fase-1-supabase", true],
    ["Variables públicas de Supabase", configured],
    ["Migración y seed aplicados", false],
    ["Primer usuario administrador", false],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Button asChild variant="ghost" className="mb-6">
        <Link href="/">
          <ArrowLeft /> Volver
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Estado de instalación</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map(([label, done]) => (
            <div
              key={label}
              className="bg-card flex min-h-12 items-center gap-3 rounded-xl border px-4"
            >
              {done ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <Circle className="text-muted-foreground size-5" />
              )}
              <span className={done ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
            </div>
          ))}
          <p className="text-muted-foreground pt-3 text-sm leading-6">
            La aplicación no busca credenciales en otros repositorios. Copia
            `.env.example` a `.env.local` y usa únicamente el proyecto Supabase
            destinado a Marisquería OS.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
