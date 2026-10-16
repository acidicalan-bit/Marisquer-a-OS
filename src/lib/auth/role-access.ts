import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const KITCHEN_ROLE_CODES = [
  "administrator",
  "manager",
  "cold_kitchen",
  "hot_kitchen",
  "bar",
  "runner",
] as const;

export const HOST_ROLE_CODES = [
  "administrator",
  "manager",
  "captain",
  "host",
] as const;

export const CASH_ROLE_CODES = ["administrator", "manager", "cashier"] as const;

function relationCode(value: unknown) {
  const role = Array.isArray(value) ? value[0] : value;
  return role && typeof role === "object" && "code" in role
    ? String(role.code)
    : null;
}

async function roleContext() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile, error } = await supabase
    .from("user_profiles")
    // user_profiles has organization-scoped foreign keys to roles; the
    // unqualified relation can fail with PostgREST's ambiguous-relationship
    // error and was incorrectly surfaced as "Sesión requerida" on actions.
    .select("id, is_active, role:roles!user_profiles_role_organization_fkey(code)")
    .eq("id", auth.user.id)
    .single();
  if (error || !profile?.is_active) return null;
  return { supabase, user: auth.user, roleCode: relationCode(profile.role) };
}

export async function requireRolePage(allowedRoles: readonly string[]) {
  const context = await roleContext();
  if (!context) redirect("/login");
  if (!context.roleCode || !allowedRoles.includes(context.roleCode))
    redirect("/dashboard");
  return context;
}

export async function requireRoleAction(allowedRoles: readonly string[]) {
  const context = await roleContext();
  if (!context) throw new Error("Sesión requerida.");
  if (!context.roleCode || !allowedRoles.includes(context.roleCode))
    throw new Error("Tu rol no tiene acceso a esta operación.");
  return context;
}
