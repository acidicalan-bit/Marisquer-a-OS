"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";

import { type AdminPermission, requireAdminPermission } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const optionalUuid = z.union([uuid, z.literal("")]).transform((v) => v || null);
const shortText = z.string().trim().min(1).max(120);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function context(permission: AdminPermission) {
  return requireAdminPermission(permission);
}

async function writeAudit(
  ctx: Awaited<ReturnType<typeof requireAdminPermission>>,
  action: string,
  entityType: string,
  entityId: string | null,
  newValue?: Record<string, unknown>,
) {
  await ctx.supabase.from("audit_logs").insert({
    organization_id: ctx.profile.organization_id,
    branch_id: ctx.profile.branch_id,
    user_id: ctx.user.id,
    role_id: ctx.profile.role_id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    new_value: newValue ?? null,
  });
}

function done() {
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function saveBrand(formData: FormData) {
  const ctx = await context("branches.manage");
  const branchId = uuid.parse(
    value(formData, "branch_id") || ctx.profile.branch_id,
  );
  const name = shortText.parse(value(formData, "name"));
  let logoUrl = value(formData, "current_logo_url") || null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 5 * 1024 * 1024) throw new Error("El logo supera 5 MB.");
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/svg+xml",
      ].includes(logo.type)
    ) {
      throw new Error("Formato de logo no permitido.");
    }
    const extension = logo.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${ctx.profile.organization_id}/${branchId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await ctx.supabase.storage
      .from("brand-assets")
      .upload(path, logo, { contentType: logo.type, upsert: false });
    if (uploadError) throw uploadError;
    logoUrl = ctx.supabase.storage.from("brand-assets").getPublicUrl(path)
      .data.publicUrl;
  }
  const brandSettings = {
    logo_scale: z.coerce
      .number()
      .int()
      .min(50)
      .max(180)
      .parse(value(formData, "logo_scale") || 100),
    logo_position: z
      .enum(["left", "center", "right"])
      .parse(value(formData, "logo_position") || "center"),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .parse(value(formData, "accent") || "#ef8354"),
  };
  const { error } = await ctx.supabase
    .from("branches")
    .update({ name, logo_url: logoUrl, brand_settings: brandSettings })
    .eq("id", branchId)
    .eq("organization_id", ctx.profile.organization_id);
  if (error) throw error;
  await writeAudit(ctx, "branch.brand_updated", "branch", branchId, {
    name,
    logo_url: logoUrl,
    brand_settings: brandSettings,
  });
  done();
}

export async function generateBrandLogo(formData: FormData) {
  const ctx = await context("branches.manage");
  const branchId = uuid.parse(
    value(formData, "branch_id") || ctx.profile.branch_id,
  );
  const name = shortText.parse(value(formData, "name"));
  const style = z
    .enum(["ocean", "pearl", "coral"])
    .parse(value(formData, "style") || "ocean");
  const direction = z
    .string()
    .trim()
    .max(500)
    .parse(value(formData, "direction"));
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Falta OPENAI_API_KEY para generar logos premium.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    prompt: `Diseña un logotipo premium, original y memorable para un restaurante de mariscos llamado "${name}". Estilo ${style}. Lockup horizontal elegante, símbolo marino abstracto y refinado, tipografía de alta gama claramente legible, composición limpia apta para fachada, menú y redes sociales. Fondo sólido sobrio con buen contraste. Sin mockup, sin fotografía, sin objetos alrededor, sin marcas de agua. ${direction}`,
    size: "1536x1024",
    quality: "high",
    output_format: "png",
  });
  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error("OpenAI no devolvió una imagen.");
  const path = `${ctx.profile.organization_id}/${branchId}/ai-${randomUUID()}.png`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("brand-assets")
    .upload(path, Buffer.from(imageBase64, "base64"), {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const logoUrl = ctx.supabase.storage.from("brand-assets").getPublicUrl(path)
    .data.publicUrl;
  const { error } = await ctx.supabase
    .from("branches")
    .update({ name, logo_url: logoUrl })
    .eq("id", branchId)
    .eq("organization_id", ctx.profile.organization_id);
  if (error) throw error;
  await writeAudit(ctx, "branch.logo_generated", "branch", branchId, {
    style,
    direction,
    logo_url: logoUrl,
  });
  done();
}

export async function saveUser(formData: FormData) {
  const ctx = await context("users.manage");
  const schema = z.object({
    id: z.union([uuid, z.literal("")]),
    email: z.string().email(),
    password: z.union([z.string().min(12), z.literal("")]),
    fullName: shortText,
    employeeNumber: z.string().trim().max(30),
    branchId: optionalUuid,
    roleId: optionalUuid,
  });
  const data = schema.parse({
    id: value(formData, "id"),
    email: value(formData, "email"),
    password: value(formData, "password"),
    fullName: value(formData, "full_name"),
    employeeNumber: value(formData, "employee_number"),
    branchId: value(formData, "branch_id"),
    roleId: value(formData, "role_id"),
  });
  const admin = createSupabaseAdminClient();

  if (data.id) {
    if (data.id === ctx.user.id && !checked(formData, "is_active")) {
      throw new Error("No puedes suspender tu propia cuenta.");
    }
    const authUpdate = await admin.auth.admin.updateUserById(data.id, {
      email: data.email,
      ...(data.password ? { password: data.password } : {}),
      user_metadata: {
        organization_id: ctx.profile.organization_id,
        branch_id: data.branchId,
        role_id: data.roleId,
        employee_number: data.employeeNumber || null,
        full_name: data.fullName,
      },
    });
    if (authUpdate.error) throw authUpdate.error;
    const { error } = await ctx.supabase
      .from("user_profiles")
      .update({
        branch_id: data.branchId,
        role_id: data.roleId,
        employee_number: data.employeeNumber || null,
        full_name: data.fullName,
        is_active: checked(formData, "is_active"),
      })
      .eq("id", data.id)
      .eq("organization_id", ctx.profile.organization_id);
    if (error) throw error;
    await writeAudit(ctx, "user.updated", "user_profile", data.id, {
      email: data.email,
      password_changed: Boolean(data.password),
    });
  } else {
    if (!data.password)
      throw new Error("La contraseña inicial es obligatoria.");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        organization_id: ctx.profile.organization_id,
        branch_id: data.branchId,
        role_id: data.roleId,
        employee_number: data.employeeNumber || null,
        full_name: data.fullName,
      },
    });
    if (error) throw error;
    await writeAudit(ctx, "user.created", "user_profile", created.user.id, {
      email: data.email,
    });
  }
  done();
}

export async function deleteUser(formData: FormData) {
  const ctx = await context("users.manage");
  const id = uuid.parse(value(formData, "id"));
  if (id === ctx.user.id)
    throw new Error("No puedes eliminar tu propia cuenta.");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
  await writeAudit(ctx, "user.deleted", "user_profile", id);
  done();
}

export async function saveCategory(formData: FormData) {
  const ctx = await context("menu.manage");
  const id = optionalUuid.parse(value(formData, "id"));
  const record = {
    organization_id: ctx.profile.organization_id,
    branch_id: ctx.profile.branch_id,
    name: shortText.parse(value(formData, "name")),
    description: value(formData, "description") || null,
    sort_order: z.coerce
      .number()
      .int()
      .min(0)
      .parse(value(formData, "sort_order") || 0),
    is_active: checked(formData, "is_active"),
    deleted_at: null,
  };
  const query = id
    ? ctx.supabase.from("menu_categories").update(record).eq("id", id)
    : ctx.supabase.from("menu_categories").insert(record);
  const { error } = await query;
  if (error) throw error;
  await writeAudit(
    ctx,
    id ? "category.updated" : "category.created",
    "menu_category",
    id,
    record,
  );
  done();
}

export async function deleteCategory(formData: FormData) {
  await softDelete(formData, "menu.manage", "menu_categories", "menu_category");
}

export async function saveMenuItem(formData: FormData) {
  const ctx = await context("menu.manage");
  const id = optionalUuid.parse(value(formData, "id"));
  let imageUrl = value(formData, "current_image_url") || null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB.");
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        image.type,
      )
    ) {
      throw new Error("Formato de imagen no permitido.");
    }
    const extension = image.name.split(".").pop()?.toLowerCase() || "webp";
    const path = `${ctx.profile.organization_id}/${ctx.profile.branch_id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await ctx.supabase.storage
      .from("menu-images")
      .upload(path, image, { contentType: image.type, upsert: false });
    if (uploadError) throw uploadError;
    imageUrl = ctx.supabase.storage.from("menu-images").getPublicUrl(path)
      .data.publicUrl;
  }
  const price = z.coerce.number().min(0).parse(value(formData, "price"));
  const record = {
    organization_id: ctx.profile.organization_id,
    branch_id: ctx.profile.branch_id,
    category_id: uuid.parse(value(formData, "category_id")),
    station_id: uuid.parse(value(formData, "station_id")),
    sku: value(formData, "sku") || null,
    name: shortText.parse(value(formData, "name")),
    description: value(formData, "description") || null,
    price_cents: Math.round(price * 100),
    expected_minutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(240)
      .parse(value(formData, "expected_minutes")),
    image_url: imageUrl,
    is_available: checked(formData, "is_available"),
    is_active: checked(formData, "is_active"),
    deleted_at: null,
  };
  const query = id
    ? ctx.supabase.from("menu_items").update(record).eq("id", id)
    : ctx.supabase.from("menu_items").insert(record);
  const { error } = await query;
  if (error) throw error;
  await writeAudit(
    ctx,
    id ? "menu_item.updated" : "menu_item.created",
    "menu_item",
    id,
    { ...record, image_url: imageUrl },
  );
  done();
}

export async function deleteMenuItem(formData: FormData) {
  await softDelete(formData, "menu.manage", "menu_items", "menu_item");
}

export async function saveSection(formData: FormData) {
  await saveScopedEntity(formData, "restaurant.manage", "restaurant_sections", {
    name: shortText.parse(value(formData, "name")),
    sort_order: z.coerce
      .number()
      .int()
      .min(0)
      .parse(value(formData, "sort_order") || 0),
    deleted_at: null,
  });
}

export async function deleteSection(formData: FormData) {
  await softDelete(
    formData,
    "restaurant.manage",
    "restaurant_sections",
    "restaurant_section",
  );
}

export async function saveTable(formData: FormData) {
  await saveScopedEntity(formData, "restaurant.manage", "tables", {
    name: shortText.parse(value(formData, "name")),
    section_id: optionalUuid.parse(value(formData, "section_id")),
    capacity: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .parse(value(formData, "capacity")),
    sort_order: z.coerce
      .number()
      .int()
      .min(0)
      .parse(value(formData, "sort_order") || 0),
    deleted_at: null,
  });
}

export async function deleteTable(formData: FormData) {
  await softDelete(formData, "restaurant.manage", "tables", "table");
}

export async function saveStation(formData: FormData) {
  await saveScopedEntity(
    formData,
    "restaurant.manage",
    "preparation_stations",
    {
      name: shortText.parse(value(formData, "name")),
      station_type: z
        .enum(["cold_kitchen", "hot_kitchen", "bar", "expedition"])
        .parse(value(formData, "station_type")),
      attention_minutes: z.coerce
        .number()
        .int()
        .min(1)
        .parse(value(formData, "attention_minutes")),
      delayed_minutes: z.coerce
        .number()
        .int()
        .min(2)
        .parse(value(formData, "delayed_minutes")),
      critical_minutes: z.coerce
        .number()
        .int()
        .min(3)
        .parse(value(formData, "critical_minutes")),
      is_active: checked(formData, "is_active"),
    },
  );
}

export async function disableStation(formData: FormData) {
  const ctx = await context("restaurant.manage");
  const id = uuid.parse(value(formData, "id"));
  const { error } = await ctx.supabase
    .from("preparation_stations")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
  done();
}

export async function saveSupplier(formData: FormData) {
  await saveScopedEntity(formData, "inventory.manage", "suppliers", {
    name: shortText.parse(value(formData, "name")),
    contact: {
      contact_name: value(formData, "contact_name"),
      phone: value(formData, "phone"),
      email: value(formData, "email"),
    },
    is_active: checked(formData, "is_active"),
  });
}

export async function disableSupplier(formData: FormData) {
  await disableEntity(formData, "inventory.manage", "suppliers");
}

export async function saveIngredient(formData: FormData) {
  const cost = z.coerce.number().min(0).parse(value(formData, "cost"));
  await saveScopedEntity(formData, "inventory.manage", "ingredients", {
    name: shortText.parse(value(formData, "name")),
    sku: value(formData, "sku") || null,
    supplier_id: optionalUuid.parse(value(formData, "supplier_id")),
    unit: z
      .enum(["g", "kg", "ml", "l", "piece", "portion"])
      .parse(value(formData, "unit")),
    minimum_quantity: z.coerce
      .number()
      .min(0)
      .parse(value(formData, "minimum_quantity")),
    cost_cents: Math.round(cost * 100),
    is_active: checked(formData, "is_active"),
  });
}

export async function disableIngredient(formData: FormData) {
  await disableEntity(formData, "inventory.manage", "ingredients");
}

export async function recordInventoryMovement(formData: FormData) {
  const ctx = await context("inventory.manage");
  const quantity = z.coerce
    .number()
    .refine((n) => n !== 0)
    .parse(value(formData, "quantity"));
  const costValue = value(formData, "unit_cost");
  const { error } = await ctx.supabase.rpc("record_inventory_movement", {
    requested_ingredient_id: uuid.parse(value(formData, "ingredient_id")),
    requested_movement_type: z
      .enum([
        "purchase",
        "sale",
        "adjustment",
        "waste",
        "transfer_in",
        "transfer_out",
      ])
      .parse(value(formData, "movement_type")),
    requested_quantity: quantity,
    requested_unit_cost_cents: costValue
      ? Math.round(z.coerce.number().min(0).parse(costValue) * 100)
      : null,
    requested_reason: value(formData, "reason") || null,
  });
  if (error) throw error;
  done();
}

export async function saveRecommendationSettings(formData: FormData) {
  const ctx = await context("recommendations.manage");
  if (!ctx.profile.branch_id)
    throw new Error("Tu usuario no tiene sucursal asignada.");
  const weight = (name: string) =>
    z.coerce.number().min(0).max(100).parse(value(formData, name));
  const marginWeight = weight("margin_weight");
  const lowSalesWeight = weight("low_sales_weight");
  const inventoryWeight = weight("inventory_weight");
  if (Math.round(marginWeight + lowSalesWeight + inventoryWeight) !== 100) {
    throw new Error("Los pesos de la estrategia deben sumar 100%.");
  }
  const record = {
    organization_id: ctx.profile.organization_id,
    branch_id: ctx.profile.branch_id,
    margin_weight: marginWeight,
    low_sales_weight: lowSalesWeight,
    inventory_weight: inventoryWeight,
    minimum_margin_basis_points: Math.round(
      z.coerce
        .number()
        .min(0)
        .max(100)
        .parse(value(formData, "minimum_margin")) * 100,
    ),
    lookback_days: z.coerce
      .number()
      .int()
      .min(7)
      .max(365)
      .parse(value(formData, "lookback_days")),
    recommendation_message: value(formData, "recommendation_message") || null,
    is_active: checked(formData, "is_active"),
  };
  const { error } = await ctx.supabase
    .from("sales_assistant_settings")
    .upsert(record, { onConflict: "branch_id" });
  if (error) throw error;
  await writeAudit(
    ctx,
    "sales_assistant.updated",
    "sales_assistant_settings",
    null,
    record,
  );
  done();
}

export async function toggleShift(formData: FormData) {
  const ctx = await context("shifts.manage");
  if (!ctx.profile.branch_id)
    throw new Error("Tu usuario no tiene sucursal asignada.");
  const operation = z
    .enum(["open", "close"])
    .parse(value(formData, "operation"));
  if (operation === "open") {
    const { data: existing } = await ctx.supabase
      .from("shifts")
      .select("id")
      .eq("branch_id", ctx.profile.branch_id)
      .eq("status", "open")
      .maybeSingle();
    if (existing)
      throw new Error("Ya existe un turno abierto en esta sucursal.");
    const { data, error } = await ctx.supabase
      .from("shifts")
      .insert({
        organization_id: ctx.profile.organization_id,
        branch_id: ctx.profile.branch_id,
        name: `Turno ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date())}`,
        opened_by: ctx.user.id,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw error;
    await writeAudit(ctx, "shift.opened", "shift", data.id);
  } else {
    const shiftId = uuid.parse(value(formData, "shift_id"));
    const { error } = await ctx.supabase
      .from("shifts")
      .update({
        status: "closed",
        closed_by: ctx.user.id,
        closed_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .eq("status", "open");
    if (error) throw error;
    await writeAudit(ctx, "shift.closed", "shift", shiftId);
  }
  done();
}

async function saveScopedEntity(
  formData: FormData,
  permission: AdminPermission,
  table: string,
  fields: Record<string, unknown>,
) {
  const ctx = await context(permission);
  if (!ctx.profile.branch_id)
    throw new Error("Tu usuario no tiene sucursal asignada.");
  const id = optionalUuid.parse(value(formData, "id"));
  const record = {
    organization_id: ctx.profile.organization_id,
    branch_id: ctx.profile.branch_id,
    ...fields,
  };
  const query = id
    ? ctx.supabase.from(table).update(record).eq("id", id)
    : ctx.supabase.from(table).insert(record);
  const { error } = await query;
  if (error) throw error;
  await writeAudit(
    ctx,
    id ? `${table}.updated` : `${table}.created`,
    table,
    id,
    fields,
  );
  done();
}

async function softDelete(
  formData: FormData,
  permission: AdminPermission,
  table: string,
  entityType: string,
) {
  const ctx = await context(permission);
  const id = uuid.parse(value(formData, "id"));
  const { error } = await ctx.supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await writeAudit(ctx, `${entityType}.archived`, entityType, id);
  done();
}

async function disableEntity(
  formData: FormData,
  permission: AdminPermission,
  table: string,
) {
  const ctx = await context(permission);
  const id = uuid.parse(value(formData, "id"));
  const { error } = await ctx.supabase
    .from(table)
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
  await writeAudit(ctx, `${table}.disabled`, table, id);
  done();
}
