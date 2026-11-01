import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { createEntity, ValidationError } from "@/lib/content";
import { getRepo } from "@/lib/db/index";
import { isCollection } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  return NextResponse.json(await (await getRepo()).list(collection));
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    const item = await createEntity(collection, await req.json());
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Please fix the highlighted fields", issues: err.issues }, { status: 422 });
    }
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    throw err;
  }
}
