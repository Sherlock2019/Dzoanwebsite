"use client";

import { useRef, useState } from "react";
import { LuEye, LuSave, LuUndo2, LuUpload } from "react-icons/lu";
import Slide1Backdrop from "@/components/sections/Slide1Backdrop";
import { mediaUrl, thumbUrl } from "@/lib/media-url";
import {
  CURRENT_IMAGE,
  ELECTRO_IMAGE,
  LABELS,
  NETWORK_THEMES,
  normalizeSettings,
  PALETTES,
  resolveSlide1Bg,
  SITE_VERSIONS,
  type DynamicBg,
  type ImageBg,
  type SiteVersion,
  type Slide1Bg,
  type Slide1BgSettings,
  type VideoBg,
  type VideoFile,
} from "@/lib/slide1-bg";
import type { Media } from "@/lib/types";
import { altFromName, api, ApiError, uploadImage, uploadVideo } from "./api";

type Target = "all" | SiteVersion;

/** The setting currently published for a target. */
const publishedFor = (s: Slide1BgSettings, t: Target): Slide1Bg => (t === "all" ? s.all : resolveSlide1Bg(s, t));

/**
 * Dashboard → Slide 1 background. The owner picks a dynamic neural network, a fixed image or a
 * video, for all versions or one; edits are previewed here only, Save publishes them (owner-only
 * API), Cancel restores the published setting.
 */
export default function BackgroundEditor({ initial }: { initial: Slide1BgSettings }) {
  const [saved, setSaved] = useState<Slide1BgSettings>(initial);
  const [target, setTarget] = useState<Target>("all");
  const [draft, setDraft] = useState<Slide1Bg>(initial.all);
  const [preview, setPreview] = useState<Slide1Bg>(initial.all);
  const [library, setLibrary] = useState<Media[]>(initial.library);
  const [videos, setVideos] = useState<VideoFile[]>(initial.videos);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const changed =
    JSON.stringify(draft) !== JSON.stringify(publishedFor(saved, target)) ||
    library.length !== saved.library.length ||
    videos.length !== saved.videos.length;
  const setVideo = <K extends keyof VideoBg>(k: K, v: VideoBg[K]) => setDraft((d) => ({ ...d, video: { ...d.video, [k]: v } }));

  async function uploadVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const media = await uploadVideo(file);
      // Kept for later reuse (6 most recent).
      setVideos((l) => [media, ...l.filter((m) => m.key !== media.key)].slice(0, 6));
      setDraft((d) => ({ ...d, type: "video", video: { ...d.video, media } }));
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  function pickTarget(t: Target) {
    setTarget(t);
    const bg = publishedFor(saved, t);
    setDraft(bg);
    setPreview(bg);
    setMessage(null);
  }

  const setDynamic = <K extends keyof DynamicBg>(k: K, v: DynamicBg[K]) => setDraft((d) => ({ ...d, dynamic: { ...d.dynamic, [k]: v } }));
  const setImage = <K extends keyof ImageBg>(k: K, v: ImageBg[K]) => setDraft((d) => ({ ...d, image: { ...d.image, [k]: v } }));

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const media = await uploadImage(file, altFromName(file.name));
      // Kept in the library for later reuse (12 most recent).
      setLibrary((l) => [media, ...l.filter((m) => m.key !== media.key)].slice(0, 12));
      setDraft((d) => ({ ...d, type: "image", image: { ...d.image, source: "upload", media } }));
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const next: Slide1BgSettings =
      target === "all"
        ? { all: draft, overrides: {}, library, videos }
        : { all: saved.all, overrides: { ...saved.overrides, [target]: draft }, library, videos };
    try {
      const published = normalizeSettings(await api<Slide1BgSettings>("/api/admin/background", { method: "PUT", body: JSON.stringify(next) }));
      setSaved(published);
      setLibrary(published.library);
      setVideos(published.videos);
      setPreview(draft);
      setMessage({ tone: "ok", text: `Published${target === "all" ? " for all versions" : ` for ${target}`}. Visitors see it on their next visit or reload.` });
    } catch (e) {
      const issues = e instanceof ApiError && e.issues ? ` (${Object.values(e.issues).join("; ")})` : "";
      setMessage({ tone: "error", text: `Not saved — the published background is unchanged. ${e instanceof Error ? e.message : ""}${issues}` });
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(v: SiteVersion) {
    setBusy(true);
    setMessage(null);
    const overrides = { ...saved.overrides };
    delete overrides[v];
    try {
      const published = normalizeSettings(
        await api<Slide1BgSettings>("/api/admin/background", {
          method: "PUT",
          body: JSON.stringify({ ...saved, overrides }),
        }),
      );
      setSaved(published);
      if (target === v) {
        setDraft(published.all);
        setPreview(published.all);
      }
      setMessage({ tone: "ok", text: `${v} now uses the shared background.` });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    const bg = publishedFor(saved, target);
    setDraft(bg);
    setPreview(bg);
    setLibrary(saved.library);
    setVideos(saved.videos);
    setMessage(null);
  }

  const d = draft.dynamic;
  const im = draft.image;

  return (
    <div className="admin-form">
      <div className="admin-form-head">
        <div>
          <h1>Slide 1 background</h1>
          <p className="hint">
            The background behind the first slide of the home carousel (questions &amp; answers and poem). Visitors always
            see the published setting.
          </p>
        </div>
      </div>
      {message && (
        <p className={`admin-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <fieldset className="admin-fieldset">
        <legend>Apply to</legend>
        <div className="bg-choices" role="radiogroup" aria-label="Apply to">
          {(["all", ...SITE_VERSIONS] as Target[]).map((t) => (
            <label key={t} className="checkbox-line">
              <input type="radio" name="bg-target" checked={target === t} onChange={() => pickTarget(t)} />
              {t === "all" ? "All versions (V2, V3, V4)" : t}
              {t !== "all" && saved.overrides[t] && <span className="hint"> · own setting</span>}
            </label>
          ))}
        </div>
        <p className="hint">
          {target === "all"
            ? "Saving here sets the shared background and removes every per-version setting."
            : saved.overrides[target]
              ? `${target} has its own background.`
              : `${target} uses the shared background; saving here gives it its own.`}
        </p>
        {SITE_VERSIONS.some((v) => saved.overrides[v]) && (
          <div className="bg-overrides">
            {SITE_VERSIONS.filter((v) => saved.overrides[v]).map((v) => (
              <button key={v} type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => removeOverride(v)}>
                {v}: use the shared background
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Background type</legend>
        <div className="bg-choices" role="radiogroup" aria-label="Background type">
          {(["dynamic", "image", "video"] as const).map((t) => (
            <label key={t} className="checkbox-line">
              <input type="radio" name="bg-type" checked={draft.type === t} onChange={() => setDraft((x) => ({ ...x, type: t }))} />
              {LABELS.type[t]}
            </label>
          ))}
        </div>

        {draft.type === "dynamic" ? (
          <div className="bg-grid">
            <label>
              <span className="admin-label">Theme</span>
              <select value={d.theme} onChange={(e) => setDynamic("theme", e.target.value as DynamicBg["theme"])}>
                {NETWORK_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {LABELS.theme[t]}
                  </option>
                ))}
              </select>
            </label>
            {d.theme === "electro" ? (
              <p className="hint">Blue neurons with blue, yellow and green sparkles; the brain turns 360°. Speed sets the rotation.</p>
            ) : d.theme === "bulb" ? (
              <p className="hint">
                Version 2 of the electronic brain: sparks run from neurons all over the brain and meet in the centre, then the
                neurons gather into a light bulb that lights up, and return to the brain. Speed sets the pace; density how many
                neurons and sparks.
              </p>
            ) : d.theme === "engine" ? (
              <p className="hint">
                The brain as an engine: business workflows, data and MLOps feed it, GPU compute powers it, and results flow
                to Insights, Automation and Better decisions. Speed sets the flow; density how busy it is.
              </p>
            ) : (
              <label>
                <span className="admin-label">Colours</span>
                <select value={d.palette} onChange={(e) => setDynamic("palette", e.target.value as DynamicBg["palette"])}>
                  {PALETTES.map((p) => (
                    <option key={p} value={p}>
                      {LABELS.palette[p]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Range label="Node density" min={0.5} max={1.5} step={0.1} value={d.density} onChange={(v) => setDynamic("density", v)} />
            <Range label="Signal speed" min={0.5} max={2} step={0.1} value={d.speed} onChange={(v) => setDynamic("speed", v)} />
            <Range label="Glow intensity" min={0} max={1} step={0.05} value={d.glow} onChange={(v) => setDynamic("glow", v)} />
            <Range label="Dark overlay" min={0} max={0.85} step={0.05} value={d.overlay} onChange={(v) => setDynamic("overlay", v)} />
          </div>
        ) : draft.type === "image" ? (
          <>
            <div className="bg-images" role="radiogroup" aria-label="Image">
              <button
                type="button"
                className={`bg-thumb${im.source === "current" ? " is-selected" : ""}`}
                aria-pressed={im.source === "current"}
                onClick={() => setImage("source", "current")}
              >
                <img src={CURRENT_IMAGE.small} alt="" />
                <span>Current image</span>
              </button>
              <button
                type="button"
                className={`bg-thumb${im.source === "electro" ? " is-selected" : ""}`}
                aria-pressed={im.source === "electro"}
                onClick={() => setImage("source", "electro")}
              >
                <img src={ELECTRO_IMAGE.small} alt="" />
                <span>Electronic brain</span>
              </button>
              {library.map((m) => {
                const selected = im.source === "upload" && im.media?.key === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={`bg-thumb${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setDraft((x) => ({ ...x, image: { ...x.image, source: "upload", media: m } }))}
                  >
                    <img src={thumbUrl(m)} alt="" />
                    <span>{m.alt || "Uploaded image"}</span>
                  </button>
                );
              })}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload a background image"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <LuUpload aria-hidden /> {uploading ? "Uploading…" : "Upload a new image"}
            </button>
            <p className="hint">JPEG, PNG or WebP, up to 15 MB. Wide images (about 2400 px) look best.</p>
            <div className="bg-grid">
              <Range label="Focal point — horizontal" min={0} max={100} step={1} unit="%" value={im.position.x} onChange={(v) => setImage("position", { ...im.position, x: v })} />
              <Range label="Focal point — vertical" min={0} max={100} step={1} unit="%" value={im.position.y} onChange={(v) => setImage("position", { ...im.position, y: v })} />
              <Range label="Dark overlay" min={0} max={0.85} step={0.05} value={im.overlay} onChange={(v) => setImage("overlay", v)} />
            </div>
          </>
        ) : (
          <>
            {videos.length === 0 ? (
              <p className="hint">No video yet: upload one below.</p>
            ) : (
              <div className="bg-images" role="radiogroup" aria-label="Video">
                {videos.map((v) => {
                  const selected = draft.video.media?.key === v.key;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      className={`bg-thumb${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setVideo("media", v)}
                    >
                      <video src={`${mediaUrl(v.key)}#t=0.5`} muted playsInline preload="metadata" />
                      <span>{v.filename}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <input
              ref={videoInput}
              type="file"
              accept="video/mp4,video/webm"
              className="sr-only"
              aria-label="Upload a background video"
              onChange={(e) => {
                uploadVideoFile(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" disabled={uploading} onClick={() => videoInput.current?.click()}>
              <LuUpload aria-hidden /> {uploading ? "Uploading…" : "Upload a video"}
            </button>
            <p className="hint">
              MP4 or WebM, up to 45 MB. It plays muted and looping. A short loop (10–30 s, 1080p, compressed) works best and
              loads fast.
            </p>
            <div className="bg-grid">
              <Range label="Focal point — horizontal" min={0} max={100} step={1} unit="%" value={draft.video.position.x} onChange={(x) => setVideo("position", { ...draft.video.position, x })} />
              <Range label="Focal point — vertical" min={0} max={100} step={1} unit="%" value={draft.video.position.y} onChange={(y) => setVideo("position", { ...draft.video.position, y })} />
              <Range label="Dark overlay" min={0} max={0.85} step={0.05} value={draft.video.overlay} onChange={(v) => setVideo("overlay", v)} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Preview</legend>
        <div className="bg-preview">
          <Slide1Backdrop bg={preview} running />
          <div className="bg-preview-text">
            <p className="bg-preview-kicker">CEO</p>
            <p className="bg-preview-q">As a CEO, do you need to turn business pains into business wins?</p>
            <p className="bg-preview-a">Let’s talk about what holds you back— and what we can build next.</p>
          </div>
        </div>
        {JSON.stringify(preview) !== JSON.stringify(draft) && <p className="hint">You have changes that aren’t in the preview yet: press Preview.</p>}
      </fieldset>

      <div className="admin-form-foot admin-form-actions">
        <button type="button" className="btn btn-outline" onClick={() => setPreview(draft)}>
          <LuEye aria-hidden /> Preview
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || uploading} onClick={save}>
          <LuSave aria-hidden /> {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy || !changed} onClick={cancel}>
          <LuUndo2 aria-hidden /> Cancel
        </button>
      </div>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      <span className="admin-label">
        {label} <output>{unit ? `${value}${unit}` : value.toFixed(2)}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
