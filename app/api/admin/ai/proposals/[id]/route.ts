import { NextResponse } from "next/server";
import { z } from "zod";
import { ApplyError, applyProposal, rejectProposal } from "@/lib/ai/proposals";
import { guardAi, serverError } from "@/lib/ai/route-helpers";
import { ValidationError } from "@/lib/content";

export const runtime = "nodejs";

const body = z.object({ action: z.enum(["apply", "reject"]), value: z.unknown().optional() });

/** Apply (optionally with an edited value) or reject a pending AI proposal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAi(req);
  if (denied) return denied;
  const id = z.string().uuid().safeParse((await params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    if (parsed.data.action === "reject") {
      return (await rejectProposal(id.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not pending" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, result: await applyProposal(id.data, parsed.data.value) });
  } catch (err) {
    if (err instanceof ApplyError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: `Invalid value: ${Object.values(err.issues)[0] ?? "check the edit"}` }, { status: 422 });
    }
    return serverError(err);
  }
}
