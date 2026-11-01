import { NextResponse } from "next/server";
import { listProposals } from "@/lib/ai/proposals";
import { guardAi, serverError } from "@/lib/ai/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guardAi(req);
  if (denied) return denied;
  try {
    const all = new URL(req.url).searchParams.get("status") === "all";
    return NextResponse.json(await listProposals(all ? "all" : "pending"));
  } catch (err) {
    return serverError(err);
  }
}
