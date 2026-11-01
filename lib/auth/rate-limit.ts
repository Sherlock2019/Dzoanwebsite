// In-memory sign-in throttle: 5 failures per client per 15 minutes. Good enough for a single
// owner on one server instance; put a WAF/edge rate limit in front for multi-instance hosting.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function recent(id: string, now: number): number[] {
  const list = (failures.get(id) || []).filter((t) => now - t < WINDOW_MS);
  failures.set(id, list);
  return list;
}

export function isLocked(id: string, now = Date.now()): boolean {
  return recent(id, now).length >= MAX_FAILURES;
}

export function recordFailure(id: string, now = Date.now()): void {
  recent(id, now).push(now);
}

export function clearFailures(id: string): void {
  failures.delete(id);
}

export function clientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) || "local";
}
