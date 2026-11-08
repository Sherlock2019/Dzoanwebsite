import { describe, expect, it } from "vitest";
import { CURRENT_IMAGE, DEFAULT_SLIDE1_BG, DEFAULT_SLIDE1_SETTINGS, imageBgUrl, resolveSlide1Bg, type Slide1Bg } from "@/lib/slide1-bg";
import { profileSchema, slide1BgSettingsSchema } from "@/lib/validation";

const image = (over: Partial<Slide1Bg["image"]> = {}): Slide1Bg => ({
  ...DEFAULT_SLIDE1_BG,
  type: "image",
  image: { ...DEFAULT_SLIDE1_BG.image, ...over },
});

describe("slide 1 background settings", () => {
  it("defaults to the dynamic layered network", () => {
    expect(DEFAULT_SLIDE1_BG.type).toBe("dynamic");
    expect(DEFAULT_SLIDE1_BG.dynamic.theme).toBe("layered");
    expect(resolveSlide1Bg(undefined, "V3")).toEqual(DEFAULT_SLIDE1_BG);
  });

  it("uses a version's override, else the shared setting", () => {
    const shared = image();
    const v3 = { ...DEFAULT_SLIDE1_BG, dynamic: { ...DEFAULT_SLIDE1_BG.dynamic, theme: "brain" as const } };
    const s = { all: shared, overrides: { V3: v3 }, library: [] };
    expect(resolveSlide1Bg(s, "V2")).toBe(shared);
    expect(resolveSlide1Bg(s, "V3")).toBe(v3);
    expect(resolveSlide1Bg(s, "V4")).toBe(shared);
  });

  it("serves the current image, or the uploaded one", () => {
    expect(imageBgUrl(image().image)).toBe(CURRENT_IMAGE.large);
    expect(imageBgUrl(image({ source: "electro" }).image)).toBe("/electrobrain.webp");
    // The AI engine and the electronic brain are dynamic themes too.
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: { ...DEFAULT_SLIDE1_BG, dynamic: { ...DEFAULT_SLIDE1_BG.dynamic, theme: "engine" } } }).success).toBe(true);
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: { ...DEFAULT_SLIDE1_BG, dynamic: { ...DEFAULT_SLIDE1_BG.dynamic, theme: "electro" } } }).success).toBe(true);
    expect(imageBgUrl(image({ source: "upload", media: { key: "images/2026/a.webp", alt: "" } }).image)).toBe("/media/images/2026/a.webp");
    // An upload without its file falls back to the current image.
    expect(imageBgUrl(image({ source: "upload", media: null }).image)).toBe(CURRENT_IMAGE.large);
  });

  it("validates settings on the server", () => {
    expect(slide1BgSettingsSchema.safeParse(DEFAULT_SLIDE1_SETTINGS).success).toBe(true);
    // An uploaded-image background needs its image.
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: image({ source: "upload", media: null }) }).success).toBe(false);
    // Out-of-range values are refused.
    expect(slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: image({ overlay: 2 }) }).success).toBe(false);
    expect(
      slide1BgSettingsSchema.safeParse({ ...DEFAULT_SLIDE1_SETTINGS, all: { ...DEFAULT_SLIDE1_BG, dynamic: { ...DEFAULT_SLIDE1_BG.dynamic, speed: 9 } } }).success,
    ).toBe(false);
    // Unknown versions are dropped, not stored.
    const parsed = slide1BgSettingsSchema.parse({ ...DEFAULT_SLIDE1_SETTINGS, overrides: { V9: DEFAULT_SLIDE1_BG } });
    expect(Object.keys(parsed.overrides)).toEqual([]);
  });

  it("is part of the profile, with the default when missing (older saved profiles)", () => {
    const parsed = profileSchema.parse({ name: "Me" });
    expect(parsed.slide1_bg).toEqual(DEFAULT_SLIDE1_SETTINGS);
  });
});
