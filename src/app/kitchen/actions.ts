"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { KITCHEN_ROLE_CODES, requireRoleAction } from "@/lib/auth/role-access";

export async function updateKitchenItemStatus(formData: FormData) {
  const { supabase, profile } = await requireRoleAction(KITCHEN_ROLE_CODES);
  if (!profile.branch_id)
    throw new Error("Tu usuario no tiene sucursal asignada.");
  const id = z
    .string()
    .uuid()
    .parse(String(formData.get("id")));
  const status = z
    .enum(["received", "preparing", "ready", "delivered"])
    .parse(String(formData.get("status")));
  const timestamp =
    status === "preparing"
      ? { started_at: new Date().toISOString() }
      : status === "ready"
        ? { ready_at: new Date().toISOString() }
        : status === "delivered"
          ? { delivered_at: new Date().toISOString() }
          : {};
  const { error } = await supabase
    .from("order_items")
    .update({ status, ...timestamp })
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .eq("branch_id", profile.branch_id);
  if (error) throw error;
  revalidatePath("/kitchen");
}
