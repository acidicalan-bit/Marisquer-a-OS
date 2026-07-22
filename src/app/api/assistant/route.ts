import { createHash } from "node:crypto";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(3000),
  page: z.string().max(200).default("/"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      }),
    )
    .max(12)
    .default([]),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "El copiloto aún no tiene OPENAI_API_KEY configurada." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const [profileResult, branchResult, menuResult, inventoryResult] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("full_name, branch_id, role:roles(name)")
        .eq("id", auth.user.id)
        .single(),
      supabase.from("branches").select("name").maybeSingle(),
      supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("ingredients")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
  const profile = profileResult.data;
  const branchName = branchResult.data?.name ?? "la sucursal";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const conversation = parsed.data.history
    .map(
      (item) =>
        `${item.role === "user" ? "Usuario" : "Asistente"}: ${item.content}`,
    )
    .join("\n");
  const response = await openai.responses.create({
    model: process.env.OPENAI_ASSISTANT_MODEL || "gpt-5.6-sol",
    reasoning: { effort: "low" },
    safety_identifier: createHash("sha256").update(auth.user.id).digest("hex"),
    instructions: `Eres Mar, el copiloto experto de Marisquería OS. Responde en español claro, fresco y amable. Ayuda a operar y configurar el restaurante con información concreta. Contexto: restaurante ${branchName}; usuario ${profile?.full_name ?? "equipo"}; página ${parsed.data.page}; ${menuResult.count ?? 0} elementos de menú; ${inventoryResult.count ?? 0} productos de inventario. No afirmes que modificaste datos: las operaciones sensibles requieren confirmación en la interfaz. Nunca solicites contraseñas, claves API ni secretos. Si el usuario quiere editar, indica el módulo y los campos exactos; mantén la respuesta breve y accionable.`,
    input: `${conversation ? `${conversation}\n` : ""}Usuario: ${parsed.data.message}`,
  });
  return NextResponse.json({ answer: response.output_text });
}
