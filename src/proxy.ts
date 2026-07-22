import type { NextRequest } from "next/server";

import { refreshSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/kitchen/:path*",
    "/host/:path*",
    "/api/assistant",
    "/login",
  ],
};
