"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateKitchenItemStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sesión requerida.");
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
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/kitchen");
}
