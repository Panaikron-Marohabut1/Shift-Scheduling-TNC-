import "server-only";

import { getAuthConfig } from "./config";

export function safeRedirectTarget(value: string | null | undefined): string | null {
  if (!value) return null;

  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return null;
  }

  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" &&
    target.protocol === "http:" &&
    (target.hostname === "localhost" || target.hostname === "127.0.0.1");

  if (
    (!isLocalDevelopment && target.protocol !== "https:") ||
    (!isLocalDevelopment && target.port) ||
    target.username ||
    target.password
  ) {
    return null;
  }

  const originIsTrusted = getAuthConfig().trustedOrigins.some((origin) => {
    try {
      return target.origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });

  return originIsTrusted ? target.toString() : null;
}

export function loginRedirectTarget(value: string | null | undefined): string {
  return safeRedirectTarget(value) || `${getAuthConfig().authHost}/`;
}