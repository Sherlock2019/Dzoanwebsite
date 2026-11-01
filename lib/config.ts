import path from "path";

// Server-only configuration. Never import this from a client component.

export type DataProvider = "local" | "supabase";

export function dataProvider(): DataProvider {
  const value = (process.env.DATA_PROVIDER || "local").toLowerCase();
  if (value !== "local" && value !== "supabase") {
    throw new Error(`DATA_PROVIDER must be "local" or "supabase" (got "${value}")`);
  }
  return value;
}

export function dataDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR || ".data");
}

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || "").trim().toLowerCase();
}

export function ownerPasswordHash(): string {
  return (process.env.OWNER_PASSWORD_HASH || "").trim();
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return secret;
}

export function sessionTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS || 72);
  return Math.max(1, Math.min(24 * 30, Number.isFinite(hours) ? hours : 72)) * 3600;
}

/** True when sign-in has everything it needs. */
export function authConfigured(): boolean {
  return Boolean(ownerEmail() && ownerPasswordHash() && (process.env.SESSION_SECRET || "").length >= 32);
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3100").replace(/\/+$/, "");
}
