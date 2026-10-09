import "server-only";

const defaultTrustedOrigins = [
  "https://app1.thainitrate.com",
  "https://app2.thainitrate.com",
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getAuthConfig() {
  const shareAuthCookie = process.env.SHARE_AUTH_COOKIE === "true";
  const cookieDomain = shareAuthCookie ? process.env.AUTH_COOKIE_DOMAIN : undefined;
  const trustedOrigins = (process.env.TRUSTED_APP_ORIGINS || defaultTrustedOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    authHost: process.env.AUTH_HOST || "http://localhost:3000",
    trustedOrigins,
    cookieName: process.env.AUTH_COOKIE_NAME || "sb-session",
    cookieDomain,
    shareAuthCookie,
  };
}

export function authCookieOptions() {
  const config = getAuthConfig();

  if (config.shareAuthCookie && !config.cookieDomain) {
    throw new Error("AUTH_COOKIE_DOMAIN is required when SHARE_AUTH_COOKIE=true");
  }

  return {
    name: config.cookieName,
    domain: config.cookieDomain,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
}