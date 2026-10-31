import { NextResponse } from "next/server";

import { corsHeaders } from "@/lib/auth/cors";
import { getAuthenticatedUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const { user } = await getAuthenticatedUser();
  return NextResponse.json(
    { user },
    { status: user ? 200 : 401, headers: corsHeaders(request.headers.get("origin")) },
  );
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
