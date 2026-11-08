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
  const isVideo = file.contentType.startsWith("video/");

  // Background videos play inline and support range requests (needed to stream and seek, and by
  // Safari before it plays a video at all).
  if (isVideo && !download) {
    headers.set("Accept-Ranges", "bytes");
    const size = file.body.length;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(new Uint8Array(file.body.subarray(start, end + 1)), { status: 206, headers });
    }
    return new Response(new Uint8Array(file.body), { status: 200, headers });
  }

  if (!isImage || download) {
    // PDFs open in the browser; Word and other documents are always downloaded, never rendered.
    const name = (await documentFilename(key)) || key.split("/").pop() || "file";
    const inline = file.contentType === "application/pdf" && !download;
    headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${name.replace(/["\\\r\n]/g, "")}"`);
  }

  return new Response(new Uint8Array(file.body), { status: 200, headers });
}
