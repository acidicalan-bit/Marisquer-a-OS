"use client";

import { Check, Copy, Network } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ConnectionAddress({ addresses }: { addresses: string[] }) {
  const [copied, setCopied] = useState<string>();

  async function copy(address: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(address);
    } else {
      const field = document.createElement("textarea");
      field.value = address;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(address);
    window.setTimeout(() => setCopied(undefined), 2000);
  }

  return (
    <section className="mb-6 rounded-[1.75rem] border border-teal-100 bg-teal-950 p-5 text-white shadow-xl shadow-teal-950/10 sm:flex sm:items-center sm:gap-5 sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-300/15 text-teal-200">
        <Network className="size-6" />
      </span>
      <div className="mt-4 min-w-0 flex-1 sm:mt-0">
        <p className="text-xs font-semibold tracking-[.16em] text-teal-300 uppercase">
          Servidor local Barlovento
        </p>
        {addresses.length ? (
          <div className="mt-2 space-y-2">
            {addresses.map((address) => (
              <div
                className="flex min-h-11 items-center gap-2 rounded-xl bg-white/8 px-3"
                key={address}
              >
                <code className="min-w-0 flex-1 truncate text-sm text-white">
                  {address}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-11 text-white hover:bg-white/10 hover:text-white"
                  aria-label={`Copiar ${address}`}
                  onClick={() => void copy(address)}
                >
                  {copied === address ? <Check /> : <Copy />}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-200">
            Conecta la PC a la red local para mostrar su dirección.
          </p>
        )}
      </div>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/60 sm:mt-0">
        Las APK ahora buscan la PC automáticamente dentro del mismo Wi-Fi. Si
        la red bloquea el descubrimiento, puedes usar una de estas direcciones
        como alternativa.
      </p>
    </section>
  );
}
