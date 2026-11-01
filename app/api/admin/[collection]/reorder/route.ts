import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db/index";
import { isCollection } from "@/lib/types";

export const runtime = "nodejs";

const body = z.object({ ids: z.array(z.string().max(80)).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await (await getRepo()).reorder(collection, parsed.data.ids);
  return NextResponse.json({ ok: true });
}
