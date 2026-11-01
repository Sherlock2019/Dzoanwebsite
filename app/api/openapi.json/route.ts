import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { openApiSpec } from "@/lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAPI description of the API (owner-only, like the Swagger UI that reads it). */
export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  return NextResponse.json(openApiSpec(new URL(req.url).origin), { headers: { "Cache-Control": "private, no-store" } });
}
