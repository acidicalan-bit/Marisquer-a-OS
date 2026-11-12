"use client";

import { useEffect } from "react";

import {
  getOfflineDeviceId,
  isNativeApp,
  readOfflineQueue,
  replaceOfflineQueue,
  storeOfflineSnapshot,
  storeSyncResults,
} from "@/lib/offline/device-store";
import type { OfflineSnapshot, OfflineSyncResult } from "@/lib/offline/types";

async function syncPendingEvents() {
  const events = await readOfflineQueue();
  if (!events.length) return;
  const response = await fetch("/api/offline/sync", {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: await getOfflineDeviceId(),
      events: events.slice(0, 100),
    }),
  });
  if (!response.ok) throw new Error("No se pudo sincronizar la cola local.");
  const payload = (await response.json()) as { results: OfflineSyncResult[] };
  const completed = new Set(payload.results.map((result) => result.eventId));
  await Promise.all([
    replaceOfflineQueue(events.filter((event) => !completed.has(event.id))),
    storeSyncResults(payload.results),
  ]);
}

async function refreshSnapshot() {
  const response = await fetch("/api/offline/bootstrap", {
    cache: "no-store",
  });
  if (!response.ok) return;
  await storeOfflineSnapshot((await response.json()) as OfflineSnapshot);
}

export function OfflineSyncBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let stopped = false;

    async function synchronize() {
      if (stopped || !navigator.onLine) return;
      try {
        await syncPendingEvents();
        await refreshSnapshot();
      } catch {
        // La cola permanece intacta y se reintenta al recuperar la conexión.
      }
    }

    void synchronize();
    window.addEventListener("online", synchronize);
    const interval = window.setInterval(synchronize, 30_000);
    return () => {
      stopped = true;
      window.removeEventListener("online", synchronize);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
