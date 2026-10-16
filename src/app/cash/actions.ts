"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { CASH_ROLE_CODES, requireRoleAction } from "@/lib/auth/role-access";
import { moneyToCents } from "@/lib/cash/money";

export type CashActionState = { error?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function openCashRegisterAction(
  _state: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const context = await requireRoleAction(CASH_ROLE_CODES);
  let opening: number;
  try {
    opening = moneyToCents(value(formData, "opening_amount"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Importe inválido.",
    };
  }
  const { error } = await context.supabase.rpc("open_cash_register", {
    requested_opening_amount_cents: opening,
  });
  if (error) return { error: error.message };
  redirect("/cash");
}

export async function completeSaleAction(
  _state: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const context = await requireRoleAction(CASH_ROLE_CODES);
  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      registerId: z.string().uuid(),
      method: z.enum(["cash", "card", "transfer", "other"]),
      idempotencyKey: z.string().uuid(),
    })
    .safeParse({
      sessionId: value(formData, "session_id"),
      registerId: value(formData, "register_id"),
      method: value(formData, "method"),
      idempotencyKey: value(formData, "idempotency_key"),
    });
  if (!parsed.success) return { error: "Los datos del cobro no son válidos." };

  let received: number;
  let tip: number;
  try {
    received = moneyToCents(value(formData, "received_amount"));
    tip = moneyToCents(value(formData, "tip_amount") || "0");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Importe inválido.",
    };
  }
  const { data, error } = await context.supabase.rpc("complete_table_sale", {
    requested_table_session_id: parsed.data.sessionId,
    requested_cash_register_id: parsed.data.registerId,
    requested_method: parsed.data.method,
    requested_received_cents: received,
    requested_tip_cents: tip,
    requested_idempotency_key: parsed.data.idempotencyKey,
      requested_admin_pin: value(formData, "admin_pin"),
  });
  if (error || !data)
    return { error: error?.message ?? "No se generó el ticket." };
  redirect(`/cash/receipt/${data}`);
}

export async function closeCashRegisterAction(
  _state: CashActionState,
  formData: FormData,
): Promise<CashActionState> {
  const context = await requireRoleAction(CASH_ROLE_CODES);
  const registerId = z
    .string()
    .uuid()
    .safeParse(value(formData, "register_id"));
  if (!registerId.success) return { error: "La caja no es válida." };
  let counted: number;
  try {
    counted = moneyToCents(value(formData, "counted_amount"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Importe inválido.",
    };
  }
  const { error } = await context.supabase.rpc("close_cash_register", {
    requested_cash_register_id: registerId.data,
    requested_counted_amount_cents: counted,
  });
  if (error) return { error: error.message };
  redirect("/cash?closed=1");
}
