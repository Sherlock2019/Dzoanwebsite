import { NextResponse } from "next/server";
import { z } from "zod";
import { startAnalysis } from "@/lib/ai/analyze";
import { guardAi, serverError } from "@/lib/ai/route-helpers";
import { getDocument } from "@/lib/rag/documents";

export const runtime = "nodejs";

/** Start analysing a processed document; the dashboard polls the document status. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAi(req);
  if (denied) return denied;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const doc = await getDocument(id.data);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.status === "processing" || doc.status === "analyzing") {
      return NextResponse.json({ error: `The document is still ${doc.status}` }, { status: 409 });
    }
    if (!doc.content) return NextResponse.json({ error: "The document has no text to analyse" }, { status: 409 });
    startAnalysis(id.data);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    return serverError(err);
  }
}
