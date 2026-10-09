import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppName = "app1" | "app2";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

export async function getApplicationMembership(userId: string, app: AppName) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("application_memberships")
    .select("app, role, active")
    .eq("user_id", userId)
    .eq("app", app)
    .eq("active", true)
    .maybeSingle();

  return { membership: error ? null : data, error };
}

export async function requireAppAccess(userId: string, app: AppName, roles?: string[]) {
  const { membership, error } = await getApplicationMembership(userId, app);
  const roleAllowed = !roles || (membership ? roles.includes(membership.role) : false);

  return {
    allowed: !error && Boolean(membership) && roleAllowed,
    membership,
    error,
  };
}