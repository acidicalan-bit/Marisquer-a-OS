import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.META_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Verificación rechazada", { status: 403 });
}

export async function POST(request: Request) {
  if (!process.env.META_APP_SECRET) {
    return NextResponse.json(
      { error: "Integración Meta no configurada" },
      { status: 503 },
    );
  }
  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-hub-signature-256") ?? "";
  const expectedSignature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(rawBody).digest("hex")}`;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as MetaWebhook;
  const admin = createSupabaseAdminClient();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const { data: channel } = await admin
        .from("integration_channels")
        .select("id, organization_id, branch_id")
        .eq("channel_type", "whatsapp")
        .eq("external_account_id", phoneNumberId)
        .eq("status", "active")
        .maybeSingle();
      if (!channel) continue;
      for (const message of change.value.messages ?? []) {
        const contact = change.value.contacts?.find(
          (item) => item.wa_id === message.from,
        );
        const { data: conversation, error: conversationError } = await admin
          .from("social_conversations")
          .upsert(
            {
              organization_id: channel.organization_id,
              branch_id: channel.branch_id,
              channel_id: channel.id,
              external_conversation_id: message.from,
              contact_name: contact?.profile?.name ?? null,
              contact_handle: message.from,
              status: "open",
              last_message_at: new Date(
                Number(message.timestamp) * 1000,
              ).toISOString(),
            },
            { onConflict: "channel_id,external_conversation_id" },
          )
          .select("id, unread_count")
          .single();
        if (conversationError || !conversation) continue;
        await admin.from("social_messages").upsert(
          {
            organization_id: channel.organization_id,
            branch_id: channel.branch_id,
            channel_id: channel.id,
            conversation_id: conversation.id,
            external_message_id: message.id,
            direction: "inbound",
            message_type: message.type,
            body: message.text?.body ?? null,
            status: "received",
            payload: message,
            occurred_at: new Date(
              Number(message.timestamp) * 1000,
            ).toISOString(),
          },
          {
            onConflict: "channel_id,external_message_id",
            ignoreDuplicates: true,
          },
        );
        await admin
          .from("social_conversations")
          .update({ unread_count: Number(conversation.unread_count) + 1 })
          .eq("id", conversation.id);
      }
    }
  }
  return NextResponse.json({ received: true });
}

type MetaWebhook = {
  entry?: Array<{
    changes?: Array<{
      value: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          [key: string]: unknown;
        }>;
      };
    }>;
  }>;
};
