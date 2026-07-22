import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/auth/password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cambiar contraseña" };
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="bg-muted/30 grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <p className="text-primary text-sm font-semibold">Acceso personal</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Elige tu nueva contraseña
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Se actualiza directamente en Supabase Auth y nunca se guarda en
            Marisquería OS.
          </p>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
