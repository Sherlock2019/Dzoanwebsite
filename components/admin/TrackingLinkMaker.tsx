"use client";

import { useEffect, useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

/** Turns "Acme Corp – Jane" into a link like https://site/?r=acme-corp-jane to send to that recruiter. */
export default function TrackingLinkMaker() {
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const tag = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const link = tag ? `${origin}/?r=${tag}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the link is still selectable in the box
    }
  }

  return (
    <div className="an-linkmaker admin-form">
      <label>
        <span className="admin-label">Company or person</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gameloft – Daryl" maxLength={80} />
      </label>
      {link && (
        <div className="an-link">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Tracking link" />
          <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
            {copied ? <LuCheck aria-hidden /> : <LuCopy aria-hidden />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
