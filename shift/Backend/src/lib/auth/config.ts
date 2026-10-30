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

  // Only these email domains may sign in (email + password and Microsoft 365). "*" allows any.
  const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "thainitrate.com")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    authHost: process.env.AUTH_HOST || "http://localhost:3001",
    trustedOrigins,
    cookieName: process.env.AUTH_COOKIE_NAME || "sb-session",
    cookieDomain,
    shareAuthCookie,
    allowedEmailDomains,
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

// Attributes for writing one cookie. Leaves out `name`: Next.js lets an options `name` override the
// cookie name, which would rename Supabase's chunk and PKCE verifier cookies to the base name.
export function authCookieWriteOptions() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, ...options } = authCookieOptions();
  return options;
}

// Exact domain match on the part after the last "@" (sub.thainitrate.com and lookalikes are rejected).
export function isAllowedEmail(email: string | null | undefined) {
  const domains = getAuthConfig().allowedEmailDomains;
  if (domains.includes("*")) return true;
  const at = (email || "").lastIndexOf("@");
  if (at < 1) return false;
  return domains.includes((email || "").slice(at + 1).trim().toLowerCase());
}
