import { getOwnerSession } from "@/lib/auth/guard";
import { documentFilename, publicMediaKeys } from "@/lib/content";
import { getStorage, isValidKey } from "@/lib/storage/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves uploaded files. Public visitors get a file only if published content references it;
// the signed-in owner can also see files attached to drafts. Anything else is a plain 404.

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!isValidKey(key)) return new Response("Not found", { status: 404 });

  const isPublic = (await publicMediaKeys()).has(key);
  if (!isPublic && !(await getOwnerSession())) return new Response("Not found", { status: 404 });

  const file = await (await getStorage()).get(key);
  if (!file) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": file.contentType,
    "Content-Length": String(file.body.length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isPublic ? "public, max-age=300, stale-while-revalidate=86400" : "private, no-store",
  });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const isImage = file.contentType.startsWith("image/");
  if (!isImage || download) {
    // PDFs open in the browser; Word and other documents are always downloaded, never rendered.
    const name = (await documentFilename(key)) || key.split("/").pop() || "file";
    const inline = file.contentType === "application/pdf" && !download;
    headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${name.replace(/["\\\r\n]/g, "")}"`);
  }

  return new Response(new Uint8Array(file.body), { status: 200, headers });
}
