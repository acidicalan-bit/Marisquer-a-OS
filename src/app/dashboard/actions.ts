"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { moneyToCents } from "@/lib/cash/money";
import { requireRoleAction } from "@/lib/auth/role-access";

const uuid = z.string().uuid();
const itemSchema = z.object({
  id: uuid,
  menu_item_id: uuid,
  quantity: z.number().int().min(1).max(50),
  notes: z.string().trim().max(500).optional().default(""),
  allergy_alert: z.string().trim().max(300).optional().default(""),
});

export type WaiterOrderState = { error?: string; success?: string };

export async function cancelWaiterOrderItemAction(
  _previous: WaiterOrderState,
  formData: FormData,
): Promise<WaiterOrderState> {
  try {
    const { supabase } = await requireRoleAction([
      "administrator",
      "manager",
      "captain",
      "waiter",
    ]);
    const orderItemId = uuid.parse(String(formData.get("order_item_id") ?? ""));
    const reason = z.string().trim().min(3).max(240).parse(String(formData.get("reason") ?? ""));
    const adminPin = String(formData.get("admin_pin") ?? "");
    const { data, error } = await supabase.rpc("cancel_order_item_with_admin_pin", {
      requested_order_item_id: orderItemId,
      requested_reason: reason,
      requested_admin_pin: adminPin,
    });
    if (error || data !== true) {
      const message = error?.message?.toLocaleLowerCase("es-MX") ?? "";
      if (message.includes("nip") || message.includes("pin")) {
        return { error: "El NIP de Administración es incorrecto o está temporalmente bloqueado." };
      }
      return { error: "No se pudo cancelar el platillo. Actualiza la comanda y vuelve a intentarlo." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/cash");
    revalidatePath("/kitchen");
    return { success: "Platillo cancelado y cocina notificada." };
  } catch {
    return { error: "No se pudo cancelar el platillo. Revisa la conexión y el NIP de Administración." };
  }
}

export async function collectWaiterSaleAction(
  _previous: WaiterOrderState,
  formData: FormData,
): Promise<WaiterOrderState> {
  try {
    const { supabase } = await requireRoleAction([
      "administrator",
      "manager",
      "captain",
      "waiter",
    ]);
    const sessionId = uuid.parse(String(formData.get("session_id") ?? ""));
    const idempotencyKey = uuid.parse(String(formData.get("idempotency_key") ?? ""));
    const method = z.enum(["cash", "card", "transfer", "other"]).parse(
      String(formData.get("method") ?? ""),
    );
    const receivedCents = moneyToCents(String(formData.get("received_amount") ?? ""));
    const tipCents = moneyToCents(String(formData.get("tip_amount") ?? "0"));
    const { data, error } = await supabase.rpc("complete_waiter_table_sale", {
      requested_table_session_id: sessionId,
      requested_method: method,
      requested_received_cents: receivedCents,
      requested_tip_cents: tipCents,
      requested_idempotency_key: idempotencyKey,
      requested_admin_pin: String(formData.get("admin_pin") ?? ""),
    });
    if (error || !data) {
      return { error: error?.message ?? "No se confirmó el cobro." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/cash");
    revalidatePath("/admin");
    return { success: "Cobro confirmado y cuenta cerrada. Puedes revisar el ticket en la PC." };
  } catch {
    return { error: "No se confirmó el cobro. Revisa la conexión antes de volver a intentarlo." };
  }
}

export async function submitWaiterOrderAction(
  _previous: WaiterOrderState,
  formData: FormData,
): Promise<WaiterOrderState> {
  try {
    const { supabase, user } = await requireRoleAction([
      "administrator",
      "manager",
      "captain",
      "waiter",
    ]);
    const profileResult = await supabase
      .from("user_profiles")
      .select("organization_id, branch_id, is_active")
      .eq("id", user.id)
      .single();
    const profile = profileResult.data;
    if (profileResult.error || !profile?.is_active || !profile.branch_id) {
      return { error: "Tu perfil no tiene una sucursal activa asignada." };
    }

    const orderId = uuid.parse(String(formData.get("order_id") ?? ""));
    const eventId = uuid.parse(String(formData.get("event_id") ?? ""));
    const tableId = uuid.parse(String(formData.get("table_id") ?? ""));
    const guestCount = z.coerce.number().int().min(1).max(50).parse(formData.get("guest_count"));
    const notes = z.string().trim().max(500).parse(String(formData.get("notes") ?? ""));
    const items = z.array(itemSchema).min(1).max(100).parse(JSON.parse(String(formData.get("items") ?? "[]")));
    const result = await supabase.rpc("apply_offline_events_v2", {
      requested_device_id: uuid.parse(String(formData.get("device_id") ?? "")),
      requested_events: [{
        id: eventId,
        user_id: user.id,
        branch_id: profile.branch_id,
        type: "order.submitted",
        entity_id: orderId,
        base_version: null,
        occurred_at: new Date().toISOString(),
        payload: { table_id: tableId, guest_count: guestCount, notes, items },
      }],
    });
    if (result.error) {
      return { error: formatOrderSubmissionError(result.error.message) };
    }
    const eventResult = Array.isArray(result.data)
      ? result.data[0] as { status?: string; detail?: { message?: string } } | undefined
      : result.data as { status?: string; detail?: { message?: string } } | null;
    if (eventResult?.status !== "applied") {
      const detail = eventResult?.detail?.message;
      return { error: detail ? formatOrderSubmissionError(detail) : "La comanda fue rechazada. Actualiza la pantalla y confirma que la mesa y los productos sigan disponibles." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/cash");
    revalidatePath("/kitchen");
    return { success: "Comanda enviada a cocina y registrada en la mesa." };
  } catch (error) {
    return { error: formatOrderSubmissionError(error instanceof Error ? error.message : "") };
  }
}

function formatOrderSubmissionError(raw: string): string {
  const message = raw.replace(/https?:\/\/\S+/gi, "<url>").trim();
  const lower = message.toLocaleLowerCase("es-MX");
  if (lower.includes("permiso") || lower.includes("permission")) {
    return "Tu usuario no tiene permiso para enviar pedidos. Solicita a Administración el permiso operativo.";
  }
  if (lower.includes("perfil activo") || lower.includes("sucursal")) {
    return "Tu usuario no tiene una sucursal activa asignada. Revísalo en Administración.";
  }
  if (lower.includes("mesa inexistente") || lower.includes("table")) {
    return "La mesa ya no está disponible. Actualiza las mesas y vuelve a capturar el pedido.";
  }
  if (lower.includes("producto no disponible") || lower.includes("menu")) {
    return "Uno de los productos ya no está disponible. Actualiza la carta y vuelve a intentarlo.";
  }
  if (lower.includes("failed to parse filter")) {
    return "La sesión recibió un filtro inválido del servidor. Cierra sesión, vuelve a entrar y reintenta.";
  }
  if (lower.includes("sesión requerida") || lower.includes("session required") || lower.includes("jwt")) {
    return "Tu sesión expiró. Vuelve a entrar y reintenta la comanda; no se registró ningún pedido.";
  }
  if (message.length > 0 && message.length <= 180) {
    return `Supabase rechazó la comanda: ${message}`;
  }
  return "No se pudo enviar la comanda. Revisa la conexión y los datos de la mesa.";
}
