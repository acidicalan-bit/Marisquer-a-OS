"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { getCanonicalAppOrigin } from "@/lib/auth/recovery";
import { createSupabaseAdminClient, hasSupabaseAdminKey } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Escribe un correo válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
});

const pinCredentialsSchema = z.object({
  employeeNumber: z
    .string()
    .trim()
    .min(1, "Escribe tu número de empleado.")
    .max(30, "El número de empleado no es válido."),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "El NIP debe tener entre 4 y 8 dígitos."),
});

export type LoginState = { error?: string };

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "No pudimos iniciar sesión. Revisa tus datos." };

  redirect("/dashboard");
}

/**
 * Acceso rápido de meseros. El NIP sólo se compara en Supabase contra su hash;
 * el servidor genera un enlace de sesión de un solo uso y nunca expone la
 * clave secreta ni convierte el NIP en contraseña del usuario.
 */
export async function loginWithPinAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = pinCredentialsSchema.safeParse({
    employeeNumber: formData.get("employee_number"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  if (!hasSupabaseAdminKey()) {
    return {
      error:
        "El acceso por NIP aún no está habilitado en el servidor. Administración debe configurar la clave secreta del servidor.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("user_profiles")
    .select("id, branch_id, employee_number")
    .eq("employee_number", parsed.data.employeeNumber)
    .eq("is_active", true)
    .not("branch_id", "is", null);

  // Un número de empleado ambiguo no puede iniciar sesión por NIP sin que
  // Administración lo haga único dentro de la organización/sucursal.
  if (profileError || !profiles || profiles.length !== 1) {
    return { error: "Número de empleado o NIP no válidos." };
  }

  const profile = profiles[0];
  const { data: validPin, error: pinError } = await admin.rpc(
    "verify_employee_pin",
    {
      requested_branch_id: profile.branch_id,
      requested_employee_number: parsed.data.employeeNumber,
      candidate_pin: parsed.data.pin,
    },
  );

  if (pinError || validPin !== true) {
    return { error: "Número de empleado o NIP no válidos." };
  }

  const { data: authUser, error: userError } =
    await admin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (userError || !email) {
    return { error: "El usuario no tiene un correo de acceso configurado." };
  }

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const requestUrl = host ? `${forwardedProto}://${host}` : "http://localhost:3000";
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configuredIsLocalDefault = configuredOrigin
    ? /:\/\/localhost:3000\/?$/i.test(configuredOrigin)
    : true;
  // En desarrollo/local, conserva el host y puerto con que abrió el mesero
  // (por ejemplo, 192.168.x.x:3210); así el enlace no vuelve a localhost:3000.
  const appOrigin = configuredIsLocalDefault
    ? new URL(requestUrl).origin.replace("0.0.0.0", "127.0.0.1")
    : getCanonicalAppOrigin(requestUrl);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${appOrigin}/auth/callback?next=/dashboard`,
    },
  });

  if (linkError || !link.properties?.action_link) {
    return { error: "No se pudo crear la sesión segura. Intenta de nuevo." };
  }

  redirect(link.properties.action_link);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
