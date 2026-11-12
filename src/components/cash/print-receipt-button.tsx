"use client";

import { Printer } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    marisqueriaDesktop?: {
      printReceipt: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export function PrintReceiptButton() {
  const [message, setMessage] = useState<string>();
  const desktopAvailable = useSyncExternalStore(
    subscribeDesktopBridge,
    getDesktopAvailability,
    () => false,
  );

  async function print() {
    setMessage(undefined);
    if (!window.marisqueriaDesktop) {
      setMessage("La impresión física solo está disponible desde la aplicación de caja configurada.");
      return;
    }
    const result = await window.marisqueriaDesktop.printReceipt();
    setMessage(
      result.success ? "Ticket enviado a la impresora." : result.error,
    );
  }

  return (
    <div className="no-print text-center">
      {desktopAvailable && <Button className="h-12" onClick={() => void print()}>
        <Printer /> Imprimir ticket
      </Button>}
      {message && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function subscribeDesktopBridge() {
  return () => undefined;
}

function getDesktopAvailability() {
  return typeof window !== "undefined" && Boolean(window.marisqueriaDesktop);
}
