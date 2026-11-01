import { mkdtempSync } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

// Uses a throw-away DATA_DIR with the local provider.
const dir = mkdtempSync(path.join(os.tmpdir(), "pf-content-"));
process.env.DATA_PROVIDER = "local";
process.env.DATA_DIR = dir;

type ContentModule = typeof import("@/lib/content");
type UploadModule = typeof import("@/lib/upload");
let content: ContentModule;
let upload: UploadModule;

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: "#0563bb" } }).png().toBuffer();
}

beforeAll(async () => {
  content = await import("@/lib/content");
  upload = await import("@/lib/upload");
});

describe("uploads", () => {
  it("stores an image with a thumbnail", async () => {
    const media = await upload.storeImage(await png(), "image/png", "Test image");
    expect(media.key).toMatch(/^images\/\d{4}\/.+\.png$/);
    expect(media.thumb).toMatch(/\.thumb\.webp$/);
    expect(media.width).toBe(1200);
  });
  it("rejects a mismatched MIME type and non-images", async () => {
    await expect(upload.storeImage(await png(), "image/jpeg")).rejects.toThrow(/sent as/);
    await expect(upload.storeImage(Buffer.from("<svg/>"), "image/svg+xml")).rejects.toThrow();
    await expect(upload.storePdf(await png(), "application/pdf")).rejects.toThrow();
  });
});

describe("drafts stay private", () => {
  it("only published content and its media are public", async () => {
    const a = await upload.storeImage(await png(), "image/png", "published");
    const b = await upload.storeImage(await png(), "image/png", "draft");
    const pub = await content.createEntity("projects", { title: "Public one", visibility: "published", media: [a] });
    const draft = await content.createEntity("projects", { title: "Secret draft", visibility: "draft", media: [b] });

    const site = await content.getPublicContent();
    expect(site.projects.map((p) => p.id)).toContain(pub.id);
    expect(site.projects.map((p) => p.id)).not.toContain(draft.id);
    expect(await content.getPublishedBySlug("projects", draft.slug)).toBeNull();

    const keys = await content.publicMediaKeys();
    expect(keys.has(a.key)).toBe(true);
    expect(keys.has(a.thumb!)).toBe(true);
    expect(keys.has(b.key)).toBe(false);
    expect(keys.has(b.thumb!)).toBe(false);
  });

  it("hides the phone number unless enabled", async () => {
    const base = { ...content.defaultProfile(), name: "Test", phone: "+84 1", show_phone: false };
    await content.saveProfile(base);
    expect((await content.getPublicContent()).profile.phone).toBe("");
    await content.saveProfile({ ...base, show_phone: true });
    expect((await content.getPublicContent()).profile.phone).toBe("+84 1");
  });
});

describe("entities", () => {
  it("generates unique slugs and persists updates", async () => {
    const one = await content.createEntity("architectures", { title: "Same Title" });
    const two = await content.createEntity("architectures", { title: "Same Title" });
    expect(one.slug).toBe("same-title");
    expect(two.slug).toBe("same-title-2");
    const updated = await content.updateEntity("architectures", one.id, { ...one, summary: "changed" });
    expect(updated?.summary).toBe("changed");
    expect(updated?.created_at).toBe(one.created_at);
  });

  it("deletes orphaned files when media is removed", async () => {
    const { getStorage } = await import("@/lib/storage/index");
    const img = await upload.storeImage(await png(), "image/png");
    const p = await content.createEntity("projects", { title: "With image", media: [img] });
    await content.updateEntity("projects", p.id, { ...p, media: [] });
    expect(await (await getStorage()).get(img.key)).toBeNull();
    expect(await (await getStorage()).get(img.thumb!)).toBeNull();
  });

  it("rejects invalid input with field messages", async () => {
    await expect(content.createEntity("projects", { title: "" })).rejects.toBeInstanceOf(content.ValidationError);
  });
});
