"use client";

import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    marisqueriaDesktop?: {
      listPrinters: () => Promise<{
        success: boolean;
        printers: Array<{
          name: string;
          displayName: string;
          description: string;
          isDefault: boolean;
        }>;
        error?: string;
      }>;
      printReceipt: (
        deviceName?: string,
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export function PrintReceiptButton() {
  const [message, setMessage] = useState<string>();
  const [printers, setPrinters] = useState<
    Array<{ name: string; displayName: string; isDefault: boolean }>
  >([]);
  const [deviceName, setDeviceName] = useState("");
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(true);

  useEffect(() => {
    const desktop = window.marisqueriaDesktop;
    if (!desktop) return;
    void Promise.resolve().then(async () => {
      setDesktopEnabled(true);
      const result = await desktop.listPrinters();
      setLoadingPrinters(false);
      if (!result.success) {
        setMessage(result.error ?? "No se pudieron consultar las impresoras.");
        return;
      }
      setPrinters(result.printers);
      const saved = window.localStorage.getItem("marisqueria.receiptPrinter");
      const selected = result.printers.find(
        (printer) => printer.name === saved,
      );
      setDeviceName(
        selected?.name ??
          result.printers.find((printer) => printer.isDefault)?.name ??
          result.printers[0]?.name ??
          "",
      );
    });
  }, []);

  function selectPrinter(value: string) {
    setDeviceName(value);
    window.localStorage.setItem("marisqueria.receiptPrinter", value);
  }

  async function print() {
    setMessage(undefined);
    if (!window.marisqueriaDesktop) {
      window.print();
      return;
    }
    if (!deviceName) {
      setMessage(
        "Windows no reportó una impresora. Instálala en Configuración > Impresoras y vuelve a abrir la app.",
      );
      return;
    }
    const result = await window.marisqueriaDesktop.printReceipt(deviceName);
    setMessage(
      result.success ? "Ticket enviado a la impresora." : result.error,
    );
  }

  return (
    <div className="no-print space-y-3 text-center">
      {desktopEnabled && (
        <label className="block text-left text-sm font-medium text-slate-700">
          Impresora de tickets
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
            value={deviceName}
            onChange={(event) => selectPrinter(event.target.value)}
            disabled={loadingPrinters || printers.length === 0}
          >
            {printers.length === 0 && (
              <option value="">
                {loadingPrinters ? "Buscando impresoras…" : "Sin impresoras"}
              </option>
            )}
            {printers.map((printer) => (
              <option key={printer.name} value={printer.name}>
                {printer.displayName}
                {printer.isDefault ? " (predeterminada)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button className="h-12" onClick={() => void print()}>
        <Printer /> Imprimir ticket
      </Button>
      {message && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
