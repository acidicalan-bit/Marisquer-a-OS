import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  LayoutDashboard,
  MessageCircleMore,
  Settings2,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import type { Metadata } from "next";

import {
  deleteCategory,
  deleteMenuItem,
  deleteSection,
  deleteTable,
  deleteUser,
  disableIngredient,
  disableStation,
  disableSupplier,
  recordInventoryMovement,
  saveCategory,
  saveIngredient,
  saveMenuItem,
  saveSection,
  saveStation,
  saveRecommendationSettings,
  saveSupplier,
  saveTable,
  saveUser,
  toggleShift,
} from "@/app/admin/actions";
import { AiConcierge } from "@/components/assistant/ai-concierge";
import { AdminCrud, type AdminField } from "@/components/admin/admin-crud";
import { BrandStudio } from "@/components/admin/brand-studio";
import { ConnectionAddress } from "@/components/admin/connection-address";
import { SecurityPinForm } from "@/components/admin/security-pin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminAccess } from "@/lib/auth/admin";
import { getLocalServerAddresses } from "@/lib/network/server-address";

export const metadata: Metadata = { title: "Administración" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const serverAddresses = getLocalServerAddresses();
  const { supabase, user, permissions } = await getAdminAccess();
  const recommendationSettings = await supabase
    .from("sales_assistant_settings")
    .select(
      "margin_weight, low_sales_weight, inventory_weight, minimum_margin_basis_points, lookback_days, recommendation_message, is_active",
    )
    .maybeSingle();
  const lookbackDays = Math.min(
    365,
    Math.max(7, Number(recommendationSettings.data?.lookback_days ?? 30)),
  );
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - lookbackDays * 86_400_000);
  const [
    profile,
    branch,
    roles,
    users,
    sections,
    tables,
    stations,
    categories,
    menuItems,
    suppliers,
    ingredients,
    movements,
    performance,
    currentShift,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("organization_id, branch_id, full_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("branches")
      .select("id, name, logo_url, brand_settings")
      .maybeSingle(),
    supabase.from("roles").select("id, name").order("name"),
    supabase
      .from("user_profiles")
      .select("id, full_name, employee_number, branch_id, role_id, is_active")
      .order("full_name"),
    supabase
      .from("restaurant_sections")
      .select("id, name, sort_order")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("tables")
      .select("id, name, section_id, capacity, sort_order, status")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("preparation_stations")
      .select(
        "id, name, station_type, sends_to_kitchen, attention_minutes, delayed_minutes, critical_minutes, is_active",
      )
      .order("name"),
    supabase
      .from("menu_categories")
      .select("id, name, description, sort_order, is_active")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select(
        "id, name, description, sku, price_cents, expected_minutes, image_url, category_id, station_id, is_available, is_active",
      )
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("suppliers")
      .select("id, name, contact, is_active")
      .order("name"),
    supabase
      .from("ingredients")
      .select(
        "id, name, sku, supplier_id, unit, stock_quantity, minimum_quantity, cost_cents, is_active",
      )
      .order("name"),
    supabase
      .from("inventory_movements")
      .select(
        "id, quantity, movement_type, reason, created_at, ingredient:ingredients(name)",
      )
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.rpc("menu_performance", {
      requested_start: periodStart.toISOString(),
      requested_end: periodEnd.toISOString(),
    }),
    supabase
      .from("shifts")
      .select("id, name, opened_at, opened_by")
      .eq("status", "open")
      .maybeSingle(),
  ]);
  const failed = [
    profile,
    branch,
    roles,
    users,
    sections,
    tables,
    stations,
    categories,
    menuItems,
    suppliers,
    ingredients,
    movements,
    recommendationSettings,
    performance,
    currentShift,
  ].find((result) => result.error);
  if (failed?.error)
    throw new Error(`No se pudo cargar el panel: ${failed.error.message}`);

  const emailById = new Map<string, string>();
  const managedUsers = permissions["users.manage"]
    ? await supabase.functions.invoke("mobile-admin-users", {
        body: { operation: "list" },
      })
    : null;
  const listedUsers = (
    managedUsers?.data as { users?: { id: string; email: string }[] } | null
  )?.users;
  listedUsers?.forEach((managedUser) =>
    emailById.set(managedUser.id, managedUser.email),
  );
  const branchData = branch.data;
  if (!profile.data || !branchData)
    throw new Error("Asigna una sucursal al administrador.");
  const brand = (branchData.brand_settings ?? {}) as Record<string, unknown>;
  const roleOptions = (roles.data ?? []).map((role) => ({
    label: role.name,
    value: role.id,
  }));
  const sectionOptions = (sections.data ?? []).map((section) => ({
    label: section.name,
    value: section.id,
  }));
  const categoryOptions = (categories.data ?? []).map((category) => ({
    label: category.name,
    value: category.id,
  }));
  const stationOptions = (stations.data ?? [])
    .filter((station) => station.is_active)
    .map((station) => ({
      label: station.sends_to_kitchen
        ? station.name
        : `${station.name} · Sin comanda`,
      value: station.id,
    }));
  const supplierOptions = (suppliers.data ?? [])
    .filter((supplier) => supplier.is_active)
    .map((supplier) => ({ label: supplier.name, value: supplier.id }));

  const userFields: AdminField[] = [
    { name: "full_name", label: "Nombre completo", required: true },
    { name: "email", label: "Correo", type: "email", required: true },
    {
      name: "password",
      label: "Contraseña",
      type: "password",
      placeholder: "Al crear, obligatoria · mínimo 12 caracteres",
      required: true,
      minLength: 12,
    },
    { name: "employee_number", label: "Número de empleado" },
    {
      name: "branch_id",
      label: "Sucursal",
      type: "select",
      required: true,
      options: [{ label: branchData.name, value: branchData.id }],
    },
    {
      name: "role_id",
      label: "Rol",
      type: "select",
      required: true,
      options: roleOptions,
    },
    {
      name: "is_active",
      label: "Usuario activo",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  const categoryFields: AdminField[] = [
    { name: "name", label: "Nombre", required: true },
    { name: "sort_order", label: "Orden", type: "number", defaultValue: 0 },
    { name: "description", label: "Descripción", type: "textarea" },
    {
      name: "is_active",
      label: "Categoría activa",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  const menuFields: AdminField[] = [
    { name: "name", label: "Nombre", required: true },
    { name: "sku", label: "SKU" },
    {
      name: "category_id",
      label: "Categoría",
      type: "select",
      required: true,
      options: categoryOptions,
    },
    {
      name: "station_id",
      label: "Estación",
      type: "select",
      required: true,
      options: stationOptions,
    },
    {
      name: "price",
      label: "Precio MXN",
      type: "number",
      step: "0.01",
      required: true,
    },
    {
      name: "expected_minutes",
      label: "Minutos esperados",
      type: "number",
      defaultValue: 15,
      required: true,
    },
    { name: "description", label: "Descripción de venta", type: "textarea" },
    {
      name: "image",
      label: "Fotografía del platillo o bebida",
      type: "file",
      currentName: "current_image_url",
    },
    {
      name: "is_available",
      label: "Disponible ahora",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "is_active",
      label: "Producto activo",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  const sectionFields: AdminField[] = [
    { name: "name", label: "Nombre", required: true },
    { name: "sort_order", label: "Orden", type: "number", defaultValue: 0 },
  ];
  const tableFields: AdminField[] = [
    { name: "name", label: "Nombre", required: true },
    {
      name: "section_id",
      label: "Sección",
      type: "select",
      options: sectionOptions,
    },
    {
      name: "capacity",
      label: "Capacidad",
      type: "number",
      required: true,
      defaultValue: 4,
    },
    { name: "sort_order", label: "Orden", type: "number", defaultValue: 0 },
  ];
  const stationFields: AdminField[] = [
    { name: "name", label: "Nombre", required: true },
    {
      name: "station_type",
      label: "Tipo",
      type: "select",
      required: true,
      options: [
        { label: "Cocina fría", value: "cold_kitchen" },
        { label: "Cocina caliente", value: "hot_kitchen" },
        { label: "Barra", value: "bar" },
        { label: "Expedición", value: "expedition" },
      ],
    },
    {
      name: "sends_to_kitchen",
      label: "Enviar comanda a cocina",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "attention_minutes",
      label: "Atención (min)",
      type: "number",
      defaultValue: 10,
    },
    {
      name: "delayed_minutes",
      label: "Demora (min)",
      type: "number",
      defaultValue: 18,
    },
    {
      name: "critical_minutes",
      label: "Crítico (min)",
      type: "number",
      defaultValue: 25,
    },
    {
      name: "is_active",
      label: "Estación activa",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  const supplierFields: AdminField[] = [
    { name: "name", label: "Proveedor", required: true },
    { name: "contact_name", label: "Contacto" },
    { name: "phone", label: "Teléfono" },
    { name: "email", label: "Correo", type: "email" },
    {
      name: "is_active",
      label: "Proveedor activo",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  const ingredientFields: AdminField[] = [
    { name: "name", label: "Producto / ingrediente", required: true },
    { name: "sku", label: "SKU" },
    {
      name: "supplier_id",
      label: "Proveedor",
      type: "select",
      options: supplierOptions,
    },
    {
      name: "unit",
      label: "Unidad",
      type: "select",
      required: true,
      options: [
        { label: "Gramos", value: "g" },
        { label: "Kilogramos", value: "kg" },
        { label: "Mililitros", value: "ml" },
        { label: "Litros", value: "l" },
        { label: "Pieza", value: "piece" },
        { label: "Porción", value: "portion" },
      ],
    },
    {
      name: "minimum_quantity",
      label: "Existencia mínima",
      type: "number",
      step: "0.001",
      defaultValue: 0,
    },
    {
      name: "cost",
      label: "Costo unitario MXN",
      type: "number",
      step: "0.01",
      defaultValue: 0,
    },
    {
      name: "is_active",
      label: "Producto activo",
      type: "checkbox",
      defaultValue: true,
    },
  ];

  return (
    <main className="admin-page min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(20,184,166,.10),transparent_30%),radial-gradient(circle_at_92%_4%,rgba(245,158,11,.10),transparent_28%),#f7f8f6] pb-24">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-[1500px] items-center gap-3 px-4 sm:px-7">
          <Button asChild size="icon" variant="ghost">
            <Link href="/dashboard">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-teal-300">
            <Settings2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">Centro de control</p>
            <p className="truncate text-xs text-slate-500">{branchData.name}</p>
          </div>
          <Badge
            variant="outline"
            className="hidden gap-1.5 rounded-full bg-white sm:flex"
          >
            <ShieldCheck className="size-3.5 text-teal-700" /> Administración
            segura
          </Badge>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold text-teal-700">
            Todo tu restaurante, en un lugar
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-.035em] text-slate-950 sm:text-5xl">
            Configura, crea y toma el control.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Una consola poderosa para tu equipo, tu carta, el salón, inventario,
            marca y conversaciones.
          </p>
        </div>
        <ConnectionAddress addresses={serverAddresses} />
        <Tabs defaultValue="brand" className="space-y-6">
          <ShiftControl shift={currentShift.data} />
          <TabsList className="h-auto w-full [scrollbar-width:none] justify-start gap-1 overflow-x-auto rounded-2xl border border-white bg-white/80 p-1.5 shadow-sm [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="brand" className="rounded-xl px-4 py-2.5">
              <Sparkles /> Marca
            </TabsTrigger>
            <TabsTrigger value="menu" className="rounded-xl px-4 py-2.5">
              <Utensils /> Menú
            </TabsTrigger>
            <TabsTrigger value="floor" className="rounded-xl px-4 py-2.5">
              <LayoutDashboard /> Salón
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-xl px-4 py-2.5">
              <Boxes /> Inventario
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl px-4 py-2.5">
              <BarChart3 /> Inteligencia
            </TabsTrigger>
            <TabsTrigger value="team" className="rounded-xl px-4 py-2.5">
              <ShieldCheck /> Equipo
            </TabsTrigger>
            <TabsTrigger value="inbox" className="rounded-xl px-4 py-2.5">
              <MessageCircleMore /> Redes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="brand">
            <BrandStudio
              branch={{
                id: branchData.id,
                name: branchData.name,
                logo_url: branchData.logo_url,
                logo_scale: Number(brand.logo_scale ?? 100),
                logo_position: String(brand.logo_position ?? "center"),
                accent: String(brand.accent ?? "#ef8354"),
              }}
            />
          </TabsContent>
          <TabsContent value="menu" className="space-y-6">
            <Tabs defaultValue="dishes" className="space-y-5">
              <TabsList className="grid h-auto w-full max-w-xl grid-cols-2 rounded-2xl bg-white p-1.5 shadow-sm">
                <TabsTrigger
                  value="dishes"
                  className="min-h-12 rounded-xl font-semibold"
                >
                  Platillos y bebidas
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="min-h-12 rounded-xl font-semibold"
                >
                  Categorías
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dishes">
                <AdminCrud
                  title="Platillos y bebidas"
                  description="Carta visual con precios, disponibilidad, estación e imagen propia."
                  createLabel="Nuevo elemento"
                  emptyLabel="Tu carta aún está vacía."
                  fields={menuFields}
                  records={(menuItems.data ?? []).map((item) => ({
                    id: item.id,
                    title: item.name,
                    subtitle: `$${(Number(item.price_cents) / 100).toFixed(2)} · ${item.is_available ? "Disponible" : "No disponible"}`,
                    name: item.name,
                    sku: item.sku ?? "",
                    description: item.description ?? "",
                    price: Number(item.price_cents) / 100,
                    expected_minutes: item.expected_minutes,
                    category_id: item.category_id,
                    station_id: item.station_id,
                    is_available: item.is_available,
                    is_active: item.is_active,
                    image_url: item.image_url,
                    current_image_url: item.image_url,
                  }))}
                  saveAction={saveMenuItem}
                  deleteAction={deleteMenuItem}
                />
              </TabsContent>
              <TabsContent value="categories">
                <AdminCrud
                  title="Categorías"
                  description="Organiza platillos, bebidas y especiales para navegar la carta con rapidez."
                  createLabel="Nueva categoría"
                  emptyLabel="No hay categorías."
                  fields={categoryFields}
                  records={(categories.data ?? []).map((item) => ({
                    id: item.id,
                    title: item.name,
                    subtitle: item.description ?? "Sin descripción",
                    name: item.name,
                    description: item.description ?? "",
                    sort_order: item.sort_order,
                    is_active: item.is_active,
                  }))}
                  saveAction={saveCategory}
                  deleteAction={deleteCategory}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="floor" className="space-y-6">
            <AdminCrud
              title="Mesas"
              description="Capacidad, sección y orden operativo del plano de piso."
              createLabel="Nueva mesa"
              emptyLabel="No hay mesas."
              fields={tableFields}
              records={(tables.data ?? []).map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${item.capacity} personas · ${item.status}`,
                name: item.name,
                section_id: item.section_id,
                capacity: item.capacity,
                sort_order: item.sort_order,
              }))}
              saveAction={saveTable}
              deleteAction={deleteTable}
            />
            <AdminCrud
              title="Secciones"
              description="Interior, terraza, barra o cualquier área de servicio."
              createLabel="Nueva sección"
              emptyLabel="No hay secciones."
              fields={sectionFields}
              records={(sections.data ?? []).map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `Orden ${item.sort_order}`,
                name: item.name,
                sort_order: item.sort_order,
              }))}
              saveAction={saveSection}
              deleteAction={deleteSection}
            />
            <AdminCrud
              title="Estaciones de preparación"
              description="Configura cocina fría, caliente, barra y expedición con sus alertas de tiempo."
              createLabel="Nueva estación"
              emptyLabel="No hay estaciones."
              fields={stationFields}
              records={(stations.data ?? []).map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `Atención ${item.attention_minutes} min · Crítico ${item.critical_minutes} min`,
                name: item.name,
                station_type: item.station_type,
                sends_to_kitchen: item.sends_to_kitchen,
                attention_minutes: item.attention_minutes,
                delayed_minutes: item.delayed_minutes,
                critical_minutes: item.critical_minutes,
                is_active: item.is_active,
              }))}
              saveAction={saveStation}
              deleteAction={disableStation}
              deleteLabel="Desactivar"
            />
          </TabsContent>
          <TabsContent value="inventory" className="space-y-6">
            <InventoryMovementForm
              ingredients={(ingredients.data ?? []).map((item) => ({
                id: item.id,
                name: item.name,
                stock: Number(item.stock_quantity),
                unit: item.unit,
              }))}
            />
            <AdminCrud
              title="Productos e ingredientes"
              description="Existencias, mínimos, costos y unidad de cada insumo."
              createLabel="Nuevo producto"
              emptyLabel="No hay productos de inventario."
              fields={ingredientFields}
              records={(ingredients.data ?? []).map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${item.stock_quantity} ${item.unit} · mínimo ${item.minimum_quantity}`,
                name: item.name,
                sku: item.sku ?? "",
                supplier_id: item.supplier_id,
                unit: item.unit,
                minimum_quantity: Number(item.minimum_quantity),
                cost: Number(item.cost_cents) / 100,
                is_active: item.is_active,
              }))}
              saveAction={saveIngredient}
              deleteAction={disableIngredient}
              deleteLabel="Desactivar"
            />
            <AdminCrud
              title="Proveedores"
              description="Directorio de compras y contactos comerciales."
              createLabel="Nuevo proveedor"
              emptyLabel="No hay proveedores."
              fields={supplierFields}
              records={(suppliers.data ?? []).map((item) => {
                const contact = (item.contact ?? {}) as Record<string, string>;
                return {
                  id: item.id,
                  title: item.name,
                  subtitle: contact.phone || contact.email || "Sin contacto",
                  name: item.name,
                  contact_name: contact.contact_name ?? "",
                  phone: contact.phone ?? "",
                  email: contact.email ?? "",
                  is_active: item.is_active,
                };
              })}
              saveAction={saveSupplier}
              deleteAction={disableSupplier}
              deleteLabel="Desactivar"
            />
            <MovementHistory
              movements={(movements.data ?? []).map((movement) => ({
                id: movement.id,
                name: relationName(movement.ingredient),
                quantity: Number(movement.quantity),
                type: movement.movement_type,
                reason: movement.reason,
                created_at: movement.created_at,
              }))}
            />
          </TabsContent>
          <TabsContent value="team">
            <SecurityPinForm />
            <AdminCrud
              title="Usuarios y accesos"
              description={
                !permissions["users.manage"]
                  ? "Tu rol no tiene permiso para administrar usuarios."
                  : managedUsers?.error
                    ? "No se pudo conectar con el servicio seguro de usuarios. Revisa la conexión e inténtalo de nuevo."
                    : "Altas, roles, suspensión, correo y cambio seguro de contraseña."
              }
              createLabel="Nuevo usuario"
              emptyLabel="No hay usuarios visibles."
              fields={userFields}
              records={(users.data ?? []).map((item) => ({
                id: item.id,
                title: item.full_name,
                subtitle: `${emailById.get(item.id) || "Correo protegido"} · ${item.is_active ? "Activo" : "Suspendido"}`,
                full_name: item.full_name,
                email: emailById.get(item.id) ?? "",
                password: "",
                employee_number: item.employee_number ?? "",
                branch_id: item.branch_id,
                role_id: item.role_id,
                is_active: item.is_active,
              }))}
              saveAction={saveUser}
              deleteAction={deleteUser}
              deleteLabel="Eliminar definitivamente"
            />
          </TabsContent>
          <TabsContent value="analytics">
            <SalesIntelligence
              settings={recommendationSettings.data}
              rows={(performance.data ?? []) as PerformanceRow[]}
            />
          </TabsContent>
          <TabsContent value="inbox">
            <OmnichannelCard />
          </TabsContent>
        </Tabs>
      </div>
      <AiConcierge />
    </main>
  );
}

function InventoryMovementForm({
  ingredients,
}: {
  ingredients: { id: string; name: string; stock: number; unit: string }[];
}) {
  return (
    <section className="rounded-[1.75rem] bg-gradient-to-br from-teal-950 to-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr]">
        <div>
          <p className="text-xs font-semibold tracking-[.2em] text-teal-300 uppercase">
            Movimiento rápido
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Actualiza existencias con trazabilidad.
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Compras y entradas usan cantidad positiva. Merma, venta o salida
            usan cantidad negativa.
          </p>
        </div>
        <form
          action={recordInventoryMovement}
          className="grid gap-3 sm:grid-cols-2"
        >
          <select
            name="ingredient_id"
            required
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm"
          >
            <option value="">Selecciona producto</option>
            {ingredients.map((item) => (
              <option key={item.id} value={item.id} className="text-slate-900">
                {item.name} · {item.stock} {item.unit}
              </option>
            ))}
          </select>
          <select
            name="movement_type"
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm"
          >
            <option value="purchase" className="text-slate-900">
              Compra / entrada
            </option>
            <option value="adjustment" className="text-slate-900">
              Ajuste
            </option>
            <option value="waste" className="text-slate-900">
              Merma
            </option>
            <option value="transfer_in" className="text-slate-900">
              Transferencia entrada
            </option>
            <option value="transfer_out" className="text-slate-900">
              Transferencia salida
            </option>
          </select>
          <input
            name="quantity"
            type="number"
            step="0.001"
            required
            placeholder="Cantidad (+ / -)"
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm placeholder:text-white/35"
          />
          <input
            name="unit_cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="Costo unitario MXN"
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm placeholder:text-white/35"
          />
          <input
            name="reason"
            required
            placeholder="Motivo o referencia"
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm placeholder:text-white/35 sm:col-span-2"
          />
          <Button
            type="submit"
            className="rounded-xl bg-teal-300 text-teal-950 hover:bg-teal-200 sm:col-span-2"
          >
            Registrar movimiento
          </Button>
        </form>
      </div>
    </section>
  );
}

function ShiftControl({
  shift,
}: {
  shift: {
    id: string;
    name: string;
    opened_at: string;
    opened_by: string;
  } | null;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
      <span
        className={`size-3 shrink-0 rounded-full ${shift ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.12)]" : "bg-slate-300"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">
          {shift ? "Turno abierto" : "Sucursal sin turno abierto"}
        </p>
        <p className="truncate text-xs text-slate-500">
          {shift
            ? `${shift.name} · ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(shift.opened_at))}`
            : "Sólo un administrador puede iniciar la operación."}
        </p>
      </div>
      <form action={toggleShift}>
        <input
          type="hidden"
          name="operation"
          value={shift ? "close" : "open"}
        />
        <input type="hidden" name="shift_id" value={shift?.id ?? ""} />
        <Button
          type="submit"
          variant={shift ? "outline" : "default"}
          className="w-full rounded-xl sm:w-auto"
        >
          {shift ? "Cerrar turno" : "Abrir turno"}
        </Button>
      </form>
    </section>
  );
}

function MovementHistory({
  movements,
}: {
  movements: {
    id: string;
    name: string;
    quantity: number;
    type: string;
    reason: string | null;
    created_at: string;
  }[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Movimientos recientes</h2>
      <div className="mt-5 divide-y">
        {movements.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-3 text-sm">
            <span
              className={`grid size-9 place-items-center rounded-xl font-semibold ${item.quantity >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
            >
              {item.quantity >= 0 ? "+" : "−"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="truncate text-xs text-slate-400">
                {item.reason || item.type}
              </p>
            </div>
            <span className="font-mono text-xs">{item.quantity}</span>
          </div>
        ))}
        {movements.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            Aún no hay movimientos.
          </p>
        )}
      </div>
    </section>
  );
}

type PerformanceRow = {
  menu_item_id: string;
  item_name: string;
  category_name: string;
  units_sold: number;
  previous_units_sold: number;
  revenue_cents: number;
  estimated_cost_cents: number;
  gross_margin_cents: number;
  gross_margin_basis_points: number;
  sales_trend_percent: number;
  recommendation_score: number;
};

function SalesIntelligence({
  settings,
  rows,
}: {
  settings: Record<string, unknown> | null;
  rows: PerformanceRow[];
}) {
  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });
  const topRecommendation = [...rows]
    .sort(
      (a, b) => Number(b.recommendation_score) - Number(a.recommendation_score),
    )
    .find((row) => Number(row.recommendation_score) > 0);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
        <div className="rounded-[1.75rem] bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 p-7 text-slate-950 shadow-xl shadow-orange-900/10">
          <p className="text-xs font-semibold tracking-[.2em] uppercase">
            Sugerencia para el equipo
          </p>
          {topRecommendation ? (
            <>
              <h2 className="mt-8 text-3xl font-semibold tracking-tight">
                Ofrece {topRecommendation.item_name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-800/70">
                Combina oportunidad de rotación y margen. Puntaje{" "}
                {Number(topRecommendation.recommendation_score).toFixed(1)}/100.
              </p>
              <div className="mt-8 flex gap-2">
                <Badge className="bg-white/60 text-slate-900 hover:bg-white/60">
                  {topRecommendation.units_sold} vendidos
                </Badge>
                <Badge className="bg-white/60 text-slate-900 hover:bg-white/60">
                  {(
                    Number(topRecommendation.gross_margin_basis_points) / 100
                  ).toFixed(1)}
                  % margen
                </Badge>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-8 text-2xl font-semibold">
                Esperando las primeras ventas
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-800/70">
                Las recomendaciones aparecerán cuando exista actividad real.
              </p>
            </>
          )}
        </div>
        <form
          action={saveRecommendationSettings}
          className="rounded-[1.75rem] border border-white bg-white/90 p-7 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-semibold">
              Estrategia de recomendación
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ajusta el criterio que verá el personal. Los tres pesos deben
              sumar 100%.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MetricInput
              name="margin_weight"
              label="Margen"
              value={Number(settings?.margin_weight ?? 45)}
            />
            <MetricInput
              name="low_sales_weight"
              label="Baja rotación"
              value={Number(settings?.low_sales_weight ?? 35)}
            />
            <MetricInput
              name="inventory_weight"
              label="Inventario"
              value={Number(settings?.inventory_weight ?? 20)}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricInput
              name="minimum_margin"
              label="Margen mínimo %"
              value={
                Number(settings?.minimum_margin_basis_points ?? 3000) / 100
              }
            />
            <MetricInput
              name="lookback_days"
              label="Días de análisis"
              value={Number(settings?.lookback_days ?? 30)}
            />
          </div>
          <label className="mt-4 block text-sm font-medium">
            Mensaje para meseros
            <textarea
              name="recommendation_message"
              defaultValue={String(settings?.recommendation_message ?? "")}
              placeholder="Ej. Recomienda con naturalidad y pregunta primero por preferencias."
              className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={Boolean(settings?.is_active ?? true)}
                className="accent-teal-800"
              />{" "}
              Asistente activo
            </label>
            <Button type="submit" className="rounded-xl bg-slate-950">
              Guardar estrategia
            </Button>
          </div>
        </form>
      </section>
      <section className="overflow-hidden rounded-[1.75rem] border border-white bg-white/90 shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="text-xl font-semibold">
            Rendimiento preciso · últimos{" "}
            {Number(settings?.lookback_days ?? 30)} días
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sólo órdenes no canceladas. El costo estimado proviene de recetas e
            ingredientes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Tendencia</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Costo est.</th>
                <th className="px-4 py-3 text-right">Margen</th>
                <th className="px-6 py-3 text-right">Recomendación</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.menu_item_id} className="hover:bg-teal-50/30">
                  <td className="px-6 py-4">
                    <p className="font-medium">{row.item_name}</p>
                    <p className="text-xs text-slate-400">
                      {row.category_name}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {row.units_sold}
                  </td>
                  <td
                    className={`px-4 py-4 text-right font-medium ${Number(row.sales_trend_percent) >= 0 ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {Number(row.sales_trend_percent) > 0 ? "+" : ""}
                    {Number(row.sales_trend_percent).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-right">
                    {currency.format(Number(row.revenue_cents) / 100)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-500">
                    {currency.format(Number(row.estimated_cost_cents) / 100)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-medium">
                      {currency.format(Number(row.gross_margin_cents) / 100)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(Number(row.gross_margin_basis_points) / 100).toFixed(1)}
                      %
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Badge variant="outline" className="rounded-full">
                      {Number(row.recommendation_score).toFixed(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-14 text-center text-slate-400"
                  >
                    No hay productos activos para analizar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricInput({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        name={name}
        type="number"
        min="0"
        max={name === "lookback_days" ? 365 : 100}
        defaultValue={value}
        required
        className="mt-2 h-10 w-full rounded-xl border px-3 font-normal"
      />
    </label>
  );
}

function OmnichannelCard() {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-950/5">
      <div className="grid lg:grid-cols-2">
        <div className="bg-gradient-to-br from-[#075e54] to-[#102f36] p-8 text-white sm:p-12">
          <MessageCircleMore className="size-10 text-emerald-300" />
          <p className="mt-8 text-xs font-semibold tracking-[.22em] text-emerald-300 uppercase">
            Bandeja omnicanal
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            WhatsApp y redes, sincronizados.
          </h2>
          <p className="mt-3 leading-7 text-white/60">
            Centraliza mensajes de WhatsApp Business, Instagram y Facebook; Mar
            sugiere respuestas usando el contexto real del menú.
          </p>
        </div>
        <div className="p-8 sm:p-12">
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Credenciales pendientes
          </Badge>
          <h3 className="mt-5 text-xl font-semibold">
            Lista para conectar con Meta
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La integración utilizará webhooks firmados y tokens únicamente del
            servidor. Faltará registrar la URL pública y cargar las credenciales
            de Meta Business.
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <Status label="WhatsApp Business Cloud API" />
            <Status label="Instagram Messaging" />
            <Status label="Facebook Messenger" />
          </div>
        </div>
      </div>
    </section>
  );
}
function Status({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3">
      <span>{label}</span>
      <span className="size-2 rounded-full bg-amber-400" />
    </div>
  );
}
function relationName(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && "name" in item
    ? String(item.name)
    : "Producto";
}
