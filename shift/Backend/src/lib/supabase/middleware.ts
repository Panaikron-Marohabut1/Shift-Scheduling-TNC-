import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authCookieOptions, getAuthConfig } from "@/lib/auth/config";

export async function updateSupabaseSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const config = getAuthConfig();

  const supabase = createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, { ...authCookieOptions(), ...options });
        });
      },
    },
    cookieOptions: authCookieOptions(),
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user && !isPublicPath(request, config.authHost)) {
    const loginUrl = new URL("/login", config.authHost);
    const redirectTo = request.nextUrl.clone();

    if (isTrustedOrigin(redirectTo.origin, config.trustedOrigins)) {
      loginUrl.searchParams.set("redirect_to", redirectTo.toString());
    }

    return NextResponse.redirect(loginUrl);
  }

  return response;
}

function isPublicPath(request: NextRequest, authHost: string) {
  const pathname = request.nextUrl.pathname;

  return (
    (pathname === "/" && request.nextUrl.origin === new URL(authHost).origin) ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/")
  );
}

function isTrustedOrigin(origin: string, trustedOrigins: string[]) {
  return trustedOrigins.some((trustedOrigin) => {
    try {
      return origin === new URL(trustedOrigin).origin;
    } catch {
      return false;
    }
  });
}