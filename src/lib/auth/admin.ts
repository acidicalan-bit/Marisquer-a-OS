import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ADMIN_PERMISSIONS = [
  "organization.manage",
  "branches.manage",
  "roles.manage",
  "users.manage",
  "restaurant.manage",
  "menu.manage",
  "inventory.manage",
  "analytics.read",
  "recommendations.manage",
  "shifts.manage",
  "inbox.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export async function requireAdminPermission(permission: AdminPermission) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: allowed, error: permissionError }, { data: profile, error }] =
    await Promise.all([
      supabase.rpc("has_permission", { permission_code: permission }),
      supabase
        .from("user_profiles")
        .select("id, organization_id, branch_id, role_id, full_name, is_active")
        .eq("id", auth.user.id)
        .single(),
    ]);

  if (permissionError || error || !profile?.is_active || !allowed) {
    throw new Error("No tienes permiso para realizar esta operación.");
  }

  return { supabase, user: auth.user, profile };
}

export async function getAdminAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const results = await Promise.all(
    ADMIN_PERMISSIONS.map(async (permission) => {
      const { data } = await supabase.rpc("has_permission", {
        permission_code: permission,
      });
      return [permission, Boolean(data)] as const;
    }),
  );
  const permissions = Object.fromEntries(results) as Record<
    AdminPermission,
    boolean
  >;
  if (!Object.values(permissions).some(Boolean)) redirect("/dashboard");

  return { supabase, user: auth.user, permissions };
}
