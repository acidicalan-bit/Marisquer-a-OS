import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv, requirePublicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const env = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies; proxy.ts renueva la sesión.
          }
        },
      },
    },
  );
}

export async function createOptionalSupabaseServerClient() {
  return getPublicEnv() ? createSupabaseServerClient() : null;
}
