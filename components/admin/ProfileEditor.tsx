"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuFileText, LuPlus, LuSave, LuTrash2, LuUpload } from "react-icons/lu";
import { mediaUrl } from "@/lib/media-url";
import type { Profile } from "@/lib/types";
import { api, ApiError, uploadPdf } from "./api";
import { ImageField } from "./fields";

type TextKey = {
  [K in keyof Profile]: Profile[K] extends string ? K : never;
}[keyof Profile];

const SECTIONS: { title: string; fields: { name: TextKey; label: string; rows?: number; help?: string }[] }[] = [
  {
    title: "Identity & hero",
    fields: [
      { name: "name", label: "Name" },
      { name: "headline", label: "Headline" },
      { name: "tagline", label: "Supporting line (What I do)", help: "**text** = bold." },
      { name: "value_proposition", label: "Hero statement (shown only if the mission is empty)", rows: 2 },
      { name: "hero_description", label: "Hero description", rows: 3 },
      { name: "mission", label: "Mission statement (Home)", rows: 2 },
      { name: "bio_title", label: "Bio heading (About)", help: "e.g. My Bio" },
      {
        name: "bio",
        label: "My Bio (About, next to the title)",
        rows: 6,
        help: "“- ” = bullet, **text** = bold, [label](https://…) = link. Leave empty to hide.",
      },
      { name: "how_i_work", label: "How I work", help: "Steps separated by → , shown as a flow under the mission." },
      { name: "positioning", label: "Skills section intro", rows: 2 },
    ],
  },
  {
    title: "Home — invitation & booking",
    fields: [
      { name: "invitation_title", label: "Invitation heading" },
      { name: "invitation", label: "Invitation text", rows: 4, help: "Shown on Home above the contact buttons." },
      {
        name: "booking_url",
        label: "Google Calendar booking link",
        help: "Google Calendar → Create → Appointment schedule → Share → copy the booking page link (https://calendar.app.google/…). Leave empty to hide the button.",
      },
      { name: "booking_label", label: "Booking button text", help: "e.g. Book an interview" },
    ],
  },
  {
    title: "About",
    fields: [
      { name: "about_title", label: "About heading", help: "e.g. Professional Profile. Empty = your headline." },
      { name: "about", label: "Biography", rows: 14, help: "Blank line = new paragraph. “- ” starts a bullet. **text** = bold." },
      { name: "current_role", label: "Current role (“Currently I am working as …”)" },
      { name: "current_company", label: "Current company" },
      { name: "current_company_url", label: "Current company website" },
      { name: "focus", label: "Focus" },
      { name: "location", label: "Location" },
      { name: "approach", label: "Professional approach" },
      { name: "languages", label: "Languages" },
      { name: "citizenship", label: "Citizenship (leave empty to hide)" },
    ],
  },
  {
    title: "Contact links",
    fields: [
      { name: "email", label: "Public email" },
      { name: "linkedin", label: "LinkedIn URL" },
      { name: "github", label: "GitHub URL" },
      { name: "website", label: "Website URL (optional)" },
      { name: "phone", label: "Phone / WhatsApp number", help: "Only published when the box below is ticked." },
    ],
  },
  {
    title: "Search & sharing",
    fields: [
      { name: "seo_title", label: "Page title (SEO)" },
      { name: "seo_description", label: "Description (SEO / social preview)", rows: 2 },
    ],
  },
];

export default function ProfileEditor({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [p, setP] = useState<Profile>(initial);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function save(next: Profile = p) {
    setSaving(true);
    setMessage(null);
    setIssues({});
    try {
      const saved = await api<Profile>("/api/admin/profile", { method: "PUT", body: JSON.stringify(next) });
      setP(saved);
      setMessage({ tone: "ok", text: "Profile saved." });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setIssues(err.issues || {});
      setMessage({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function onPdf(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPdfBusy(true);
    setMessage(null);
    try {
      const resume = await uploadPdf(file);
      const next = { ...p, resume };
      setP(next);
      await save(next);
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="admin-form-head">
        <div>
          <h1>Profile &amp; résumé</h1>
          <p className="hint">Changes go live as soon as you save.</p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <LuSave aria-hidden /> {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
      {message && (
        <p className={`admin-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <fieldset className="admin-fieldset">
        <legend>Profile picture</legend>
        <ImageField id="f-image" value={p.image} onChange={(m) => set("image", m)} />
        <p className="hint">Use a professional photo of yourself. Without one, an initials badge is shown. Remember to save.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Home banner image</legend>
        <ImageField id="f-hero-image" value={p.hero_image} onChange={(m) => set("hero_image", m)} />
        <p className="hint">Shown full-width at the top of Home. Wide images work best (about 2048 × 768). Remember to save.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Résumé PDF</legend>
        {p.resume ? (
          <p>
            <a href={mediaUrl(p.resume.key)} target="_blank" rel="noopener noreferrer">
              <LuFileText aria-hidden /> {p.resume.filename}
            </a>
          </p>
        ) : (
          <p className="hint">No résumé uploaded — the résumé buttons are hidden.</p>
        )}
        <input ref={pdfInput} type="file" accept="application/pdf" className="sr-only" id="f-resume" onChange={(e) => { onPdf(e.target.files); e.target.value = ""; }} />
        <p className="admin-inline-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => pdfInput.current?.click()} disabled={pdfBusy}>
            <LuUpload aria-hidden /> {pdfBusy ? "Uploading…" : p.resume ? "Replace PDF" : "Upload PDF"}
          </button>
          {p.resume && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (window.confirm("Remove the résumé PDF from the site?")) save({ ...p, resume: null });
              }}
            >
              <LuTrash2 aria-hidden /> Remove
            </button>
          )}
        </p>
      </fieldset>

      {SECTIONS.map((section) => (
        <fieldset key={section.title} className="admin-fieldset">
          <legend>{section.title}</legend>
          <div className="admin-fields">
            {section.fields.map((f) => (
              <div key={f.name} className={`admin-field${f.rows ? " is-wide" : ""}${issues[f.name] ? " has-error" : ""}`}>
                <label htmlFor={`p-${f.name}`} className="admin-label">
                  {f.label}
                </label>
                {f.rows ? (
                  <textarea id={`p-${f.name}`} rows={f.rows} value={p[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                ) : (
                  <input id={`p-${f.name}`} value={p[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                )}
                {f.help && <p className="hint">{f.help}</p>}
                {issues[f.name] && <p className="field-error">{issues[f.name]}</p>}
              </div>
            ))}
          </div>
          {section.title === "Contact links" && (
            <label className="checkbox-line">
              <input type="checkbox" checked={p.show_phone} onChange={(e) => set("show_phone", e.target.checked)} />
              Publish phone on the public site (WhatsApp + click-to-call buttons)
            </label>
          )}
        </fieldset>
      ))}

      <fieldset className="admin-fieldset">
        <legend>Headline numbers (hero)</legend>
        <p className="hint">Only figures supported by your résumé.</p>
        {p.stats.map((s, i) => (
          <div key={i} className="link-row">
            <input aria-label={`Stat ${i + 1} value`} placeholder="Value (e.g. 7+ years)" value={s.value} onChange={(e) => set("stats", p.stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <input aria-label={`Stat ${i + 1} label`} placeholder="Label" value={s.label} onChange={(e) => set("stats", p.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <button type="button" className="icon-btn danger" aria-label={`Remove stat ${i + 1}`} onClick={() => set("stats", p.stats.filter((_, j) => j !== i))}>
              <LuTrash2 aria-hidden />
            </button>
          </div>
        ))}
        {p.stats.length < 8 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set("stats", [...p.stats, { value: "", label: "" }])}>
            <LuPlus aria-hidden /> Add number
          </button>
        )}
      </fieldset>

      <div className="admin-form-foot">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <LuSave aria-hidden /> {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
