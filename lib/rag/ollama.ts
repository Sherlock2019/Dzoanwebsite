import { aiConfig } from "@/lib/ai/config";

// Thin client for the local Ollama server: embeddings (embeddinggemma) and JSON chat (Qwen).

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(`${aiConfig.ollamaUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama ${path} → ${res.status} ${await res.text().catch(() => "")}`.trim());
  return (await res.json()) as T;
}

/** Embeddings for a batch of texts, or null when Ollama/the model isn't available. */
export async function embed(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  try {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const r = await post<{ embeddings: number[][] }>(
        "/api/embed",
        { model: aiConfig.embedModel(), input: texts.slice(i, i + 32) },
        120_000,
      );
      out.push(...r.embeddings);
    }
    if (out.some((v) => v.length !== aiConfig.embedDimensions)) {
      console.warn(`[rag] ${aiConfig.embedModel()} returned vectors that are not ${aiConfig.embedDimensions}-dimensional; using keyword search only`);
      return null;
    }
    return out;
  } catch (err) {
    console.warn(`[rag] embeddings unavailable: ${(err as Error).message}`);
    return null;
  }
}

/** One JSON-mode chat completion with a local model (used for document analysis). */
export async function chatJson(system: string, user: string, model = aiConfig.analyzeModel()): Promise<string> {
  const r = await post<{ message: { content: string } }>(
    "/api/chat",
    {
      model,
      stream: false,
      format: "json",
      // Ollama defaults to a 2k context, far too small for a document.
      options: { num_ctx: 16384, temperature: 0.2 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    600_000,
  );
  return r.message.content;
}

export async function ollamaStatus(): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch(`${aiConfig.ollamaUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = (await res.json()) as { models?: { name: string }[] };
    return { ok: res.ok, models: (data.models || []).map((m) => m.name) };
  } catch (err) {
    return { ok: false, models: [], error: (err as Error).message };
  }
}
