import { createHmac, timingSafeEqual } from "crypto";

// Stateless signed session: base64url(payload).base64url(HMAC-SHA256(payload)).
// Stored in an httpOnly, SameSite=Strict cookie, so scripts can't read it and cross-site
// requests don't carry it.

export const SESSION_COOKIE = "pf_owner";

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(email: string, secret: string, ttlSeconds: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { sub: email, iat, exp: iat + ttlSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  expectedEmail: string,
  now = Date.now(),
): SessionPayload | null {
  if (!token || !expectedEmail) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
    // Rotating OWNER_EMAIL invalidates existing sessions.
    if (payload.sub !== expectedEmail) return null;
    return payload;
  } catch {
    return null;
  }
}
