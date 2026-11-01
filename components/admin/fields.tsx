"use client";

import { useRef, useState } from "react";
import { LuArrowDown, LuArrowUp, LuPlus, LuTrash2, LuUpload, LuX } from "react-icons/lu";
import { mediaUrl, thumbUrl } from "@/lib/media-url";
import type { Link, Media } from "@/lib/types";
import { altFromName, uploadImage } from "./api";

export interface RefOption {
  id: string;
  title: string;
}

// ------------------------------------------------------------------ Tags (chips)

export function TagsInput({
  id,
  value,
  onChange,
  suggestions = [],
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: readonly string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div className="tags-input">
      <ul className="tag-chips">
        {value.map((t) => (
          <li key={t}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <LuX aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        value={draft}
        placeholder="Type and press Enter (comma-separated works too)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {suggestions.filter((s) => !value.includes(s)).length > 0 && (
        <div className="tag-suggestions">
          <span>Suggestions:</span>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <button type="button" key={s} onClick={() => onChange([...value, s])}>
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ One item per line

export function LinesInput({
  id,
  value,
  onChange,
  rows = 6,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
}) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea
      id={id}
      rows={rows}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

// ------------------------------------------------------------------ Images

function MediaRow({
  media,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  media: Media;
  onChange: (m: Media) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <li className="media-row">
      <a href={mediaUrl(media.key)} target="_blank" rel="noopener noreferrer" className="media-row-thumb">
        <img src={thumbUrl(media)} alt={media.alt || "Uploaded image"} />
      </a>
      <div className="media-row-fields">
        <label>
          Alt text (describe the image for screen readers)
          <input value={media.alt} maxLength={300} onChange={(e) => onChange({ ...media, alt: e.target.value })} />
        </label>
        <label>
          Caption (optional, shown publicly)
          <input value={media.caption || ""} maxLength={500} onChange={(e) => onChange({ ...media, caption: e.target.value })} />
        </label>
        {media.width && (
          <p className="hint">
            {media.width} × {media.height}px
          </p>
        )}
      </div>
      <div className="media-row-actions">
        {onUp && (
          <button type="button" className="icon-btn" onClick={onUp} aria-label="Move up">
            <LuArrowUp aria-hidden />
          </button>
        )}
        {onDown && (
          <button type="button" className="icon-btn" onClick={onDown} aria-label="Move down">
            <LuArrowDown aria-hidden />
          </button>
        )}
        <button type="button" className="icon-btn danger" onClick={onRemove} aria-label="Remove image">
          <LuTrash2 aria-hidden />
        </button>
      </div>
    </li>
  );
}

function useUploader(onUploaded: (m: Media[]) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const done: Media[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        done.push(await uploadImage(file, altFromName(file.name)));
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (done.length) onUploaded(done);
    setError(errors.join(" · "));
    setBusy(false);
  }
  return { busy, error, upload };
}

export function ImageField({ id, value, onChange }: { id: string; value: Media | null; onChange: (m: Media | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, upload } = useUploader((m) => onChange(m[0]));
  return (
    <div className="image-field">
      {value ? (
        <ul className="media-rows">
          <MediaRow media={value} onChange={onChange} onRemove={() => onChange(null)} />
        </ul>
      ) : (
        <p className="hint">No image yet.</p>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}>
        <LuUpload aria-hidden /> {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function ImagesField({ id, value, onChange }: { id: string; value: Media[]; onChange: (m: Media[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, upload } = useUploader((m) => onChange([...value, ...m]));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="image-field">
      {value.length > 0 && (
        <ul className="media-rows">
          {value.map((m, i) => (
            <MediaRow
              key={m.key}
              media={m}
              onChange={(nm) => onChange(value.map((x, j) => (j === i ? nm : x)))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < value.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </ul>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}>
        <LuUpload aria-hidden /> {busy ? "Uploading…" : "Add images"}
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Links

export function LinksField({ id, value, onChange }: { id: string; value: Link[]; onChange: (l: Link[]) => void }) {
  return (
    <div className="links-field" id={id}>
      {value.map((l, i) => (
        <div key={i} className="link-row">
          <input
            aria-label={`Link ${i + 1} label`}
            placeholder="Label (e.g. Documentation)"
            value={l.label}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <input
            aria-label={`Link ${i + 1} URL`}
            placeholder="https://…"
            type="url"
            value={l.url}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <button type="button" className="icon-btn danger" aria-label={`Remove link ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <LuTrash2 aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...value, { label: "", url: "" }])}>
        <LuPlus aria-hidden /> Add link
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ References

export function RefSelect({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: RefOption[] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— None —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.title}
        </option>
      ))}
    </select>
  );
}

export function RefsChecklist({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: RefOption[] }) {
  if (!options.length) return <p className="hint">Nothing to link yet.</p>;
  return (
    <div className="checklist">
      {options.map((o) => (
        <label key={o.id}>
          <input
            type="checkbox"
            checked={value.includes(o.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))}
          />
          {o.title}
        </label>
      ))}
    </div>
  );
}
