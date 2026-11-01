import { Pool } from "pg";
import { aiConfig } from "@/lib/ai/config";

// Postgres + pgvector store for uploaded documents, their chunks and AI update proposals.
// The schema is created on first use, so a fresh database needs no manual migration.

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export function getPool(): Pool {
  const url = aiConfig.ragDatabaseUrl();
  if (!url) throw new Error("RAG_DATABASE_URL is not set");
  if (!pool) pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  return pool;
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  storage_key text,
  size_bytes integer NOT NULL DEFAULT 0,
  public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'uploaded',
  error text,
  chars integer NOT NULL DEFAULT 0,
  chunks integer NOT NULL DEFAULT 0,
  embedded boolean NOT NULL DEFAULT false,
  summary text,
  content text,
  analyzed_chars integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  ord integer NOT NULL,
  content text NOT NULL,
  embedding vector(${aiConfig.embedDimensions}),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
);
CREATE INDEX IF NOT EXISTS rag_chunks_doc_idx ON rag_chunks (document_id);
CREATE INDEX IF NOT EXISTS rag_chunks_tsv_idx ON rag_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS rag_chunks_emb_idx ON rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS ai_proposals (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES rag_documents(id) ON DELETE SET NULL,
  document_title text,
  kind text NOT NULL,
  target_id text,
  target_label text,
  field text,
  current_value text,
  proposed jsonb NOT NULL,
  reason text,
  evidence text,
  status text NOT NULL DEFAULT 'pending',
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_proposals_status_idx ON ai_proposals (status, created_at DESC);
`;

/** Pool with the schema guaranteed to exist. */
export async function db(): Promise<Pool> {
  const p = getPool();
  if (!ready) {
    ready = p.query(SCHEMA).then(() => undefined);
    ready.catch(() => (ready = null)); // retry on the next call if the DB wasn't up yet
  }
  await ready;
  return p;
}

/** pgvector literal for a JS number array. */
export function toVector(values: number[]): string {
  return `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}
