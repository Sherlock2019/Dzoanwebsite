import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { isValidKey } from "@/lib/storage/index";
import { createLocalStorage } from "@/lib/storage/local";
import { safeFilename, sniffType } from "@/lib/upload";
import { collectionSchemas, profileSchema } from "@/lib/validation";
import { isHttpUrl } from "@/lib/text";
import os from "os";
import path from "path";

const SECRET = "x".repeat(40);

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken("me@example.com", SECRET, 60);
    expect(verifySessionToken(token, SECRET, "me@example.com")?.sub).toBe("me@example.com");
  });
  it("rejects tampered, wrong-secret, wrong-owner and expired tokens", () => {
    const token = createSessionToken("me@example.com", SECRET, 60);
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "me@example.com", iat: 0, exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, SECRET, "me@example.com")).toBeNull();
    expect(verifySessionToken(`${data}.${sig}x`, SECRET, "me@example.com")).toBeNull();
    expect(verifySessionToken(token, "y".repeat(40), "me@example.com")).toBeNull();
    expect(verifySessionToken(token, SECRET, "other@example.com")).toBeNull();
    expect(verifySessionToken(token, SECRET, "me@example.com", Date.now() + 61_000)).toBeNull();
    expect(verifySessionToken(undefined, SECRET, "me@example.com")).toBeNull();
    expect(verifySessionToken("garbage", SECRET, "me@example.com")).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("$");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });
  it("refuses short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });
});

describe("file type sniffing", () => {
  it("detects real types from bytes", () => {
    expect(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffType(Buffer.from("%PDF-1.7"))).toBe("pdf");
  });
  it("rejects SVG, HTML and executables", () => {
    expect(sniffType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"))).toBeNull();
    expect(sniffType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });
  it("cleans download filenames", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd.pdf");
    expect(safeFilename('my "résumé".pdf')).toBe("my _r_sum_.pdf");
    expect(safeFilename("")).toBe("resume.pdf");
  });
});

describe("storage keys", () => {
  const good = "images/2026/123e4567-e89b-12d3-a456-426614174000.png";
  it("accepts only server-generated keys", () => {
    expect(isValidKey(good)).toBe(true);
    expect(isValidKey("images/2026/123e4567-e89b-12d3-a456-426614174000.thumb.webp")).toBe(true);
    expect(isValidKey("../secrets.png")).toBe(false);
    expect(isValidKey("images/2026/../../db.json")).toBe(false);
    expect(isValidKey("/etc/passwd")).toBe(false);
    expect(isValidKey("images/2026/123e4567-e89b-12d3-a456-426614174000.svg")).toBe(false);
    expect(isValidKey("images/2026/evil.html")).toBe(false);
  });
  it("local storage refuses invalid keys", async () => {
    const store = createLocalStorage(path.join(os.tmpdir(), "pf-test-uploads"));
    await expect(store.put("../escape.png", Buffer.from("x"), "image/png")).rejects.toThrow();
    expect(await store.get("../../etc/passwd")).toBeNull();
  });
});

describe("input validation", () => {
  it("allows only http(s) URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://100.31.100.157:8502/")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("//evil.com")).toBe(false);
  });
  it("rejects dangerous project links and unknown statuses", () => {
    const schema = collectionSchemas.projects;
    expect(schema.safeParse({ title: "x", demo_url: "javascript:alert(1)" }).success).toBe(false);
    expect(schema.safeParse({ title: "x", links: [{ label: "a", url: "data:text/html,x" }] }).success).toBe(false);
    expect(schema.safeParse({ title: "x", status: "Totally live" }).success).toBe(false);
    expect(schema.safeParse({ title: "x", media: [{ key: "../db.json", alt: "" }] }).success).toBe(false);
  });
  it("strips server-managed fields and defaults to draft", () => {
    const parsed = collectionSchemas.projects.parse({ title: "x", id: "hijack", created_at: "1999", is_admin: true });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("created_at");
    expect(parsed).not.toHaveProperty("is_admin");
    expect(parsed.visibility).toBe("draft");
  });
  it("validates profile email and phone", () => {
    expect(profileSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "A", phone: "<script>" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "A", email: "a@b.co", phone: "+84 908 618 075" }).success).toBe(true);
  });
});
