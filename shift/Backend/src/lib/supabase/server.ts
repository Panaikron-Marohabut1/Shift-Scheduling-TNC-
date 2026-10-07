import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { authCookieOptions, getAuthConfig } from "@/lib/auth/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = getAuthConfig();

  return createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...authCookieOptions(), ...options });
          });
        } catch {
          // Server components cannot always mutate cookies; route handlers can.
        }
      },
    },
    cookieOptions: authCookieOptions(),
  });
}