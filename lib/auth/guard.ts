import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authConfigured, ownerEmail, sessionSecret, siteUrl } from "@/lib/config";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/** Returns the owner session or null. Server-only. */
export async function getOwnerSession(): Promise<SessionPayload | null> {
  if (!authConfigured()) return null;
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, sessionSecret(), ownerEmail());
}

/**
 * Same-origin check for state-changing requests (defence in depth on top of SameSite=Strict).
 * Accepts the request's own host or the configured SITE_URL origin.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POST/PUT/DELETE; fall back to Sec-Fetch-Site.
    const site = req.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  }
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(siteUrl()).origin);
  } catch {
    // ignore bad SITE_URL
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  return allowed.has(origin);
}

/**
 * Call at the top of every owner API handler. Returns an error response to send back,
 * or null when the request is authorised.
 */
export async function requireOwner(req: Request): Promise<NextResponse | null> {
  const mutating = !["GET", "HEAD"].includes(req.method);
  if (mutating && !isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return null;
}
