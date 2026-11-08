import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/guard";
import { clientId } from "@/lib/auth/rate-limit";
import { getProfile } from "@/lib/content";
import { contactSchema, downloadToken, emailProblem, mailConfigured, newCode, sendCode, throttled } from "@/lib/gated";
import { findDownload, verifiedVisitor } from "@/lib/gated-items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 1 of a gated download. A visitor who already confirmed an email gets the link straight
// away; otherwise this checks the email and sends a 6-digit code to it.

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const found = await findDownload(body.project, body.index);
  if (!found) return NextResponse.json({ error: "This document is no longer available." }, { status: 404 });

  const visitor = await verifiedVisitor();
  if (visitor) {
    return NextResponse.json({ url: `/api/downloads/file?t=${downloadToken(visitor, found.project.id, body.index as number)}` });
  }
  if (!body.email) return NextResponse.json({ need: "email" });

  if (!mailConfigured()) {
    return NextResponse.json({ error: "Downloads are not available right now. Please use the contact section instead." }, { status: 503 });
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check your details" }, { status: 422 });
  const contact = parsed.data;

  if (throttled(`ip:${clientId(req)}`, 10, 3600_000) || throttled(`email:${contact.email}`, 3, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many codes requested. Please wait a few minutes and try again." }, { status: 429 });
  }
  const problem = await emailProblem(contact.email);
  if (problem) return NextResponse.json({ error: problem }, { status: 422 });

  try {
    const profile = await getProfile();
    await sendCode(contact.email, newCode(contact.email), profile.name, found.project.title);
  } catch (e) {
    console.error("gated download: sending the code failed:", (e as Error).message);
    return NextResponse.json({ error: "We couldn't send the email. Please check the address or try again later." }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
