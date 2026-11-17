import { type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/sarabun-[a-z0-9-]+\\.woff2$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
