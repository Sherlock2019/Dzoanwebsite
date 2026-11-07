import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { safeFilename, storeDocument, storeImage, storePdf, UploadError } from "@/lib/upload";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/**
 * Owner-only upload. multipart/form-data with:
 *   file  — the file
 *   kind  — "image" (JPEG/PNG/WebP), "pdf", or "document" (PDF or Word .docx, keeps its filename)
 *   alt   — optional alt text for images
 * Files are stored privately; they become public only when referenced by published content.
 */
export async function POST(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_REQUEST_BYTES) return NextResponse.json({ error: "File is too large (max 15 MB)" }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (kind === "pdf") {
      const key = await storePdf(buf, file.type);
      return NextResponse.json({ key, filename: safeFilename(file.name) }, { status: 201 });
    }
    if (kind === "image") {
      const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : "";
      return NextResponse.json(await storeImage(buf, file.type, alt), { status: 201 });
    }
    if (kind === "document") {
      return NextResponse.json(await storeDocument(buf, file.name), { status: 201 });
    }
    return NextResponse.json({ error: 'kind must be "image", "pdf" or "document"' }, { status: 400 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 415 });
    throw err;
  }
}
