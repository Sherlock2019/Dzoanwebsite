import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { promises as dns } from "dns";
import { promises as fs } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { z } from "zod";
import { dataDir, ownerEmail } from "@/lib/config";

// Email-gated downloads ("Full project details"). A visitor proves the email is real by typing a
// 6-digit code sent to it. Then a signed cookie remembers them for 30 days, and each download
// uses a short-lived signed link. Every confirmed email and download is logged to
// .data/leads.jsonl (git-ignored), and the owner gets an email per download.

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const VERIFIED_TTL_S = 30 * 24 * 3600;
const LINK_TTL_S = 10 * 60;
export const VERIFIED_COOKIE = "pf_dl";

// Common throwaway-inbox services. Not exhaustive: the code check is what really proves the email.
const DISPOSABLE = new Set(
  "mailinator.com guerrillamail.com guerrillamail.net sharklasers.com grr.la 10minutemail.com 10minutemail.net tempmail.com temp-mail.org temp-mail.io tempmail.net tempmailo.com yopmail.com yopmail.fr yopmail.net trashmail.com trashmail.de getnada.com nada.email dispostable.com maildrop.cc mailnesia.com mintemail.com mohmal.com throwawaymail.com fakeinbox.com spamgourmet.com emailondeck.com moakt.com tempr.email discard.email mailcatch.com inboxkitten.com burnermail.io 33mail.com spambox.us mytemp.email tempinbox.com luxusmail.org emailfake.com fakemail.net"
    .split(" "),
);

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().max(160).email("Please enter a valid email"),
  company: z.string().trim().max(120).default(""),
});
export type Contact = z.infer<typeof contactSchema>;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function secret(): string {
  return `${process.env.SESSION_SECRET || ""}|gated-downloads`;
}

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", secret()).update(data).digest("base64url")}`;
}

function unsign<T extends { exp: number }>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(createHmac("sha256", secret()).update(data).digest("base64url"));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
    return typeof p.exp === "number" && p.exp * 1000 > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const now = () => Math.floor(Date.now() / 1000);

export interface Verified extends Contact {
  exp: number;
}
export const verifiedCookie = (c: Contact) => sign({ ...c, exp: now() + VERIFIED_TTL_S });
export const readVerified = (token: string | undefined) => unsign<Verified>(token);
export const VERIFIED_MAX_AGE = VERIFIED_TTL_S;

interface LinkPayload {
  email: string;
  name: string;
  company: string;
  pid: string;
  i: number;
  exp: number;
}
export const downloadToken = (c: Contact, pid: string, i: number) => sign({ email: c.email, name: c.name, company: c.company, pid, i, exp: now() + LINK_TTL_S });
export const readDownloadToken = (token: string | null) => unsign<LinkPayload>(token);

/** Rejects malformed, throwaway and non-existent domains before we spend an email on them. */
export async function emailProblem(email: string): Promise<string | null> {
  const domain = email.split("@")[1] || "";
  if (DISPOSABLE.has(domain)) return "Please use your work or personal email, not a temporary inbox.";
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    if (!mx.length) return "That email domain can't receive mail. Please check the address.";
  } catch (e) {
    if ((e as Error).message === "timeout") return null; // DNS slow: let the code check decide
    return "That email domain can't receive mail. Please check the address.";
  }
  return null;
}

// ---------- one-time codes (in memory; a restart just means asking for a new code) ----------
// Kept on globalThis: Next.js bundles each API route separately, so a plain module-level Map in
// the "request" route would not be the same Map the "verify" route reads.

const store = globalThis as typeof globalThis & {
  __gatedCodes?: Map<string, { hash: string; exp: number; tries: number }>;
  __gatedSends?: Map<string, number[]>;
};
const codes = (store.__gatedCodes ??= new Map<string, { hash: string; exp: number; tries: number }>());
const sends = (store.__gatedSends ??= new Map<string, number[]>());
const hashCode = (email: string, code: string) => createHash("sha256").update(`${secret()}|${email}|${code}`).digest("hex");

/** True if `key` has made `max` or more requests in the last `windowMs`; otherwise records one. */
export function throttled(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const list = (sends.get(key) || []).filter((x) => t - x < windowMs);
  if (list.length >= max) {
    sends.set(key, list);
    return true;
  }
  list.push(t);
  sends.set(key, list);
  if (sends.size > 20_000) sends.clear();
  return false;
}

export function newCode(email: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, { hash: hashCode(email, code), exp: Date.now() + CODE_TTL_MS, tries: 0 });
  return code;
}

export function checkCode(email: string, code: string): "ok" | "wrong" | "expired" {
  const entry = codes.get(email);
  if (!entry || entry.exp < Date.now() || entry.tries >= MAX_TRIES) {
    codes.delete(email);
    return "expired";
  }
  entry.tries++;
  const a = Buffer.from(entry.hash);
  const b = Buffer.from(hashCode(email, code.trim()));
  if (a.length === b.length && timingSafeEqual(a, b)) {
    codes.delete(email);
    return "ok";
  }
  return "wrong";
}

// ---------- email ----------

let transport: nodemailer.Transporter | null = null;
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

function from(siteName: string) {
  return process.env.MAIL_FROM || `"${siteName.replace(/"/g, "")}" <${process.env.SMTP_USER}>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendCode(to: string, code: string, siteName: string, projectTitle: string) {
  await mailer().sendMail({
    from: from(siteName),
    to,
    subject: `${code} is your code to download "${projectTitle}"`,
    text: `Your confirmation code is ${code}\n\nEnter it on ${siteName}'s website to download the full details of "${projectTitle}". It expires in 15 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<p>Your confirmation code is</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>Enter it on ${esc(siteName)}'s website to download the full details of <strong>${esc(projectTitle)}</strong>. It expires in 15 minutes.</p><p style="color:#666">If you didn't ask for this, you can ignore this email.</p>`,
  });
}

export async function notifyOwner(siteName: string, lead: { name: string; email: string; company: string; project: string; file: string }) {
  const to = process.env.NOTIFY_EMAIL || ownerEmail();
  if (!to || process.env.NOTIFY_DOWNLOADS === "0") return;
  const who = `${lead.name}${lead.company ? ` (${lead.company})` : ""} <${lead.email}>`;
  await mailer().sendMail({
    from: from(siteName),
    to,
    replyTo: lead.email,
    subject: `Download: ${lead.name}${lead.company ? `, ${lead.company}` : ""} — ${lead.project}`,
    text: `${who} downloaded "${lead.file}" from "${lead.project}".\n\nReply to this email to contact them.`,
  });
}

// ---------- lead log ----------

export interface Lead {
  ts: number;
  type: "verified" | "download";
  email: string;
  name: string;
  company: string;
  project: string;
  file: string;
}

const leadsFile = () => path.join(dataDir(), "leads.jsonl");

export async function logLead(lead: Omit<Lead, "ts">) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.appendFile(leadsFile(), JSON.stringify({ ts: Date.now(), ...lead }) + "\n", { mode: 0o600 });
}

export async function readLeads(): Promise<Lead[]> {
  const text = await fs.readFile(leadsFile(), "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Lead];
      } catch {
        return [];
      }
    });
}
