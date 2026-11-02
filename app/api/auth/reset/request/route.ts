import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/config";
import { isSameOrigin } from "@/lib/auth/guard";
import { clientId, isLocked, recordFailure } from "@/lib/auth/rate-limit";
import { createResetLink } from "@/lib/auth/reset";

export const runtime = "nodejs";

// "Forgot password?" — writes a one-time reset link to a private file on the server. Nothing is
// returned to the browser, so a visitor who presses the button learns nothing and gains nothing.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  if (!authConfigured()) {
    return NextResponse.json({ error: "Owner sign-in is not configured on this server." }, { status: 503 });
  }
  // Separate bucket from sign-in failures: 5 links per client per 15 minutes.
  const id = `reset:${clientId(req)}`;
  if (isLocked(id)) {
    return NextResponse.json({ error: "Too many reset requests. Try again in 15 minutes." }, { status: 429 });
  }
  recordFailure(id);

  try {
    const where = await createResetLink();
    console.log(`[auth] Password reset link written to ${where} (valid 30 minutes)`);
  } catch (err) {
    console.error("[auth] Could not write the password reset link:", err);
    return NextResponse.json({ error: "Could not create a reset link on the server." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
