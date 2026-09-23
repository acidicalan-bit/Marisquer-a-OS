import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: values.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      values.set(key, value);
    }),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: mocks.get, set: mocks.set },
}));

import {
  getOfflineDeviceId,
  isNativeApp,
  readOfflineQueue,
  replaceOfflineQueue,
  storeOfflineSnapshot,
} from "./device-store";
import type { OfflineEvent, OfflineSnapshot } from "./types";

beforeEach(() => {
  mocks.values.clear();
  mocks.get.mockClear();
  mocks.set.mockClear();
});

describe("almacenamiento offline del dispositivo", () => {
  it("crea un identificador estable por instalación", async () => {
    const first = await getOfflineDeviceId();
    const second = await getOfflineDeviceId();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).toBe(first);
    expect(isNativeApp()).toBe(true);
  });

  it("conserva una cola idempotente sin perder sus UUID", async () => {
    const event: OfflineEvent = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      branchId: crypto.randomUUID(),
      type: "table.status_changed",
      entityId: crypto.randomUUID(),
      baseVersion: 3,
      occurredAt: new Date().toISOString(),
      payload: { status: "reserved" },
    };

    await replaceOfflineQueue([event]);
    await expect(readOfflineQueue()).resolves.toEqual([event]);
  });

  it("recupera una cola vacía si el almacenamiento está dañado", async () => {
    mocks.values.set("marisqueria_offline_queue_v1", "{incompleto");
    await expect(readOfflineQueue()).resolves.toEqual([]);
  });

  it("guarda la copia operativa y la dirección que la produjo", async () => {
    const snapshot: OfflineSnapshot = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      user: {
        id: crypto.randomUUID(),
        name: "Prueba",
        roleCode: "waiter",
        branchId: crypto.randomUUID(),
        branchName: "Sucursal",
      },
      tables: [],
      menu: [],
      kitchenItems: [],
    };

    await storeOfflineSnapshot(snapshot);

    expect(
      JSON.parse(mocks.values.get("marisqueria_offline_snapshot_v1") ?? "null"),
    ).toEqual(snapshot);
    expect(mocks.values.get("marisqueria_pc_url")).toBe(window.location.origin);
  });
});
