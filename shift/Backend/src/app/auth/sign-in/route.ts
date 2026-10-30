import { NextResponse } from "next/server";

import { isAllowedEmail } from "@/lib/auth/config";
import { loginRedirectTarget, safeRedirectTarget } from "@/lib/auth/redirects";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const redirectTo = safeRedirectTarget(String(formData.get("redirect_to") || ""));
  const failed = (reason: string) => {
    const loginUrl = new URL("/login", request.url);
    if (redirectTo) loginUrl.searchParams.set("redirect_to", redirectTo);
    loginUrl.searchParams.set("error", reason);
    return NextResponse.redirect(loginUrl, 303);
  };

  // Rejected before the password is sent to Supabase.
  if (!isAllowedEmail(email)) return failed("domain_not_allowed");

  const { supabase, withCookies } = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return failed("invalid_credentials");
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return withCookies(failed("domain_not_allowed"));
  }

  return withCookies(NextResponse.redirect(loginRedirectTarget(redirectTo), 303));
}