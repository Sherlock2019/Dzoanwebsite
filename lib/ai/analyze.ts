import { aiConfig, flowiseEnabled } from "@/lib/ai/config";
import { getProfile } from "@/lib/content";
import { getRepo } from "@/lib/db/index";
import { getDocument, setDocumentStatus } from "@/lib/rag/documents";
import { chatJson } from "@/lib/rag/ollama";
import { evidenceFound, PROFILE_FIELDS, PROJECT_FIELDS, proposalSchema, saveProposals, type ProposalInput } from "./proposals";

// Document analysis: compare an uploaded document with the current site and propose updates.
// Orchestrated by a Flowise chatflow when FLOWISE_* is configured, otherwise sent straight to
// the local Qwen model through Ollama. Runs in the background; status is on the document row.

/** Characters of the document sent to the model (Qwen is run with a 16k-token context). */
export const ANALYZE_CHAR_LIMIT = 32_000;

const SYSTEM = `You help the owner of a personal portfolio website keep it accurate and up to date.
You receive the CURRENT SITE (what the website says now) and a DOCUMENT the owner uploaded (for example a CV, a project report or a certificate).
Propose specific website updates that the DOCUMENT supports.

Rules:
- Use only facts stated in the DOCUMENT. Never invent employers, dates, numbers, titles, certifications or results.
- Every proposal needs "evidence": a short quote copied exactly, word for word, from the DOCUMENT (10 to 300 characters).
- Skip anything the CURRENT SITE already says. Prefer a few high-value proposals; at most 8.
- Profile text is written in the first person ("I ..."), in plain professional English.
- Keep delivery stages honest: do not call a proof of concept "production".
- Only use target_id values that appear in the CURRENT SITE.

Return only JSON in this shape:
{"summary": "two or three sentences about what the document contains",
 "proposals": [ ... ]}

Each proposal is one of:
{"kind":"profile_field","field":<one of ${PROFILE_FIELDS.join(", ")}>,"value":"new full text","reason":"why","evidence":"exact quote"}
{"kind":"project_update","target_id":"<project id>","field":<one of ${PROJECT_FIELDS.join(", ")}>,"value":"new full text (technologies: array of strings)","reason":"...","evidence":"..."}
{"kind":"project_new","value":{"title":"...","subtitle":"...","summary":"...","implementation":"- bullet\\n- bullet","technologies":["..."],"status":"POC|MVP|Production|Public demo|Internal tool|Personal project"},"reason":"...","evidence":"..."}
{"kind":"experience_new","value":{"company":"...","role":"...","start":"MM/YYYY","end":"MM/YYYY or Present","location":"...","bullets":["..."]},"reason":"...","evidence":"..."}
{"kind":"certification_new","value":{"title":"...","issuer":"...","kind":"Certification|Course|Training|Education","year":"..."},"reason":"...","evidence":"..."}
{"kind":"skill_add","target_id":"<skill category id>","value":["new item", "..."],"reason":"...","evidence":"..."}`;

async function siteSnapshot(): Promise<string> {
  const repo = await getRepo();
  const [profile, projects, experience, skills, certs] = await Promise.all([
    getProfile(),
    repo.list("projects"),
    repo.list("experience"),
    repo.list("skills"),
    repo.list("certifications"),
  ]);
  const snapshot = {
    profile: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, profile[f]])),
    projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status, summary: p.summary, technologies: p.technologies })),
    experience: experience.map((e) => ({ company: e.company, role: e.role, start: e.start, end: e.end })),
    skill_categories: skills.map((s) => ({ id: s.id, title: s.title, items: s.items })),
    certifications: certs.map((c) => `${c.title} (${c.kind}${c.issuer ? `, ${c.issuer}` : ""})`),
  };
  return JSON.stringify(snapshot);
}

async function callFlowise(prompt: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (aiConfig.flowiseApiKey()) headers.Authorization = `Bearer ${aiConfig.flowiseApiKey()}`;
  const res = await fetch(`${aiConfig.flowiseUrl()}/api/v1/prediction/${encodeURIComponent(aiConfig.flowiseChatflowId())}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: prompt }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) throw new Error(`Flowise → ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string; json?: unknown };
  return data.json ? JSON.stringify(data.json) : data.text || "";
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export interface AnalyzeResult {
  summary: string;
  saved: number;
  discarded: number;
  analyzedChars: number;
  engine: "flowise" | "ollama";
}

export async function analyzeDocument(id: string): Promise<AnalyzeResult> {
  const doc = await getDocument(id);
  if (!doc) throw new Error("Document not found");
  if (!doc.content) throw new Error("The document has not been processed yet");

  const text = doc.content.slice(0, ANALYZE_CHAR_LIMIT);
  const user = `CURRENT SITE:\n${await siteSnapshot()}\n\nDOCUMENT (${doc.title}${
    doc.content.length > text.length ? `, first ${text.length} of ${doc.content.length} characters` : ""
  }):\n"""\n${text}\n"""`;

  const engine = flowiseEnabled() ? "flowise" : "ollama";
  const raw = engine === "flowise" ? await callFlowise(`${SYSTEM}\n\n${user}`) : await chatJson(SYSTEM, user);
  const parsed = extractJson(raw) as { summary?: unknown; proposals?: unknown };

  const candidates = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  const valid: ProposalInput[] = [];
  let discarded = 0;
  for (const c of candidates.slice(0, 12)) {
    const r = proposalSchema.safeParse(c);
    // Drop anything malformed or whose quote is not actually in the document.
    if (r.success && evidenceFound(r.data.evidence, doc.content)) valid.push(r.data);
    else discarded++;
  }
  const saved = await saveProposals(doc.id, doc.title, valid);
  discarded += valid.length - saved;
  const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 1500) : "";
  return { summary, saved, discarded, analyzedChars: text.length, engine };
}

/** Run analysis in the background and record the outcome on the document. */
export function startAnalysis(id: string): void {
  void (async () => {
    try {
      await setDocumentStatus(id, { status: "analyzing", error: null });
      const r = await analyzeDocument(id);
      const note = `${r.saved} proposal(s) via ${r.engine === "flowise" ? "Flowise" : "Qwen (Ollama)"}${
        r.discarded ? `; ${r.discarded} discarded (quote not found in the document or invalid)` : ""
      }.`;
      await setDocumentStatus(id, { status: "analyzed", summary: `${r.summary}\n\n${note}`.trim(), analyzed_chars: r.analyzedChars });
    } catch (err) {
      // The document itself is still fine and searchable; only the analysis failed.
      await setDocumentStatus(id, { status: "ready", error: `Analysis failed: ${(err as Error).message}`.slice(0, 500) });
    }
  })();
}
