import type { Media } from "./types";

// Client-safe helpers to turn storage keys into URLs served by app/media/[...key]/route.ts.

export function mediaUrl(key: string | undefined | null, opts?: { download?: boolean; v?: string }): string {
  if (!key) return "";
  const params = new URLSearchParams();
  if (opts?.download) params.set("download", "1");
  if (opts?.v) params.set("v", opts.v);
  const qs = params.toString();
  return `/media/${key}${qs ? `?${qs}` : ""}`;
}

export function thumbUrl(media: Media | null | undefined): string {
  if (!media) return "";
  return mediaUrl(media.thumb || media.key);
}

export function fullUrl(media: Media | null | undefined): string {
  if (!media) return "";
  return mediaUrl(media.key);
}
