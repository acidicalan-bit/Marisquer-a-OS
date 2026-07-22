"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 12) {
      setError("Usa al menos 12 caracteres.");
      return;
    }
    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError("Incluye mayúscula, minúscula y número.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    setError(undefined);
    const { error: updateError } =
      await getSupabaseBrowserClient().auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(
        "No se pudo actualizar. Solicita un enlace nuevo e inténtalo otra vez.",
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <p className="font-semibold">Contraseña actualizada</p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Continuar al panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-confirmation">Confirmar contraseña</Label>
        <Input
          id="password-confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? "Actualizando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
