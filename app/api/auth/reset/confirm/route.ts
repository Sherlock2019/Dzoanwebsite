import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/config";
import { isSameOrigin } from "@/lib/auth/guard";
import { clearFailures, clientId, isLocked, recordFailure } from "@/lib/auth/rate-limit";
import { resetPassword } from "@/lib/auth/reset";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

const MIN_LENGTH = 12;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  if (!authConfigured()) {
    return NextResponse.json({ error: "Owner sign-in is not configured on this server." }, { status: 503 });
  }
  const id = clientId(req);
  if (isLocked(id)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  let token = "";
  let password = "";
  try {
    const body = await req.json();
    token = typeof body.token === "string" ? body.token.slice(0, 200) : "";
    password = typeof body.password === "string" ? body.password.slice(0, 500) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (password.length < MIN_LENGTH) {
    return NextResponse.json({ error: `Use at least ${MIN_LENGTH} characters.` }, { status: 400 });
  }

  if (!(await resetPassword(token, password))) {
    recordFailure(id);
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one from the sign-in page." },
      { status: 400 },
    );
  }

  clearFailures(id);
  console.log("[auth] Owner password was reset; earlier sessions are signed out.");
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
