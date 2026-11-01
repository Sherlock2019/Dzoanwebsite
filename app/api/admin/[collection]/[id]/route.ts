import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { deleteEntity, updateEntity, ValidationError } from "@/lib/content";
import { getRepo } from "@/lib/db/index";
import { isCollection } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string; id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection, id } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  const item = await (await getRepo()).get(collection, id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection, id } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    const item = await updateEntity(collection, id, await req.json());
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Please fix the highlighted fields", issues: err.issues }, { status: 422 });
    }
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection, id } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  const ok = await deleteEntity(collection, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
