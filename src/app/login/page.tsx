import { Anchor, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { RecoveryFragmentHandler } from "@/components/auth/recovery-fragment-handler";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { getPublicEnv } from "@/lib/env";
import { createOptionalSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acceso" };
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const configured = Boolean(getPublicEnv());
  if (configured) {
    const supabase = await createOptionalSupabaseServerClient();
    const { data } = await supabase!.auth.getUser();
    if (data.user) redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <RecoveryFragmentHandler />
      <section className="bg-primary text-primary-foreground hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Anchor className="size-7" />
          <span className="text-lg font-semibold">Marisquería OS</span>
        </div>
        <div className="max-w-xl">
          <Badge className="mb-5 border-white/20 bg-white/10 text-white">
            Barlovento · Marisquería
          </Badge>
          <h1 className="text-5xl font-semibold tracking-[-0.04em] text-balance">
            Cada servicio, claro. Cada estación, a tiempo.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/70">
            Acceso seguro por rol y sucursal para todo el equipo del
            restaurante.
          </p>
        </div>
        <p className="text-sm text-white/55">
          Ciudad de México · America/Mexico_City
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <Card className="shadow-primary/10 w-full max-w-md shadow-xl">
          <CardHeader className="space-y-3">
            <span className="bg-secondary text-secondary-foreground grid size-11 place-items-center rounded-xl">
              <LockKeyhole className="size-5" />
            </span>
            <h2 className="text-3xl leading-none font-semibold tracking-tight">
              Bienvenido
            </h2>
            <CardDescription>
              Ingresa con el correo asignado por administración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {query.error === "recovery_link_invalid" ? (
              <Alert variant="destructive" className="mb-5">
                <AlertTitle>El enlace no pudo validarse</AlertTitle>
                <AlertDescription>
                  Solicita un enlace nuevo y abre únicamente el correo más
                  reciente. Los enlaces anteriores dejan de ser válidos.
                </AlertDescription>
              </Alert>
            ) : null}
            {!configured ? (
              <Alert>
                <AlertTitle>Supabase aún no está enlazado</AlertTitle>
                <AlertDescription>
                  Agrega las variables del proyecto exclusivo de marisquería.{" "}
                  <Link className="font-medium underline" href="/setup">
                    Ver pasos
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            ) : (
              <LoginForm />
            )}
            <p className="text-muted-foreground mt-6 text-center text-xs leading-5">
              El acceso rápido por PIN se habilitará mediante una función segura
              del servidor; el PIN nunca se enviará como contraseña ni se
              guardará en el navegador.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
