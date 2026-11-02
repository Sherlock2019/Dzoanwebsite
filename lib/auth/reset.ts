import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { dataDir, ownerPasswordHash, siteUrl } from "@/lib/config";
import { hashPassword } from "./password";

// Owner password reset without email: "Forgot password?" writes a one-time link to a private file
// on the server (DATA_DIR/PASSWORD_RESET_LINK.txt). Only someone with access to the server's files
// can read it, which is the same trust level as editing OWNER_PASSWORD_HASH in .env.local.
//
// The new password hash is kept in DATA_DIR/owner-password.json. It overrides OWNER_PASSWORD_HASH
// only while that env value is unchanged, so `npm run hash-password` + editing .env.local still wins.

const TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_FILE = "password-reset.json";
const LINK_FILE = "PASSWORD_RESET_LINK.txt";
const OVERRIDE_FILE = "owner-password.json";

interface ResetToken {
  sha256: string;
  expires_at: number;
}

interface PasswordOverride {
  hash: string;
  /** The OWNER_PASSWORD_HASH this override replaced. */
  base: string;
  /** Unix seconds; sessions issued before this are rejected. */
  changed_at: number;
}

const file = (name: string) => path.join(dataDir(), name);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file(name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function writePrivate(name: string, content: string): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const target = file(name);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, content, { mode: 0o600 });
  await fs.rename(tmp, target);
}

async function removeQuietly(name: string): Promise<void> {
  await fs.rm(file(name), { force: true });
}

async function activeOverride(): Promise<PasswordOverride | null> {
  const override = await readJson<PasswordOverride>(OVERRIDE_FILE);
  if (!override || typeof override.hash !== "string") return null;
  return override.base === ownerPasswordHash() ? override : null;
}

/** The hash sign-in should check: the reset password if one is active, else OWNER_PASSWORD_HASH. */
export async function currentPasswordHash(): Promise<string> {
  return (await activeOverride())?.hash || ownerPasswordHash();
}

/** Unix seconds of the last reset (0 if none). Sessions issued earlier are no longer valid. */
export async function passwordChangedAt(): Promise<number> {
  return (await activeOverride())?.changed_at || 0;
}

/** Creates a new one-time reset link (replacing any earlier one) and writes it to the link file. */
export async function createResetLink(now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const record: ResetToken = { sha256: sha256(token), expires_at: now + TOKEN_TTL_MS };
  await writePrivate(TOKEN_FILE, JSON.stringify(record));
  const link = `${siteUrl()}/admin/reset?token=${token}`;
  const expires = new Date(record.expires_at).toISOString();
  await writePrivate(LINK_FILE, `${link}\n\nOne-time owner password reset link. Expires ${expires}.\n`);
  return path.join(dataDir(), LINK_FILE);
}

/** Checks a reset token without using it up. */
export async function isResetTokenValid(token: string, now = Date.now()): Promise<boolean> {
  const record = await readJson<ResetToken>(TOKEN_FILE);
  if (!token || !record || typeof record.sha256 !== "string" || record.expires_at < now) return false;
  const expected = Buffer.from(record.sha256, "hex");
  const actual = Buffer.from(sha256(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Uses the token to set a new password. Returns false if the token is invalid or expired. */
export async function resetPassword(token: string, newPassword: string, now = Date.now()): Promise<boolean> {
  if (!(await isResetTokenValid(token, now))) return false;
  // Hash first: a too-short password throws here, before the token is used up.
  const override: PasswordOverride = {
    hash: await hashPassword(newPassword),
    base: ownerPasswordHash(),
    changed_at: Math.floor(now / 1000),
  };
  // Burn the token before writing the new hash so it can never be used twice.
  await removeQuietly(TOKEN_FILE);
  await removeQuietly(LINK_FILE);
  await writePrivate(OVERRIDE_FILE, JSON.stringify(override));
  return true;
}
