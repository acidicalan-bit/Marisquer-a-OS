export type OfflineRole = "admin" | "service" | "kitchen" | "host";

export type OfflineEventType =
  "order.submitted" | "table.status_changed" | "kitchen.item_status_changed";

export interface OfflineEvent {
  id: string;
  userId: string;
  branchId: string;
  type: OfflineEventType;
  entityId: string;
  baseVersion?: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface OfflineSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  user: {
    id: string;
    name: string;
    roleCode: string;
    branchId: string;
    branchName: string;
  };
  tables: Array<{
    id: string;
    name: string;
    capacity: number;
    status: string;
    version: number;
  }>;
  menu: Array<{
    id: string;
    categoryId: string;
    name: string;
    priceCents: number;
    stationId: string;
    available: boolean;
  }>;
  kitchenItems: Array<{
    id: string;
    orderId: string;
    menuItemName: string;
    quantity: number;
    notes: string | null;
    status: string;
    version: number;
    createdAt: string;
  }>;
}

export interface OfflineSyncResult {
  eventId: string;
  status: "applied" | "conflict" | "rejected";
  detail?: Record<string, unknown>;
}
