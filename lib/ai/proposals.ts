import { randomUUID } from "crypto";
import { z } from "zod";
import { createEntity, getProfile, saveProfile, updateEntity } from "@/lib/content";
import { getRepo } from "@/lib/db/index";
import { CERT_KINDS, PROJECT_STATUSES } from "@/lib/options";
import { db } from "@/lib/rag/db";
import { profileSchema } from "@/lib/validation";

// AI-proposed website updates. Nothing is applied until the owner approves it in the dashboard;
// new items are created as drafts, and every apply goes through the normal validation.

export const PROFILE_FIELDS = ["about", "bio", "headline", "tagline", "mission", "languages", "focus", "location", "approach"] as const;
export const PROJECT_FIELDS = ["summary", "problem", "role", "implementation", "outcomes", "technologies"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const reasonEvidence = { reason: z.string().trim().max(600).default(""), evidence: z.string().trim().max(600).default("") };

export const proposalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("profile_field"), field: z.enum(PROFILE_FIELDS), value: text(6000), ...reasonEvidence }),
  z.object({
    kind: z.literal("project_update"),
    target_id: text(80),
    field: z.enum(PROJECT_FIELDS),
    value: z.union([text(8000), z.array(text(80)).min(1).max(40)]),
    ...reasonEvidence,
  }),
  z.object({
    kind: z.literal("project_new"),
    value: z.object({
      title: text(150),
      subtitle: z.string().trim().max(200).optional(),
      summary: text(1200),
      implementation: z.string().trim().max(8000).optional(),
      technologies: z.array(text(60)).max(40).optional(),
      status: z.string().optional(),
    }),
    ...reasonEvidence,
  }),
  z.object({
    kind: z.literal("experience_new"),
    value: z.object({
      company: text(150),
      role: z.string().trim().max(200).optional(),
      start: z.string().trim().max(30).optional(),
      end: z.string().trim().max(30).optional(),
      location: z.string().trim().max(120).optional(),
      bullets: z.array(text(800)).max(15).optional(),
    }),
    ...reasonEvidence,
  }),
  z.object({
    kind: z.literal("certification_new"),
    value: z.object({
      title: text(250),
      issuer: z.string().trim().max(200).optional(),
      kind: z.string().optional(),
      year: z.string().trim().max(20).optional(),
    }),
    ...reasonEvidence,
  }),
  z.object({ kind: z.literal("skill_add"), target_id: text(80), value: z.array(text(120)).min(1).max(30), ...reasonEvidence }),
]);

export type ProposalInput = z.infer<typeof proposalSchema>;

export interface StoredProposal {
  id: string;
  document_id: string | null;
  document_title: string | null;
  kind: ProposalInput["kind"];
  target_id: string | null;
  target_label: string | null;
  field: string | null;
  current_value: string | null;
  proposed: unknown;
  reason: string | null;
  evidence: string | null;
  status: "pending" | "applied" | "rejected";
  result: string | null;
  created_at: string;
}

// ------------------------------------------------------------------ evidence check

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’“”"'`«»]/g, "")
    .replace(/[^\p{L}\p{N}%$€£.,:;/()+\-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quote (or each "…"-separated part of it) appears verbatim in the document. */
export function evidenceFound(evidence: string, documentText: string): boolean {
  const doc = normalize(documentText);
  const parts = evidence
    .split(/\.{3}|…/)
    .map(normalize)
    .filter((p) => p.length > 0);
  if (!parts.length || parts.join(" ").length < 12) return false;
  return parts.every((p) => p.length < 6 || doc.includes(p));
}

// ------------------------------------------------------------------ storage

export async function listProposals(status: "pending" | "all" = "pending"): Promise<StoredProposal[]> {
  const pool = await db();
  const { rows } =
    status === "pending"
      ? await pool.query("SELECT * FROM ai_proposals WHERE status = 'pending' ORDER BY created_at DESC")
      : await pool.query("SELECT * FROM ai_proposals ORDER BY created_at DESC LIMIT 200");
  return rows;
}

/** Describe the current value of what a proposal would change (shown next to the proposal). */
async function currentOf(p: ProposalInput): Promise<{ label: string | null; current: string | null }> {
  const repo = await getRepo();
  if (p.kind === "profile_field") {
    const profile = await getProfile();
    return { label: `Profile · ${p.field}`, current: String(profile[p.field] ?? "") };
  }
  if (p.kind === "project_update") {
    const project = await repo.get("projects", p.target_id);
    if (!project) return { label: null, current: null };
    const value = project[p.field];
    return { label: `${project.title} · ${p.field}`, current: Array.isArray(value) ? value.join(", ") : String(value ?? "") };
  }
  if (p.kind === "skill_add") {
    const cat = await repo.get("skills", p.target_id);
    return { label: cat ? `Skills · ${cat.title}` : null, current: cat ? cat.items.join("\n") : null };
  }
  return { label: null, current: null };
}

export async function saveProposals(
  documentId: string,
  documentTitle: string,
  proposals: ProposalInput[],
): Promise<number> {
  const pool = await db();
  let saved = 0;
  for (const p of proposals) {
    const { label, current } = await currentOf(p);
    // Updates must point at something that exists.
    if ((p.kind === "project_update" || p.kind === "skill_add") && label === null) continue;
    await pool.query(
      `INSERT INTO ai_proposals (id, document_id, document_title, kind, target_id, target_label, field, current_value, proposed, reason, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        randomUUID(),
        documentId,
        documentTitle,
        p.kind,
        "target_id" in p ? p.target_id : null,
        label,
        "field" in p ? p.field : null,
        current,
        JSON.stringify(p.value),
        p.reason,
        p.evidence,
      ],
    );
    saved++;
  }
  return saved;
}

export async function rejectProposal(id: string): Promise<boolean> {
  const { rowCount } = await (await db()).query(
    "UPDATE ai_proposals SET status = 'rejected', decided_at = now() WHERE id = $1 AND status = 'pending'",
    [id],
  );
  return Boolean(rowCount);
}

// ------------------------------------------------------------------ apply

export class ApplyError extends Error {}

/** Apply a pending proposal, optionally with an owner-edited value. Returns a result message. */
export async function applyProposal(id: string, editedValue?: unknown): Promise<string> {
  const pool = await db();
  const { rows } = await pool.query("SELECT * FROM ai_proposals WHERE id = $1", [id]);
  const row = rows[0] as StoredProposal | undefined;
  if (!row) throw new ApplyError("Proposal not found");
  if (row.status !== "pending") throw new ApplyError(`Proposal already ${row.status}`);

  const parsed = proposalSchema.safeParse({
    kind: row.kind,
    target_id: row.target_id ?? undefined,
    field: row.field ?? undefined,
    value: editedValue === undefined ? row.proposed : editedValue,
  });
  if (!parsed.success) throw new ApplyError(`Invalid value: ${parsed.error.issues[0]?.message ?? "check the edit"}`);
  const p = parsed.data;
  const repo = await getRepo();
  let result: string;

  switch (p.kind) {
    case "profile_field": {
      const profile = await getProfile();
      const next = profileSchema.parse({ ...profile, [p.field]: p.value });
      await saveProfile(next);
      result = `Profile “${p.field}” updated — live on the site.`;
      break;
    }
    case "project_update": {
      const project = await repo.get("projects", p.target_id);
      if (!project) throw new ApplyError("That project no longer exists");
      const value =
        p.field === "technologies"
          ? Array.isArray(p.value)
            ? p.value
            : p.value.split(",").map((s) => s.trim()).filter(Boolean)
          : Array.isArray(p.value)
            ? p.value.join(", ")
            : p.value;
      await updateEntity("projects", project.id, { ...project, [p.field]: value });
      result = `“${project.title}” ${p.field} updated${project.visibility === "published" ? " — live on the site" : ""}.`;
      break;
    }
    case "project_new": {
      const status = (PROJECT_STATUSES as readonly string[]).includes(p.value.status || "") ? p.value.status : "POC";
      const created = await createEntity("projects", { ...p.value, status, visibility: "draft" });
      result = `New project “${created.title}” created as a draft.`;
      break;
    }
    case "experience_new": {
      const created = await createEntity("experience", { ...p.value, visibility: "draft" });
      result = `New role at “${created.company}” created as a draft.`;
      break;
    }
    case "certification_new": {
      const kind = (CERT_KINDS as readonly string[]).includes(p.value.kind || "") ? p.value.kind : "Course";
      const created = await createEntity("certifications", { ...p.value, kind, status: "Completed", visibility: "draft" });
      result = `New entry “${created.title}” created as a draft — check whether it is a certification or a course.`;
      break;
    }
    case "skill_add": {
      const cat = await repo.get("skills", p.target_id);
      if (!cat) throw new ApplyError("That skill category no longer exists");
      const items = [...cat.items, ...p.value.filter((v) => !cat.items.includes(v))];
      await updateEntity("skills", cat.id, { ...cat, items });
      result = `Added ${items.length - cat.items.length} item(s) to “${cat.title}”.`;
      break;
    }
  }

  await pool.query("UPDATE ai_proposals SET status = 'applied', decided_at = now(), result = $2, proposed = $3 WHERE id = $1", [
    id,
    result,
    JSON.stringify(p.value),
  ]);
  return result;
}
