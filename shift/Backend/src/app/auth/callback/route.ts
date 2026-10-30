import { NextResponse } from "next/server";

import { isAllowedEmail } from "@/lib/auth/config";
import { loginRedirectTarget, safeRedirectTarget } from "@/lib/auth/redirects";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = safeRedirectTarget(url.searchParams.get("redirect_to"));

  // Microsoft/Supabase report failures as ?error=&error_description=; logged server-side only
  // (never shown on the page, since anyone can put text in a URL).
  if (!code) {
    console.error("Sign-in callback without code:", url.searchParams.get("error"), url.searchParams.get("error_description"));
    return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url), 303);
  }

  const { supabase, withCookies } = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Sign-in code exchange failed:", error.message);
    return withCookies(NextResponse.redirect(new URL("/login?error=invalid_callback", request.url), 303));
  }
  // Microsoft 365 accounts must also belong to an allowed email domain; otherwise end the new session.
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return withCookies(NextResponse.redirect(new URL("/login?error=domain_not_allowed", request.url), 303));
  }
  return withCookies(NextResponse.redirect(loginRedirectTarget(redirectTo), 303));
}