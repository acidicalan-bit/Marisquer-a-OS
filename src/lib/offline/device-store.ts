"use client";

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

import type {
  OfflineEvent,
  OfflineSnapshot,
  OfflineSyncResult,
} from "@/lib/offline/types";
import { createUuid } from "@/lib/uuid";

const KEYS = {
  deviceId: "marisqueria_offline_device_id",
  queue: "marisqueria_offline_queue_v1",
  snapshot: "marisqueria_offline_snapshot_v1",
  syncResults: "marisqueria_offline_sync_results_v1",
  serverUrl: "marisqueria_pc_url",
} as const;

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const { value } = await Preferences.get({ key });
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function getOfflineDeviceId() {
  const existing = await Preferences.get({ key: KEYS.deviceId });
  if (existing.value) return existing.value;
  const created = createUuid();
  await Preferences.set({ key: KEYS.deviceId, value: created });
  return created;
}

export function readOfflineQueue() {
  return readJson<OfflineEvent[]>(KEYS.queue, []);
}

export async function replaceOfflineQueue(events: OfflineEvent[]) {
  await writeJson(KEYS.queue, events);
}

export async function storeOfflineSnapshot(snapshot: OfflineSnapshot) {
  await Promise.all([
    writeJson(KEYS.snapshot, snapshot),
    Preferences.set({ key: KEYS.serverUrl, value: window.location.origin }),
  ]);
}

export async function storeSyncResults(results: OfflineSyncResult[]) {
  const previous = await readJson<OfflineSyncResult[]>(KEYS.syncResults, []);
  await writeJson(KEYS.syncResults, [...results, ...previous].slice(0, 100));
}
