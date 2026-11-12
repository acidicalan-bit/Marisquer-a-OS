"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function KitchenRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-label="Actualizar comandas"
      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      {pending ? "Actualizando…" : "Actualizar"}
    </Button>
  );
}
