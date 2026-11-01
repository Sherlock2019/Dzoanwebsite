"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LuCheck, LuFileText, LuRefreshCw, LuSparkles, LuTrash2, LuUpload, LuX } from "react-icons/lu";
import { formatDate } from "@/lib/text";
import { api } from "./api";

interface Status {
  rag: { ok: boolean; documents?: number; error?: string };
  ollama: { ok: boolean; url: string; embedModel: string; embedReady: boolean; analyzeModel: string; analyzeReady: boolean; error?: string };
  flowise: { configured: boolean; reachable: boolean; url: string | null };
  chat: { enabled: boolean; model: string; dailyLimit: number };
}

interface Doc {
  id: string;
  title: string;
  filename: string;
  size_bytes: number;
  public: boolean;
  status: "processing" | "ready" | "error" | "analyzing" | "analyzed";
  error: string | null;
  chars: number;
  chunks: number;
  embedded: boolean;
  summary: string | null;
  analyzed_chars: number | null;
  created_at: string;
}

interface Proposal {
  id: string;
  document_title: string | null;
  kind: string;
  target_label: string | null;
  field: string | null;
  current_value: string | null;
  proposed: unknown;
  reason: string | null;
  evidence: string | null;
}

const KIND_LABEL: Record<string, string> = {
  profile_field: "Update profile",
  project_update: "Update project",
  project_new: "New project (draft)",
  experience_new: "New role (draft)",
  certification_new: "New certification / course (draft)",
  skill_add: "Add skills",
};

const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return <span className={`status-dot ${ok ? "ok" : warn ? "warn" : "off"}`} aria-hidden />;
}

/** Flowise as the browser reaches it: same host as this page, Flowise's own port. */
function flowiseLink(serverUrl: string | null): string | null {
  if (!serverUrl || typeof window === "undefined") return null;
  try {
    const u = new URL(serverUrl);
    return `${window.location.protocol}//${window.location.hostname}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return null;
  }
}

function toEditable(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value.join("\n");
  return JSON.stringify(value, null, 2);
}

function fromEditable(text: string, original: unknown): unknown {
  if (typeof original === "string") return text;
  if (Array.isArray(original) && original.every((v) => typeof v === "string")) {
    return text.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  return JSON.parse(text);
}

function ProposalCard({ p, onDone }: { p: Proposal; onDone: (msg: string) => void }) {
  const [text, setText] = useState(toEditable(p.proposed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = p.kind === "profile_field" || p.kind === "project_update" || p.kind === "skill_add";

  async function act(action: "apply" | "reject") {
    setBusy(true);
    setError("");
    try {
      const value = action === "apply" ? fromEditable(text, p.proposed) : undefined;
      const r = await api<{ result?: string }>(`/api/admin/ai/proposals/${p.id}`, { method: "POST", body: JSON.stringify({ action, value }) });
      onDone(action === "apply" ? r.result || "Applied." : "Proposal rejected.");
    } catch (e) {
      setError(e instanceof SyntaxError ? "The edited value is not valid JSON." : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="proposal">
      <div className="proposal-head">
        <span className="badge tone-blue">{KIND_LABEL[p.kind] || p.kind}</span>
        {p.target_label && <strong>{p.target_label}</strong>}
        {p.document_title && <span className="hint">from “{p.document_title}”</span>}
      </div>
      {p.reason && <p className="proposal-reason">{p.reason}</p>}
      {p.evidence && (
        <blockquote className="proposal-evidence">
          <LuFileText aria-hidden /> “{p.evidence}”
        </blockquote>
      )}
      <div className="proposal-diff">
        {p.current_value !== null && (
          <div>
            <p className="admin-label">Now on the site</p>
            <pre className="proposal-current">{p.current_value || "(empty)"}</pre>
          </div>
        )}
        <div>
          <label className="admin-label" htmlFor={`pv-${p.id}`}>
            Proposed {live ? "(you can edit before applying)" : "— created as a draft (edit freely)"}
          </label>
          <textarea id={`pv-${p.id}`} rows={Math.min(14, Math.max(3, text.split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="admin-inline-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("apply")}>
          <LuCheck aria-hidden /> {live ? "Apply (goes live)" : "Create draft"}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act("reject")}>
          <LuX aria-hidden /> Reject
        </button>
      </div>
    </li>
  );
}

export default function AiWorkspace() {
  const [status, setStatus] = useState<Status | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<Status>("/api/admin/ai/status");
      setStatus(s);
      if (s.rag.ok) {
        const [d, p] = await Promise.all([api<Doc[]>("/api/admin/ai/documents"), api<Proposal[]>("/api/admin/ai/proposals")]);
        setDocs(d);
        setProposals(p);
      }
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while something is processing or being analysed.
  const busy = docs.some((d) => d.status === "processing" || d.status === "analyzing");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("file", f));
    try {
      const r = await api<{ created: Doc[]; errors: string[] }>("/api/admin/ai/documents", { method: "POST", body: form });
      setMessage({
        tone: r.errors.length ? "error" : "ok",
        text: [r.created.length ? `${r.created.length} document(s) uploaded — processing…` : "", ...r.errors].filter(Boolean).join(" · "),
      });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
    setUploading(false);
    refresh();
  }

  async function docAction(doc: Doc, action: "analyze" | "toggle" | "delete") {
    setMessage(null);
    try {
      if (action === "analyze") {
        await api(`/api/admin/ai/documents/${doc.id}/analyze`, { method: "POST" });
        setMessage({ tone: "ok", text: `Analysing “${doc.title}”… proposals will appear in the AI Inbox below.` });
      } else if (action === "toggle") {
        await api(`/api/admin/ai/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ public: !doc.public }) });
      } else {
        if (!window.confirm(`Delete “${doc.title}” and its search index? Proposals already applied stay on the site.`)) return;
        await api(`/api/admin/ai/documents/${doc.id}`, { method: "DELETE" });
      }
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
    refresh();
  }

  return (
    <div>
      <div className="admin-form-head">
        <div>
          <h1>AI &amp; documents</h1>
          <p className="hint">
            Upload documents (CV, project reports, certificates). They are parsed, indexed for search, and analysed to propose site updates.
            Nothing changes on the site until you apply a proposal.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={refresh}>
          <LuRefreshCw aria-hidden /> Refresh
        </button>
      </div>

      {message && (
        <p className={`admin-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {status && (
        <ul className="ai-status">
          <li>
            <Dot ok={status.rag.ok} /> <strong>RAG database</strong>
            <span className="hint">{status.rag.ok ? `${status.rag.documents} document(s)` : status.rag.error}</span>
          </li>
          <li>
            <Dot ok={status.ollama.ok && status.ollama.embedReady && status.ollama.analyzeReady} warn={status.ollama.ok} /> <strong>Ollama</strong>
            <span className="hint">
              {status.ollama.ok
                ? `${status.ollama.embedModel} ${status.ollama.embedReady ? "✓" : "missing"} · ${status.ollama.analyzeModel} ${status.ollama.analyzeReady ? "✓" : "missing"}`
                : `not reachable at ${status.ollama.url} — search falls back to keywords`}
            </span>
          </li>
          <li>
            <Dot ok={status.flowise.configured && status.flowise.reachable} warn={status.flowise.reachable} /> <strong>Flowise</strong>
            <span className="hint">
              {status.flowise.configured
                ? `analysis via chatflow at ${status.flowise.url}${status.flowise.reachable ? "" : " (not reachable)"}`
                : status.flowise.reachable
                  ? "running — create a chatflow and set FLOWISE_CHATFLOW_ID; until then analysis goes straight to Qwen"
                  : "not running — analysis goes straight to Qwen"}
            </span>
            {status.flowise.reachable && flowiseLink(status.flowise.url) && (
              <a className="btn btn-outline btn-sm" href={flowiseLink(status.flowise.url)!} target="_blank" rel="noopener noreferrer">
                Open Flowise
              </a>
            )}
          </li>
          <li>
            <Dot ok={status.chat.enabled} /> <strong>Recruiter chat</strong>
            <span className="hint">
              {status.chat.enabled ? `${status.chat.model} · up to ${status.chat.dailyLimit} questions/day` : "off — set ANTHROPIC_API_KEY to enable"}
            </span>
          </li>
          <li>
            <Dot ok /> <strong>API docs</strong>
            <span className="hint">Swagger UI for every site API route</span>
            <a className="btn btn-outline btn-sm" href="/api-docs" target="_blank" rel="noopener">
              Open Swagger
            </a>
          </li>
        </ul>
      )}

      {status?.rag.ok && (
        <>
          <section className="admin-fieldset">
            <h2>Documents</h2>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              id="ai-upload"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="admin-inline-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <LuUpload aria-hidden /> {uploading ? "Uploading…" : "Upload documents"}
              </button>
              <span className="hint">PDF, Word (.docx), .txt or .md — up to 20 MB each, 5 at a time. Documents are private by default.</span>
            </p>
            {docs.length === 0 ? (
              <p className="empty-note">No documents yet.</p>
            ) : (
              <ul className="admin-list">
                {docs.map((d) => (
                  <li key={d.id} className="doc-row">
                    <div className="admin-list-main">
                      <span className="admin-list-title">{d.title}</span>
                      <p className="hint">
                        <span className={`badge ${d.status === "error" ? "tone-amber" : d.status === "analyzed" ? "tone-green" : "tone-blue"}`}>{d.status}</span>{" "}
                        {(d.size_bytes / 1024).toFixed(0)} KB · {d.chars.toLocaleString()} characters · {d.chunks} chunks
                        {d.chunks > 0 && (d.embedded ? " · vector + keyword search" : " · keyword search only")} · {formatDate(d.created_at)}
                      </p>
                      {d.error && <p className="field-error">{d.error}</p>}
                      {d.summary && <p className="doc-summary">{d.summary}</p>}
                      {d.analyzed_chars !== null && d.analyzed_chars < d.chars && (
                        <p className="hint">Analysis used the first {d.analyzed_chars.toLocaleString()} characters of this document.</p>
                      )}
                    </div>
                    <div className="admin-list-actions">
                      <label className="checkbox-line" title="Let the public recruiter chat quote this document">
                        <input type="checkbox" checked={d.public} disabled={d.status === "processing"} onChange={() => docAction(d, "toggle")} />
                        Chatbot can use
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={d.status === "processing" || d.status === "analyzing" || d.chars === 0}
                        onClick={() => docAction(d, "analyze")}
                      >
                        <LuSparkles aria-hidden /> {d.status === "analyzing" ? "Analysing…" : "Analyze"}
                      </button>
                      <a className="icon-btn" href={`/api/admin/ai/documents/${d.id}/file`} aria-label="Download original" title="Download original">
                        <LuFileText aria-hidden />
                      </a>
                      <button type="button" className="icon-btn danger" onClick={() => docAction(d, "delete")} aria-label="Delete document">
                        <LuTrash2 aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-fieldset">
            <h2>AI Inbox — proposed site updates ({proposals.length})</h2>
            <p className="hint">
              Each proposal quotes the document it comes from; proposals whose quote is not in the document are discarded automatically. Check the
              facts before applying.
            </p>
            {proposals.length === 0 ? (
              <p className="empty-note">No pending proposals. Analyse a document to get some.</p>
            ) : (
              <ul className="proposal-list">
                {proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    p={p}
                    onDone={(text) => {
                      setMessage({ tone: "ok", text });
                      refresh();
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
