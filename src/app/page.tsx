import { Anchor, ArrowRight, Database, ShieldCheck, Waves } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicEnv } from "@/lib/env";
import { createOptionalSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  if (getPublicEnv()) {
    const supabase = await createOptionalSupabaseServerClient();
    const { data } = await supabase!.auth.getUser();
    redirect(data.user ? "/dashboard" : "/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:py-14">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground shadow-primary/20 grid size-11 place-items-center rounded-2xl shadow-lg">
            <Anchor className="size-5" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Marisquería OS</p>
            <p className="text-muted-foreground text-xs">Pacífico · CDMX</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-card/70">
          Fase 1
        </Badge>
      </nav>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="bg-card/80 text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <Waves className="text-primary size-4" /> Operación sincronizada,
            sin datos simulados
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
            El pulso completo del restaurante, en una sola marea.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
            Mesas, menú, personal y permisos sobre PostgreSQL con seguridad por
            sucursal. El proyecto está listo para enlazarse a su instancia
            exclusiva de Supabase.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Ir al acceso <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/setup">Ver configuración</Link>
            </Button>
          </div>
        </div>

        <Card className="border-primary/15 bg-card/85 shadow-primary/10 shadow-2xl backdrop-blur">
          <CardHeader>
            <Badge className="w-fit" variant="secondary">
              Configuración requerida
            </Badge>
            <CardTitle className="mt-3 text-2xl">
              Conecta Supabase de Marisquería OS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SetupItem
              icon={Database}
              title="Proyecto exclusivo"
              text="Usa la URL y llave publicable del proyecto de marisquería."
            />
            <SetupItem
              icon={ShieldCheck}
              title="RLS desde el inicio"
              text="Aplica la migración y el seed versionados antes de ingresar."
            />
            <div className="bg-muted/60 text-muted-foreground rounded-xl border border-dashed p-4 font-mono text-xs leading-6">
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function SetupItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm leading-6">{text}</p>
      </div>
    </div>
  );
}
