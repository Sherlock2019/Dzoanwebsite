import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/guard";
import { checkCode, contactSchema, downloadToken, logLead, VERIFIED_COOKIE, VERIFIED_MAX_AGE, verifiedCookie } from "@/lib/gated";
import { findDownload } from "@/lib/gated-items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 2 of a gated download: check the emailed code, remember the visitor, return the link.

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
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success || typeof body.code !== "string" || !/^\s*\d{6}\s*$/.test(body.code)) {
    return NextResponse.json({ error: "Please enter the 6-digit code from the email." }, { status: 422 });
  }
  const contact = parsed.data;

  const result = checkCode(contact.email, body.code);
  if (result === "expired") return NextResponse.json({ error: "This code has expired. Please ask for a new one.", expired: true }, { status: 422 });
  if (result === "wrong") return NextResponse.json({ error: "That code isn't right. Please check the email and try again." }, { status: 422 });

  await logLead({ type: "verified", ...contact, project: found.project.title, file: found.file.filename });
  const res = NextResponse.json({ url: `/api/downloads/file?t=${downloadToken(contact, found.project.id, body.index as number)}` });
  res.cookies.set(VERIFIED_COOKIE, verifiedCookie(contact), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VERIFIED_MAX_AGE,
    path: "/",
  });
  return res;
}
