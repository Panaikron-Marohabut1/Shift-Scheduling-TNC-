import { NextResponse } from "next/server";

import { loginRedirectTarget, safeRedirectTarget } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = safeRedirectTarget(url.searchParams.get("redirect_to"));

  if (!code) return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));
  return NextResponse.redirect(loginRedirectTarget(redirectTo));
}