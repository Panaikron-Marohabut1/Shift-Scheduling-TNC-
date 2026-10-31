import { NextResponse } from "next/server";

import { getAuthConfig } from "@/lib/auth/config";
import { safeRedirectTarget } from "@/lib/auth/redirects";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

// Starts Microsoft 365 (Supabase "azure" provider) sign-in. Microsoft returns to /auth/callback,
// which exchanges the code for a session using the PKCE code verifier kept in HttpOnly cookies.
// Asks Supabase (public settings) whether the Azure provider is turned on, so a disabled provider
// sends people back to the login page with a message instead of Supabase's raw error.
async function microsoftEnabled() {
  const config = getAuthConfig();
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: config.supabasePublishableKey },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const settings = (await response.json()) as { external?: { azure?: boolean } };
    return response.ok && settings.external?.azure === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = safeRedirectTarget(String(formData.get("redirect_to") || ""));
  const callback = new URL("/auth/callback", getAuthConfig().authHost);
  if (redirectTo) callback.searchParams.set("redirect_to", redirectTo);
  const unavailable = () => {
    const loginUrl = new URL("/login", request.url);
    if (redirectTo) loginUrl.searchParams.set("redirect_to", redirectTo);
    loginUrl.searchParams.set("error", "microsoft_unavailable");
    return NextResponse.redirect(loginUrl, 303);
  };

  if (!(await microsoftEnabled())) return unavailable();

  const { supabase, withCookies } = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email", redirectTo: callback.toString() },
  });

  if (error || !data.url) return unavailable();

  return withCookies(NextResponse.redirect(data.url, 303));
}
