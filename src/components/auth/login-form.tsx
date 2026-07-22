"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useActionState, useState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string>();

  async function recover() {
    if (!email) {
      setRecoveryMessage("Escribe primero tu correo.");
      return;
    }
    setRecoveryPending(true);
    const { error } =
      await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
      });
    setRecoveryPending(false);
    setRecoveryMessage(
      error
        ? "No se pudo enviar el enlace. Revisa el correo e inténtalo de nuevo."
        : "Si el correo existe, recibirás un enlace seguro para elegir tu contraseña.",
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@marisqueria.mx"
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="h-12"
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="h-12 w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <LogIn />}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={recoveryPending}
        onClick={recover}
      >
        {recoveryPending ? "Enviando enlace…" : "Olvidé mi contraseña"}
      </Button>
      {recoveryMessage ? (
        <p className="text-muted-foreground text-center text-sm" role="status">
          {recoveryMessage}
        </p>
      ) : null}
    </form>
  );
}
