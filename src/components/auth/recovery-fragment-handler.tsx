"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AuthError } from "@supabase/supabase-js";

import { parseRecoveryTokens } from "@/lib/auth/recovery";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function RecoveryFragmentHandler() {
  const router = useRouter();

  useEffect(() => {
    const tokens = parseRecoveryTokens(window.location.hash);
    if (!tokens) return;

    // El fragmento contiene credenciales temporales. Se elimina antes de
    // cualquier operación asíncrona para que no permanezca visible ni termine
    // en una captura o historial del navegador.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );

    void getSupabaseBrowserClient()
      .auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      .then(({ error }: { error: AuthError | null }) => {
        if (error) {
          router.replace("/login?error=recovery_link_invalid");
          return;
        }

        router.replace("/account/password");
      });
  }, [router]);

  return null;
}
