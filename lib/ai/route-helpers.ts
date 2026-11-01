import { NextResponse } from "next/server";
import { ragEnabled } from "@/lib/ai/config";
import { requireOwner } from "@/lib/auth/guard";

/** Owner check plus "is the RAG database configured?" for the AI admin routes. */
export async function guardAi(req: Request): Promise<NextResponse | null> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  if (!ragEnabled()) {
    return NextResponse.json(
      { error: "The document database is not configured. Set RAG_DATABASE_URL (see README → AI features)." },
      { status: 503 },
    );
  }
  return null;
}

export function serverError(err: unknown): NextResponse {
  console.error("[ai]", err);
  const message = (err as Error)?.message || "Unexpected error";
  const unavailable = /ECONNREFUSED|ENOTFOUND|connect|timeout/i.test(message);
  return NextResponse.json(
    { error: unavailable ? "The document database is not reachable. Is the rag-db container running?" : message },
    { status: unavailable ? 503 : 500 },
  );
}
