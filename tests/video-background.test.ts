import { describe, expect, it } from "vitest";
import { DEFAULT_SLIDE1_BG, DEFAULT_SLIDE1_SETTINGS, normalizeBg, normalizeSettings, resolveSlide1Bg } from "@/lib/slide1-bg";
import { contentTypeForKey, isValidKey } from "@/lib/storage/index";
import { sniffVideo } from "@/lib/upload";
import { slide1BgSettingsSchema } from "@/lib/validation";

const KEY = "videos/2026/0b1f8e9c-1234-4abc-9def-0123456789ab.mp4";

describe("background video uploads", () => {
  it("recognises MP4 and WebM from their bytes, nothing else", () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(8)]);
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
    expect(sniffVideo(mp4)).toBe("mp4");
    expect(sniffVideo(webm)).toBe("webm");
    expect(sniffVideo(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffVideo(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeNull(); // PNG
  });

  it("accepts only server-made video keys and serves them as video", () => {
    expect(isValidKey(KEY)).toBe(true);
    expect(isValidKey(KEY.replace(".mp4", ".webm"))).toBe(true);
    expect(isValidKey("videos/2026/evil.mp4")).toBe(false);
    expect(isValidKey("videos/2026/0b1f8e9c-1234-4abc-9def-0123456789ab.html")).toBe(false);
    expect(isValidKey("images/2026/0b1f8e9c-1234-4abc-9def-0123456789ab.mp4")).toBe(false);
    expect(contentTypeForKey(KEY)).toBe("video/mp4");
    expect(contentTypeForKey(KEY.replace(".mp4", ".webm"))).toBe("video/webm");
  });
});

describe("video background settings", () => {
  const video = { key: KEY, filename: "loop.mp4" };

  it("needs a video, and only accepts video files", () => {
    const withVideo = { ...DEFAULT_SLIDE1_BG, type: "video" as const, video: { ...DEFAULT_SLIDE1_BG.video, media: video } };
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: withVideo, videos: [video] }).success).toBe(true);
    const missing = { ...withVideo, video: { ...withVideo.video, media: null } };
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: missing }).success).toBe(false);
    const notVideo = { ...withVideo, video: { ...withVideo.video, media: { key: "images/2026/0b1f8e9c-1234-4abc-9def-0123456789ab.png", filename: "x" } } };
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: notVideo }).success).toBe(false);
  });

  it("fills in parts missing from settings saved before videos existed", () => {
    const old = { all: { type: "image", dynamic: DEFAULT_SLIDE1_BG.dynamic, image: DEFAULT_SLIDE1_BG.image }, overrides: {}, library: [] };
    const s = normalizeSettings(old as never);
    expect(s.all.video).toEqual(DEFAULT_SLIDE1_BG.video);
    expect(s.videos).toEqual([]);
    expect(normalizeBg(undefined)).toEqual(DEFAULT_SLIDE1_BG);
    expect(resolveSlide1Bg(old as never, "V3").video.overlay).toBe(DEFAULT_SLIDE1_BG.video.overlay);
  });
});
