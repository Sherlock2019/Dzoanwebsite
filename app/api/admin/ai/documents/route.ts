import { NextResponse } from "next/server";
import { guardAi, serverError } from "@/lib/ai/route-helpers";
import { createDocument, listDocuments } from "@/lib/rag/documents";
import { ParseError } from "@/lib/rag/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guardAi(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await listDocuments());
  } catch (err) {
    return serverError(err);
  }
}

/** multipart/form-data with one or more "file" fields (PDF, DOCX, TXT, MD; 20 MB each). */
export async function POST(req: Request) {
  const denied = await guardAi(req);
  if (denied) return denied;
  if (Number(req.headers.get("content-length") || 0) > 105 * 1024 * 1024) {
    return NextResponse.json({ error: "Upload is too large" }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const files = form.getAll("file").filter((f): f is File => f instanceof File).slice(0, 5);
  if (!files.length) return NextResponse.json({ error: "No file received" }, { status: 400 });

  const created = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      created.push(await createDocument(Buffer.from(await file.arrayBuffer()), file.name));
    } catch (err) {
      if (err instanceof ParseError) errors.push(`${file.name}: ${err.message}`);
      else return serverError(err);
    }
  }
  return NextResponse.json({ created, errors }, { status: created.length ? 201 : 415 });
}
