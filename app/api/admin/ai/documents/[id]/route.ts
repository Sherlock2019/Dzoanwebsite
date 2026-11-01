import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, serverError } from "@/lib/ai/route-helpers";
import { deleteDocument, getDocument, setDocumentStatus } from "@/lib/rag/documents";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();
const patchSchema = z.object({ public: z.boolean().optional(), title: z.string().trim().min(1).max(200).optional() });

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guardAi(req);
  if (denied) return denied;
  const id = idSchema.safeParse((await params).id);
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    if (!(await getDocument(id.data))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await setDocumentStatus(id.data, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await guardAi(req);
  if (denied) return denied;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    return (await deleteDocument(id.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    return serverError(err);
  }
}
