import { NextResponse } from "next/server";

import { getAuthConfig } from "@/lib/auth/config";
import { corsHeaders, isTrustedCorsOrigin } from "@/lib/auth/cors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const origin = request.headers.get("origin");
  if (isTrustedCorsOrigin(origin)) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  return NextResponse.redirect(new URL("/login", getAuthConfig().authHost || request.url));
}
