import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { authCookieOptions, authCookieWriteOptions, getAuthConfig } from "@/lib/auth/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = getAuthConfig();

  return createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...authCookieWriteOptions(), ...options });
          });
        } catch {
          // Server components cannot always mutate cookies; route handlers can.
        }
      },
    },
    cookieOptions: authCookieOptions(),
  });
}

type PendingCookie = { name: string; value: string; options: Record<string, unknown> };

// For route handlers that answer with a redirect: Supabase's cookie writes are collected and
// attached to the response explicitly, so they always reach the browser with that response.
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  const config = getAuthConfig();
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        pending.push(...cookiesToSet);
      },
    },
    cookieOptions: authCookieOptions(),
  });

  function withCookies<T extends NextResponse>(response: T): T {
    pending.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, { ...authCookieWriteOptions(), ...options });
    });
    return response;
  }

  return { supabase, withCookies };
}
