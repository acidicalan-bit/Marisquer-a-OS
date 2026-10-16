"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useActionState, useState } from "react";

import {
  loginAction,
  loginWithPinAction,
  type LoginState,
} from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCanonicalAppOrigin } from "@/lib/auth/recovery";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [pinState, pinAction, pinPending] = useActionState(
    loginWithPinAction,
    initialState,
  );
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string>();

  async function recover() {
    if (!email) {
      setRecoveryMessage("Escribe primero tu correo.");
      return;
    }
    setRecoveryPending(true);
    const recoveryOrigin = getCanonicalAppOrigin(window.location.origin);
    const { error } =
      await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${recoveryOrigin}/auth/callback?next=/account/password`,
      });
    setRecoveryPending(false);
    setRecoveryMessage(
      error
        ? "No se pudo enviar el enlace. Revisa el correo e inténtalo de nuevo."
        : "Si el correo existe, recibirás un enlace seguro para elegir tu contraseña.",
    );
  }

  return (
    <form action={mode === "password" ? action : pinAction} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Tipo de acceso">
        <Button type="button" variant={mode === "password" ? "default" : "ghost"} className="min-h-11 rounded-lg" onClick={() => setMode("password")} role="tab" aria-selected={mode === "password"}>Correo</Button>
        <Button type="button" variant={mode === "pin" ? "default" : "ghost"} className="min-h-11 rounded-lg" onClick={() => setMode("pin")} role="tab" aria-selected={mode === "pin"}>NIP de mesero</Button>
      </div>
      {mode === "password" ? <>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@marisqueria.mx" className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="h-12" />
        </div>
      </> : <>
        <div className="space-y-2">
          <Label htmlFor="employee_number">Número de empleado</Label>
          <Input id="employee_number" name="employee_number" autoComplete="username" required value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="Ej. M-07" className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">NIP</Label>
          <Input id="pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" autoComplete="one-time-code" required minLength={4} maxLength={8} className="h-12" />
          <p className="text-muted-foreground text-xs">El NIP lo configura Administración y se valida de forma segura.</p>
        </div>
      </>}
      {(mode === "password" ? state.error : pinState.error) ? (
        <Alert variant="destructive">
          <AlertDescription>{mode === "password" ? state.error : pinState.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="h-12 w-full" disabled={mode === "password" ? pending : pinPending}>
        {(mode === "password" ? pending : pinPending) ? <LoaderCircle className="animate-spin" /> : <LogIn />}
        {(mode === "password" ? pending : pinPending) ? "Ingresando…" : "Ingresar"}
      </Button>
      {mode === "password" && <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={recoveryPending}
        onClick={recover}
      >
        {recoveryPending ? "Enviando enlace…" : "Olvidé mi contraseña"}
      </Button>}
      {recoveryMessage ? (
        <p className="text-muted-foreground text-center text-sm" role="status">
          {recoveryMessage}
        </p>
      ) : null}
    </form>
  );
}
