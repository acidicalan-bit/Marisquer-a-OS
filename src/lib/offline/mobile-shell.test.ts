// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve("mobile-shell/index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const applicationScript = scripts.at(-1)?.[1] ?? "";

describe("shell Android offline-first", () => {
  it("contiene JavaScript válido y ejecutable sin un servidor web", () => {
    expect(applicationScript.length).toBeGreaterThan(1_000);
    expect(() => new Function(applicationScript)).not.toThrow();
  });

  it.each([
    "order.submitted",
    "table.status_changed",
    "kitchen.item_status_changed",
  ])("incluye el contrato %s", (eventType) => {
    expect(applicationScript).toContain(eventType);
  });

  it("persiste copia, cola, dispositivo y dirección fuera del origen remoto", () => {
    expect(html).toContain("marisqueria_offline_snapshot_v1");
    expect(html).toContain("marisqueria_offline_queue_v1");
    expect(html).toContain("marisqueria_pc_url");
    expect(html).toContain("plugins && plugins.Preferences");
    expect(html).toContain("plugin.verifyServer({ url: base })");
  });

  it("mantiene el shell compatible con el WebView 75 de Android 9", () => {
    expect(applicationScript).not.toMatch(/\?\.|\?\?|\.replaceAll\(|crypto\.randomUUID\(/);
    expect(applicationScript).toContain("function createId()");
  });

  it("busca automáticamente un servidor Barlovento y valida su estado antes de conectar", () => {
    expect(applicationScript).toContain("ServerDiscovery");
    expect(applicationScript).toContain("discoverServer");
    expect(applicationScript).toContain("await verify(candidate)");
    expect(readFileSync(resolve("electron/main.mjs"), "utf8")).toContain(
      "BARLOVENTO_DISCOVER_V1",
    );
  });

  it("mantiene las acciones financieras y administrativas sensibles en línea", () => {
    expect(html).toContain("Caja segura");
    expect(html).toContain("Para cobrar, dar descuentos, cancelar partidas");
    expect(html).toContain("reconecta con el sistema central");
  });

  it("separa captura por pasos, pagina el menú, incluye alergias y conserva caja como aplicación propia", () => {
    expect(applicationScript).toContain("Mis comandas");
    expect(applicationScript).toContain("categoryName");
    expect(applicationScript).toContain("category-chip");
    expect(applicationScript).toContain("menuPageSize = 12");
    expect(applicationScript).toContain("allergy_alert: lineAllergies[menuItemId]");
    expect(applicationScript).toContain('cashier: "/cash"');
    expect(readFileSync(resolve("android/app/build.gradle"), "utf8")).toContain("mx.marisqueria.os.cashier");
  });

  it("abre la copia local y conserva un pedido cuando la PC no responde", async () => {
    const values = new Map<string, string>([
      ["marisqueria_pc_url", "http://192.168.0.9:3210"],
      ["marisqueria_offline_queue_v1", "[]"],
      [
        "marisqueria_offline_snapshot_v1",
        JSON.stringify({
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          user: {
            id: crypto.randomUUID(),
            name: "Mesero Prueba",
            roleCode: "waiter",
            branchId: crypto.randomUUID(),
            branchName: "Sucursal Prueba",
          },
          tables: [
            {
              id: crypto.randomUUID(),
              name: "Mesa 1",
              capacity: 4,
              status: "free",
              version: 1,
            },
          ],
          menu: [
            {
              id: crypto.randomUUID(),
              categoryId: crypto.randomUUID(),
              stationId: crypto.randomUUID(),
              name: "Tostada",
              priceCents: 12500,
              available: true,
            },
          ],
          kitchenItems: [],
        }),
      ],
    ]);
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "http://localhost",
      beforeParse(window) {
        Object.defineProperty(window, "crypto", { value: webcrypto });
        Object.defineProperty(window, "Capacitor", {
          value: {
            Plugins: {
              Preferences: {
                get: async ({ key }: { key: string }) => ({
                  value: values.get(key) ?? null,
                }),
                set: async ({ key, value }: { key: string; value: string }) => {
                  values.set(key, value);
                },
                remove: async ({ key }: { key: string }) => {
                  values.delete(key);
                },
              },
            },
          },
        });
        Object.defineProperty(window, "fetch", {
          value: async (url: string) => {
            if (url === "./app-role.json") {
              return { json: async () => ({ role: "service" }) };
            }
            throw new Error("offline");
          },
        });
      },
    });

    await vi.waitFor(() => {
      expect(
        dom.window.document.querySelector<HTMLElement>("#offline")?.style
          .display,
      ).toBe("block");
    });
    dom.window.document
      .querySelector<HTMLButtonElement>("[data-select-table]")
      ?.click();
    dom.window.document
      .querySelector<HTMLButtonElement>("[data-plus]")
      ?.click();
    const allergy = dom.window.document.querySelector<HTMLInputElement>("[data-allergy]");
    expect(allergy).not.toBeNull();
    if (allergy) {
      allergy.value = "Alergia al camarón";
      allergy.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    }
    dom.window.document
      .querySelector<HTMLButtonElement>("#review-order")
      ?.click();
    dom.window.document
      .querySelector<HTMLButtonElement>("#save-order")
      ?.click();

    await vi.waitFor(() => {
      const queued = JSON.parse(
        values.get("marisqueria_offline_queue_v1") ?? "[]",
      ) as Array<{
        type: string;
        userId: string;
        branchId: string;
        payload: { items: Array<{ allergy_alert?: string }> };
      }>;
      expect(queued).toHaveLength(1);
      expect(queued[0]?.type).toBe("order.submitted");
      expect(queued[0]?.userId).toBeTruthy();
      expect(queued[0]?.branchId).toBeTruthy();
      expect(queued[0]?.payload.items).toHaveLength(1);
      expect(queued[0]?.payload.items[0]?.allergy_alert).toBe("Alergia al camarón");
      expect(dom.window.document.body.textContent).toContain("Mis comandas");
      expect(dom.window.document.body.textContent).toContain("Pendiente de sincronizar");
    });
    dom.window.close();
  });
});
