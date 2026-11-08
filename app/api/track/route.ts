import { BOT_UA, recordEvents, trackPayload } from "@/lib/analytics";
import { getOwnerSession, isSameOrigin } from "@/lib/auth/guard";
import { clientId } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public beacon endpoint for the visitor tracker (components/layout/Tracker.tsx).
// Always answers 204 for ignored traffic so the browser has nothing to retry.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

function limited(id: string, now = Date.now()) {
  const list = (hits.get(id) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(id, list);
  if (hits.size > 10_000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

const done = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return done();
  const ip = clientId(req);
  if (limited(ip)) return new Response(null, { status: 429 });
  if (await getOwnerSession()) return done(); // don't count the owner's own visits

  const text = await req.text();
  if (text.length > 64_000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = trackPayload.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  await recordEvents(parsed.data, { ip, ua, headers: req.headers });
  return done();
}
