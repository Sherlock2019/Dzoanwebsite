import { NextResponse } from "next/server";
import { aiConfig, chatEnabled, flowiseEnabled, ragEnabled } from "@/lib/ai/config";
import { requireOwner } from "@/lib/auth/guard";
import { db } from "@/lib/rag/db";
import { ollamaStatus } from "@/lib/rag/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function flowiseReachable(): Promise<boolean> {
  if (!aiConfig.flowiseUrl()) return false;
  try {
    const res = await fetch(`${aiConfig.flowiseUrl()}/api/v1/ping`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  let rag: { ok: boolean; documents?: number; error?: string } = { ok: false, error: "RAG_DATABASE_URL not set" };
  if (ragEnabled()) {
    try {
      const { rows } = await (await db()).query("SELECT count(*)::int AS n FROM rag_documents");
      rag = { ok: true, documents: rows[0].n };
    } catch (err) {
      rag = { ok: false, error: (err as Error).message };
    }
  }
  const [ollama, flowiseUp] = await Promise.all([ollamaStatus(), flowiseReachable()]);
  const has = (m: string) => ollama.models.some((x) => x === m || x.startsWith(`${m}:`));

  return NextResponse.json({
    rag,
    ollama: {
      ok: ollama.ok,
      url: aiConfig.ollamaUrl(),
      embedModel: aiConfig.embedModel(),
      embedReady: has(aiConfig.embedModel()),
      analyzeModel: aiConfig.analyzeModel(),
      analyzeReady: has(aiConfig.analyzeModel()),
      error: ollama.error,
    },
    flowise: { configured: flowiseEnabled(), reachable: flowiseUp, url: aiConfig.flowiseUrl() || null },
    chat: { enabled: chatEnabled(), model: aiConfig.chatModel(), dailyLimit: aiConfig.chatDailyLimit() },
  });
}
