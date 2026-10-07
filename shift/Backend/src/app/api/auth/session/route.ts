import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/guards";

export async function GET() {
  const { user } = await getAuthenticatedUser();
  return NextResponse.json({ user }, { status: user ? 200 : 401 });
}