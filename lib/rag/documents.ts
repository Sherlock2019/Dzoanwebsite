import { randomUUID } from "crypto";
import { getStorage } from "@/lib/storage/index";
import { db, toVector } from "./db";
import { embed } from "./ollama";
import { chunkText, DOC_MIME, detectDocType, MAX_DOC_BYTES, parseDocument, ParseError, type DocType } from "./parse";

// Document ingestion: store the original privately, parse it to text, chunk, embed (when Ollama
// is available) and index for hybrid search. Processing runs in the background; the dashboard
// polls the status column.

export interface RagDocument {
  id: string;
  title: string;
  filename: string;
  mime: string;
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
  updated_at: string;
}

const COLUMNS =
  "id, title, filename, mime, size_bytes, public, status, error, chars, chunks, embedded, summary, analyzed_chars, created_at, updated_at";

export async function listDocuments(): Promise<RagDocument[]> {
  const { rows } = await (await db()).query(`SELECT ${COLUMNS} FROM rag_documents ORDER BY created_at DESC`);
  return rows;
}

export async function getDocument(id: string): Promise<(RagDocument & { content: string | null }) | null> {
  const { rows } = await (await db()).query(`SELECT ${COLUMNS}, content FROM rag_documents WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

const UPDATABLE = new Set(["title", "public", "status", "error", "summary", "analyzed_chars"]);

export async function setDocumentStatus(id: string, fields: Partial<Record<string, unknown>>): Promise<void> {
  const keys = Object.keys(fields).filter((k) => UPDATABLE.has(k));
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await (await db()).query(`UPDATE rag_documents SET ${sets}, updated_at = now() WHERE id = $1`, [id, ...keys.map((k) => fields[k])]);
}

function safeTitle(filename: string): string {
  return (filename.split(/[\\/]/).pop() || "document").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").slice(0, 200) || "document";
}

/** Validate and store an upload, then process it in the background. */
export async function createDocument(buf: Buffer, filename: string): Promise<RagDocument> {
  if (buf.length === 0) throw new ParseError("Empty file");
  if (buf.length > MAX_DOC_BYTES) throw new ParseError("File is larger than 20 MB");
  const type = detectDocType(buf, filename);
  if (!type) throw new ParseError("Only PDF, Word (.docx), .txt or .md files are accepted");

  const id = randomUUID();
  const key = `sources/${new Date().getUTCFullYear()}/${id}.${type}`;
  await (await getStorage()).put(key, buf, DOC_MIME[type]);

  const { rows } = await (await db()).query(
    `INSERT INTO rag_documents (id, title, filename, mime, storage_key, size_bytes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'processing') RETURNING ${COLUMNS}`,
    [id, safeTitle(filename), filename.slice(0, 250), DOC_MIME[type], key, buf.length],
  );
  void processDocument(id, buf, type);
  return rows[0];
}

async function processDocument(id: string, buf: Buffer, type: DocType): Promise<void> {
  try {
    const text = await parseDocument(buf, type);
    const chunks = chunkText(text);
    const vectors = await embed(chunks);
    const pool = await db();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM rag_chunks WHERE document_id = $1", [id]);
      for (const [i, content] of chunks.entries()) {
        await client.query("INSERT INTO rag_chunks (document_id, ord, content, embedding) VALUES ($1, $2, $3, $4)", [
          id,
          i,
          content,
          vectors ? toVector(vectors[i]) : null,
        ]);
      }
      await client.query(
        "UPDATE rag_documents SET status = 'ready', error = NULL, content = $2, chars = $3, chunks = $4, embedded = $5, updated_at = now() WHERE id = $1",
        [id, text, text.length, chunks.length, Boolean(vectors)],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof ParseError ? err.message : `Processing failed: ${(err as Error).message}`;
    await setDocumentStatus(id, { status: "error", error: message.slice(0, 500) }).catch(() => undefined);
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { rows } = await (await db()).query("DELETE FROM rag_documents WHERE id = $1 RETURNING storage_key", [id]);
  if (!rows[0]) return false;
  if (rows[0].storage_key) await (await getStorage()).remove([rows[0].storage_key]);
  return true;
}

export interface SearchHit {
  document_title: string;
  content: string;
  score: number;
}

/**
 * Hybrid retrieval over documents the owner marked "chatbot can use": vector similarity
 * (when embeddings exist) and keyword match, merged with reciprocal-rank fusion.
 */
export async function searchPublic(query: string, k = 5): Promise<SearchHit[]> {
  const pool = await db();
  const ranked = new Map<number, { hit: SearchHit; score: number }>();
  const add = (rows: { id: number; title: string; content: string }[]) =>
    rows.forEach((r, rank) => {
      const prev = ranked.get(r.id);
      const score = (prev?.score ?? 0) + 1 / (60 + rank);
      ranked.set(r.id, { hit: { document_title: r.title, content: r.content, score }, score });
    });

  const [vector] = (await embed([query])) ?? [];
  if (vector) {
    const { rows } = await pool.query(
      `SELECT c.id, d.title, c.content FROM rag_chunks c JOIN rag_documents d ON d.id = c.document_id
       WHERE d.public AND c.embedding IS NOT NULL ORDER BY c.embedding <=> $1 LIMIT 12`,
      [toVector(vector)],
    );
    add(rows);
  }
  const { rows: kw } = await pool.query(
    `SELECT c.id, d.title, c.content FROM rag_chunks c JOIN rag_documents d ON d.id = c.document_id
     WHERE d.public AND c.tsv @@ websearch_to_tsquery('simple', $1)
     ORDER BY ts_rank(c.tsv, websearch_to_tsquery('simple', $1)) DESC LIMIT 12`,
    [query],
  );
  add(kw);
  return [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.hit);
}

export async function publicDocumentCount(): Promise<number> {
  const { rows } = await (await db()).query("SELECT count(*)::int AS n FROM rag_documents WHERE public AND status IN ('ready','analyzed')");
  return rows[0]?.n ?? 0;
}
