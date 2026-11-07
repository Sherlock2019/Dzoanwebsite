// Server-only settings for the AI features. Every feature degrades gracefully when its
// service isn't configured: no RAG DB → no document ingestion; no Ollama → keyword search only;
// no Anthropic key → the public chat is hidden.

export const aiConfig = {
  ragDatabaseUrl: () => process.env.RAG_DATABASE_URL || "",
  ollamaUrl: () => (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, ""),
  embedModel: () => process.env.EMBED_MODEL || "embeddinggemma",
  /** Must match the vector column size in lib/rag/db.ts (embeddinggemma = 768). */
  embedDimensions: 768,
  analyzeModel: () => process.env.ANALYZE_MODEL || "qwen2.5:7b",
  flowiseUrl: () => (process.env.FLOWISE_URL || "").replace(/\/+$/, ""),
  flowiseChatflowId: () => process.env.FLOWISE_CHATFLOW_ID || "",
  flowiseApiKey: () => process.env.FLOWISE_API_KEY || "",
  chatModel: () => process.env.CHAT_MODEL || "claude-haiku-5-5",
  chatDailyLimit: () => Math.max(1, Number(process.env.CHAT_DAILY_LIMIT || 1000)),
};

/** AI_DISABLED=1 (set by ./startsimple.sh) turns off every AI feature: chat, documents, Flowise. */
export function aiDisabled(): boolean {
  return ["1", "true", "yes"].includes((process.env.AI_DISABLED || "").toLowerCase());
}

export function ragEnabled(): boolean {
  return !aiDisabled() && Boolean(aiConfig.ragDatabaseUrl());
}

export function flowiseEnabled(): boolean {
  return !aiDisabled() && Boolean(aiConfig.flowiseUrl() && aiConfig.flowiseChatflowId());
}

/** The public chat needs Anthropic credentials (API key or auth token) and can be switched off. */
export function chatEnabled(): boolean {
  if (aiDisabled()) return false;
  if ((process.env.CHAT_ENABLED || "true").toLowerCase() === "false") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
