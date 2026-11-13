// Background of slide 1 of the home carousel, chosen by the owner in the dashboard
// (Dashboard → Slide 1 background) and saved in the profile. Every visitor gets the saved choice.
//
//   - "dynamic": an animated neural network (layered, brain-shaped, the rotating 3D
//                "electronic brain" with sparkles, its v2 "idea bulb" whose sparks converge and whose
//                neurons gather into a lit light bulb, or the "AI engine": the brain fed by business,
//                data and MLOps blocks, powered by GPU compute, producing outputs), on a canvas;
//   - "image":   a fixed image: the current one (humanaibrain), the electronic brain, or an upload;
//   - "video":   an uploaded MP4/WebM video, muted and looping.
//
// One shared setting ("all"), optionally overridden per site version (V2, V3, V4).

import { fullUrl } from "@/lib/media-url";
import type { Media } from "@/lib/types";

export const BG_TYPES = ["dynamic", "image", "video"] as const;
export type BgType = (typeof BG_TYPES)[number];

export const NETWORK_THEMES = ["layered", "brain", "electro", "bulb", "engine"] as const;
export type NetworkTheme = (typeof NETWORK_THEMES)[number];

export const PALETTES = ["blue-cyan", "deep-blue", "cyan"] as const;
export type Palette = (typeof PALETTES)[number];

export const IMAGE_SOURCES = ["current", "electro", "upload"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const SITE_VERSIONS = ["V2", "V3", "V4"] as const;
export type SiteVersion = (typeof SITE_VERSIONS)[number];

export interface DynamicBg {
  theme: NetworkTheme;
  palette: Palette;
  /** Number of neurons, relative (0.5 = sparse … 1.5 = dense). */
  density: number;
  /** Signal speed, relative (0.5 = slow … 2 = fast). */
  speed: number;
  /** Strength of the activation glows, 0–1. */
  glow: number;
  /** Dark layer over the network, 0–0.85. */
  overlay: number;
}

export interface ImageBg {
  /** "current" = the existing image (humanaibrain); "upload" = `media`. */
  source: ImageSource;
  media: Media | null;
  /** Focal point, in percent (CSS background-position). */
  position: { x: number; y: number };
  /** Dark layer over the image, 0–0.85 (keeps the text readable). */
  overlay: number;
}

/** An uploaded background video (MP4/WebM). */
export interface VideoFile {
  key: string;
  filename: string;
}

export interface VideoBg {
  media: VideoFile | null;
  /** Focal point, in percent (CSS object-position). */
  position: { x: number; y: number };
  /** Dark layer over the video, 0–0.85 (keeps the text readable). */
  overlay: number;
}

export interface Slide1Bg {
  type: BgType;
  dynamic: DynamicBg;
  image: ImageBg;
  video: VideoBg;
}

export interface Slide1BgSettings {
  /** Shared setting, used by every version without an override. */
  all: Slide1Bg;
  /** Optional per-version settings. */
  overrides: Partial<Record<SiteVersion, Slide1Bg>>;
  /** Images uploaded for this background, kept for later reuse. */
  library: Media[];
  /** Videos uploaded for this background, kept for later reuse. */
  videos: VideoFile[];
}

export const DEFAULT_DYNAMIC: DynamicBg = { theme: "layered", palette: "blue-cyan", density: 1, speed: 1, glow: 0.6, overlay: 0.3 };
export const DEFAULT_IMAGE: ImageBg = { source: "current", media: null, position: { x: 60, y: 50 }, overlay: 0.45 };
export const DEFAULT_VIDEO: VideoBg = { media: null, position: { x: 50, y: 50 }, overlay: 0.45 };
export const DEFAULT_SLIDE1_BG: Slide1Bg = { type: "dynamic", dynamic: DEFAULT_DYNAMIC, image: DEFAULT_IMAGE, video: DEFAULT_VIDEO };
export const DEFAULT_SLIDE1_SETTINGS: Slide1BgSettings = { all: DEFAULT_SLIDE1_BG, overrides: {}, library: [], videos: [] };

/** The current image (humanaibrain), large and small. */
export const CURRENT_IMAGE = { large: "/humanaibrain-2400.webp", small: "/humanaibrain-1280.webp" };

/** The electronic-brain image: model and fallback of the "electro" theme, and a fixed-image choice. */
export const ELECTRO_IMAGE = { large: "/electrobrain.webp", small: "/electrobrain-1280.webp" };

export const LABELS = {
  type: { dynamic: "Dynamic neural network", image: "Fixed image", video: "Video" } as Record<BgType, string>,
  theme: {
    layered: "Layered network",
    brain: "Brain-shaped network",
    electro: "Electronic brain (3D, rotating, sparkles)",
    bulb: "Electronic brain v2: idea bulb (sparks converge, neurons light a bulb)",
    engine: "AI engine (business, data, MLOps, GPU → outputs)",
  } as Record<NetworkTheme, string>,
  palette: { "blue-cyan": "Blue & cyan", "deep-blue": "Deep blue", cyan: "Cyan" } as Record<Palette, string>,
};

/** Colours (RGB triplets) of each palette: connections/neurons, forward signals, backward signals. */
export const PALETTE_RGB: Record<Palette, { base: string; forward: string; backward: string }> = {
  "blue-cyan": { base: "70, 140, 255", forward: "90, 200, 255", backward: "140, 235, 255" },
  "deep-blue": { base: "60, 110, 235", forward: "95, 150, 255", backward: "150, 185, 255" },
  cyan: { base: "50, 170, 220", forward: "80, 225, 255", backward: "170, 245, 255" },
};

/** A setting with every part present (settings saved by older versions may lack newer parts). */
export function normalizeBg(b: Partial<Slide1Bg> | null | undefined): Slide1Bg {
  return {
    ...DEFAULT_SLIDE1_BG,
    ...b,
    dynamic: { ...DEFAULT_DYNAMIC, ...b?.dynamic },
    image: { ...DEFAULT_IMAGE, ...b?.image },
    video: { ...DEFAULT_VIDEO, ...b?.video },
  };
}

/** Full settings with defaults filled in. */
export function normalizeSettings(s: Partial<Slide1BgSettings> | null | undefined): Slide1BgSettings {
  const overrides: Slide1BgSettings["overrides"] = {};
  for (const v of SITE_VERSIONS) if (s?.overrides?.[v]) overrides[v] = normalizeBg(s.overrides[v]);
  return { all: normalizeBg(s?.all), overrides, library: s?.library ?? [], videos: s?.videos ?? [] };
}

/** The setting a version shows: its override, else the shared one, else the default. */
export function resolveSlide1Bg(settings: Slide1BgSettings | null | undefined, version: SiteVersion): Slide1Bg {
  return normalizeBg(settings?.overrides?.[version] ?? settings?.all);
}

/** URL of a fixed image (an upload without its file falls back to the current image). */
export function imageBgUrl(image: ImageBg): string {
  if (image.source === "electro") return ELECTRO_IMAGE.large;
  return image.source === "upload" && image.media ? fullUrl(image.media) : CURRENT_IMAGE.large;
}
