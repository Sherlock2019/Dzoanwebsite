import { z } from "zod";
import { requireOwner } from "@/lib/auth/guard";
import { ragEnabled } from "@/lib/ai/config";
import { db } from "@/lib/rag/db";
import { getStorage } from "@/lib/storage/index";

export const runtime = "nodejs";

/** Owner-only download of an uploaded document's original file. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success || !ragEnabled()) return new Response("Not found", { status: 404 });
  const { rows } = await (await db()).query("SELECT filename, mime, storage_key FROM rag_documents WHERE id = $1", [id.data]);
  const row = rows[0];
  const file = row?.storage_key ? await (await getStorage()).get(row.storage_key) : null;
  if (!file) return new Response("Not found", { status: 404 });
  const name = String(row.filename).replace(/[^\w .()-]+/g, "_").slice(0, 150) || "document";
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
