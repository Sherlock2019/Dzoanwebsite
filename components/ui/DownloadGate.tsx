"use client";

import { useEffect, useRef, useState } from "react";
import { LuDownload, LuLock, LuMail, LuX } from "react-icons/lu";

/**
 * "Download full project details" button. Opens a dialog that asks for name, email and company,
 * emails a 6-digit code, and starts the download once the code is confirmed. Visitors who already
 * confirmed an email (signed cookie, 30 days) download straight away.
 */

type Step = "details" | "code" | "done";

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { url?: string; need?: string; sent?: boolean; error?: string; expired?: boolean };
  return { ok: res.ok, ...data };
}

export default function DownloadGate({ projectId, index, filename, projectTitle }: { projectId: string; index: number; filename: string; projectTitle: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  function start(url: string) {
    setLink(url);
    setStep("done");
    window.location.href = url;
  }

  async function open() {
    setError("");
    setBusy(true);
    const r = await post("/api/downloads/request", { project: projectId, index }).catch(() => null);
    setBusy(false);
    if (r?.url) {
      // Already confirmed on this browser: download without asking again.
      window.location.href = r.url;
      return;
    }
    setStep("details");
    if (r && !r.ok) setError(r.error || "Something went wrong.");
    dialog.current?.showModal();
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/downloads/request", { project: projectId, index, ...form }).catch(() => null);
    setBusy(false);
    if (r?.url) return start(r.url);
    if (!r?.sent) return setError(r?.error || "Something went wrong. Please try again.");
    setCode("");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/downloads/verify", { project: projectId, index, ...form, code }).catch(() => null);
    setBusy(false);
    if (r?.url) return start(r.url);
    setError(r?.error || "Something went wrong. Please try again.");
    if (r?.expired) setStep("details");
  }

  const field = (name: keyof typeof form, label: string, type: string, extra: object = {}) => (
    <label className="gate-field">
      <span>{label}</span>
      <input type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...extra} />
    </label>
  );

  return (
    <>
      <button type="button" className="btn btn-primary btn-download" onClick={open} disabled={busy}>
        <LuDownload aria-hidden /> {filename.replace(/\.(pdf|docx)$/i, "")}
      </button>
      <dialog ref={dialog} className="gate" aria-labelledby={`gate-${projectId}-${index}`} onClose={() => setError("")}>
        <button type="button" className="gate-close" onClick={() => dialog.current?.close()} aria-label="Close">
          <LuX aria-hidden />
        </button>
        <h2 id={`gate-${projectId}-${index}`}>
          <LuLock aria-hidden /> Full project details
        </h2>
        <p className="gate-file">
          {projectTitle} · <strong>{filename}</strong>
        </p>

        {step === "details" && (
          <form onSubmit={sendCode}>
            <p className="gate-intro">Enter your details and we&apos;ll email you a 6-digit code to confirm your address. Then the download starts.</p>
            {field("name", "Your name", "text", { required: true, minLength: 2, maxLength: 80, autoComplete: "name" })}
            {field("email", "Work or personal email", "email", { required: true, maxLength: 160, autoComplete: "email" })}
            {field("company", "Company (optional)", "text", { maxLength: 120, autoComplete: "organization" })}
            {error && <p className="gate-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <LuMail aria-hidden /> {busy ? "Sending…" : "Email me a code"}
            </button>
            <p className="gate-note">Your email is used only to share this document and so I can follow up. No newsletter.</p>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verify}>
            <p className="gate-intro">
              We sent a code to <strong>{form.email}</strong>. It can take a minute; check your spam folder too.
            </p>
            <label className="gate-field">
              <span>6-digit code</span>
              <input
                ref={codeInput}
                className="gate-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {error && <p className="gate-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
              <LuDownload aria-hidden /> {busy ? "Checking…" : "Confirm and download"}
            </button>
            <p className="gate-note">
              <button type="button" className="gate-link" onClick={() => sendCode()} disabled={busy}>
                Send a new code
              </button>{" "}
              ·{" "}
              <button type="button" className="gate-link" onClick={() => { setError(""); setStep("details"); }}>
                Change email
              </button>
            </p>
          </form>
        )}

        {step === "done" && (
          <div>
            <p className="gate-intro">Thank you, your email is confirmed. The download should start now.</p>
            <p>
              <a className="btn btn-outline" href={link}>
                <LuDownload aria-hidden /> Download again
              </a>
            </p>
            <p className="gate-note">Other project documents on this site will now download without asking again.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
