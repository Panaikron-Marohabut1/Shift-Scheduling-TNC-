import "server-only";

import { getAuthConfig } from "./config";

// Cross-origin callers are the trusted app origins other than the auth host itself.
export function isTrustedCorsOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  const config = getAuthConfig();
  if (origin === new URL(config.authHost).origin) return false;

  return config.trustedOrigins.some((trustedOrigin) => {
    try {
      return origin === new URL(trustedOrigin).origin;
    } catch {
      return false;
    }
  });
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return isTrustedCorsOrigin(origin)
    ? {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
      }
    : {};
}
