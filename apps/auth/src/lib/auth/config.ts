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
  const pilot = process.env.APP_MODE === "PILOT";
  const shareAuthCookie = process.env.SHARE_AUTH_COOKIE === "true";
  const cookieDomain = shareAuthCookie ? process.env.AUTH_COOKIE_DOMAIN : undefined;
  const trustedOrigins = (process.env.TRUSTED_APP_ORIGINS || defaultTrustedOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Exact domain allowlist for email/password and Microsoft 365; no wildcard support.
  const allowedEmailDomains = (process.env.NODE_ENV === "development"
    ? (process.env.DEV_ALLOWED_EMAIL_DOMAINS || "thainitrate.com")
    : "thainitrate.com")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const authHost = process.env.AUTH_HOST || "http://localhost:3001";
  const pilotEmails = pilot ? readPilotEmails(supabaseUrl, authHost, trustedOrigins, shareAuthCookie) : [];

  return {
    pilot,
    pilotEmails,
    supabaseUrl,
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    authHost,
    trustedOrigins,
    cookieName: process.env.AUTH_COOKIE_NAME || "sb-session",
    cookieDomain,
    shareAuthCookie,
    allowedEmailDomains,
  };
}

function readPilotEmails(supabaseUrl: string, authHost: string, trustedOrigins: string[], shareAuthCookie: boolean) {
  const project = required("PILOT_SUPABASE_PROJECT_REF");
  if (!/^[a-z0-9]+$/.test(project) || supabaseUrl.replace(/\/$/, "") !== `https://${project}.supabase.co`) {
    throw new Error("Pilot Auth must use the configured Supabase project.");
  }
  const origin = new URL(required("APP_ORIGIN"));
  if (origin.protocol !== "https:" || origin.origin !== process.env.APP_ORIGIN || origin.port ||
      origin.origin !== authHost || trustedOrigins.length !== 1 || trustedOrigins[0] !== authHost || shareAuthCookie) {
    throw new Error("Pilot Auth requires one HTTPS origin and a host-only cookie.");
  }
  const emails = required("PILOT_AUTH_EMAILS").split(",").map(email => email.trim().toLowerCase());
  if (emails.some(email => !/^[^\s@*,]+@[^\s@*,]+\.[^\s@*,]+$/.test(email))) {
    throw new Error("PILOT_AUTH_EMAILS must contain exact email addresses.");
  }
  return emails;
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
    secure: config.pilot || process.env.NODE_ENV === "production",
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
  const { pilot, pilotEmails, allowedEmailDomains } = getAuthConfig();
  if (pilot) return pilotEmails.includes(email?.trim().toLowerCase() || "");
  const at = (email || "").lastIndexOf("@");
  if (at < 1) return false;
  return allowedEmailDomains.includes((email || "").slice(at + 1).trim().toLowerCase());
}
