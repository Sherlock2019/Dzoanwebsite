import { NextResponse } from "next/server";
import { authConfigured, ownerEmail, ownerPasswordHash, sessionSecret, sessionTtlSeconds } from "@/lib/config";
import { isSameOrigin } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { clearFailures, clientId, isLocked, recordFailure } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

function isHttps(req: Request): boolean {
  return (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")) === "https";
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Owner sign-in is not configured. Set OWNER_EMAIL, OWNER_PASSWORD_HASH and SESSION_SECRET." },
      { status: 503 },
    );
  }
  const id = clientId(req);
  if (isLocked(id)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
    password = typeof body.password === "string" ? body.password.slice(0, 500) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Always verify the password so timing doesn't reveal whether the email matched.
  const passwordOk = await verifyPassword(password, ownerPasswordHash());
  if (!passwordOk || email !== ownerEmail()) {
    recordFailure(id);
    return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
  }

  clearFailures(id);
  const ttl = sessionTtlSeconds();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(email, sessionSecret(), ttl), {
    httpOnly: true,
    sameSite: "strict",
    secure: isHttps(req),
    path: "/",
    maxAge: ttl,
  });
  return res;
}
