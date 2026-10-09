import { NextResponse } from "next/server";

import { loginRedirectTarget, safeRedirectTarget } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const redirectTo = safeRedirectTarget(String(formData.get("redirect_to") || ""));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginUrl = new URL("/login", request.url);
    if (redirectTo) loginUrl.searchParams.set("redirect_to", redirectTo);
    loginUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(loginRedirectTarget(redirectTo));
}