import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  type: z.enum([
    "order.submitted",
    "table.status_changed",
    "kitchen.item_status_changed",
  ]),
  entityId: z.string().uuid(),
  baseVersion: z.number().int().positive().optional(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

const requestSchema = z.object({
  deviceId: z.string().uuid(),
  events: z.array(eventSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Lote de sincronización inválido." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("apply_offline_events_v2", {
    requested_device_id: parsed.data.deviceId,
    requested_events: parsed.data.events.map((event) => ({
      id: event.id,
      user_id: event.userId,
      branch_id: event.branchId,
      type: event.type,
      entity_id: event.entityId,
      base_version: event.baseVersion ?? null,
      occurred_at: event.occurredAt,
      payload: event.payload,
    })),
  });
  if (error) {
    return NextResponse.json(
      { error: "La sincronización fue rechazada de forma segura." },
      { status: 409 },
    );
  }
  return NextResponse.json({ results: data });
}
