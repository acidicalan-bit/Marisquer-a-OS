import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requirePublicEnv } from "@/lib/env";

export function hasSupabaseAdminKey() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createSupabaseAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = requirePublicEnv();
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY. Es necesaria para administrar usuarios y contraseñas.",
    );
  }

  return createClient(NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
