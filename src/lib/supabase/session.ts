import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";

export async function refreshSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  if (!env) return response;

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` valida la sesión contra Auth y permite que Supabase SSR
  // renueve el access token usando el refresh token. `getClaims()` sólo
  // valida los claims locales y puede dejar una tablet con un token vencido
  // aunque todavía conserve una sesión renovable.
  const { data } = await supabase.auth.getUser();
  const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
  const isLogin = request.nextUrl.pathname === "/login";

  if (!data?.user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (data?.user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
