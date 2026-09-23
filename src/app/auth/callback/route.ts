import { type NextRequest, NextResponse } from "next/server";

import { getCanonicalAppOrigin } from "@/lib/auth/recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const appOrigin = getCanonicalAppOrigin(request.url);
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/account/password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, appOrigin));
  }

  return NextResponse.redirect(
    new URL("/login?error=recovery_link_invalid", appOrigin),
  );
}
