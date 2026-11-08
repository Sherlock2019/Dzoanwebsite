import { createHash, createHmac } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { dataDir } from "@/lib/config";

// Self-hosted, cookie-free visitor analytics and click heatmaps.
// Events are appended as JSON lines to .data/analytics/YYYY-MM.jsonl. That folder is git-ignored:
// visitor data never goes to GitHub. No IP address is stored; unique visitors are counted with a
// hash of IP + browser that uses a salt which changes every day, so it can't be traced back.

export type Device = "desktop" | "tablet" | "mobile";

interface Common {
  ts: number;
  sid: string;
  path: string;
}
export interface ViewEvent extends Common {
  t: "view";
  vid: string;
  ref: string;
  src: string;
  dev: Device;
  cc: string;
  lang: string;
}
export interface ClickEvent extends Common {
  t: "click";
  dev: Device;
  w: number;
  x: number;
  y: number;
  sel: string;
  ox: number;
  oy: number;
  href: string;
  label: string;
}
export interface StatEvent extends Common {
  t: "stat";
  dur: number;
  depth: number;
  secs: Record<string, number>;
}
export type AnalyticsEvent = ViewEvent | ClickEvent | StatEvent;

const MAX_FILE_BYTES = 100 * 1024 * 1024; // per month; stops a flood from filling the disk
export const BOT_UA = /bot|crawl|spider|slurp|headless|preview|scrape|curl|wget|python|go-http|java\/|axios|node-fetch|lighthouse|monitor|uptime/i;

const clean = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max));
const pagePath = z.string().max(300).regex(/^\/[^\s]*$/).transform((s) => s.slice(0, 200));
const unit = z.number().finite().min(0).max(1);
const px = z.number().finite().min(-1000).max(200_000).transform(Math.round);

export const trackPayload = z.object({
  sid: z.string().regex(/^[a-z0-9]{8,32}$/),
  ref: z.string().max(60).regex(/^[a-z0-9-]*$/).default(""),
  src: clean(100).default(""),
  w: z.number().int().min(0).max(20_000),
  events: z
    .array(
      z.discriminatedUnion("t", [
        z.object({ t: z.literal("view"), path: pagePath }),
        z.object({
          t: z.literal("click"),
          path: pagePath,
          x: px,
          y: px,
          sel: z.string().max(400).default(""),
          ox: unit,
          oy: unit,
          href: clean(200).default(""),
          label: clean(80).default(""),
        }),
        z.object({
          t: z.literal("stat"),
          path: pagePath,
          dur: z.number().int().min(0).max(24 * 3600),
          depth: z.number().int().min(0).max(100),
          secs: z.record(z.string().regex(/^[a-z0-9-]{1,60}$/i), z.number().int().min(0).max(24 * 3600)).default({}),
        }),
      ]),
    )
    .min(1)
    .max(100),
});
export type TrackPayload = z.infer<typeof trackPayload>;

export function deviceFor(width: number): Device {
  if (width && width < 768) return "mobile";
  if (width && width < 1024) return "tablet";
  return "desktop";
}

function dir() {
  return path.join(dataDir(), "analytics");
}

function monthKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 7);
}

function visitorId(ip: string, ua: string, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const salt = createHmac("sha256", process.env.SESSION_SECRET || "portfolio-analytics").update(day).digest();
  return createHash("sha256").update(salt).update(`${ip}|${ua}`).digest("base64url").slice(0, 16);
}

function country(headers: Headers): string {
  for (const h of ["cf-ipcountry", "cloudfront-viewer-country", "x-vercel-ip-country", "x-country-code"]) {
    const v = (headers.get(h) || "").toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX") return v;
  }
  return "";
}

export async function recordEvents(p: TrackPayload, req: { ip: string; ua: string; headers: Headers }) {
  const ts = Date.now();
  const dev = deviceFor(p.w);
  const lang = ((req.headers.get("accept-language") || "").split(",")[0] || "").trim().slice(0, 20);
  const lines = p.events.map((e) => {
    const base = { ts, sid: p.sid, path: e.path };
    if (e.t === "view") {
      return { ...base, t: "view", vid: visitorId(req.ip, req.ua, ts), ref: p.ref, src: p.src, dev, cc: country(req.headers), lang: /^[a-zA-Z-]+$/.test(lang) ? lang : "" };
    }
    if (e.t === "click") return { ...base, ...e, dev, w: p.w };
    return { ...base, ...e };
  });
  await fs.mkdir(dir(), { recursive: true });
  const file = path.join(dir(), `${monthKey(ts)}.jsonl`);
  const size = await fs.stat(file).then((s) => s.size, () => 0);
  if (size > MAX_FILE_BYTES) return;
  await fs.appendFile(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

export async function readEvents(since: number): Promise<AnalyticsEvent[]> {
  const months: string[] = [];
  for (let d = new Date(since); d.getTime() <= Date.now() + 86_400_000; d.setUTCMonth(d.getUTCMonth() + 1, 1)) {
    months.push(monthKey(d.getTime()));
  }
  const out: AnalyticsEvent[] = [];
  for (const m of [...new Set(months)]) {
    const text = await fs.readFile(path.join(dir(), `${m}.jsonl`), "utf8").catch(() => "");
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line) as AnalyticsEvent;
        if (e.ts >= since) out.push(e);
      } catch {
        // skip a torn line
      }
    }
  }
  return out;
}

/**
 * Unique visitors today and over the last 7 and 30 days (shown in the admin side panel).
 * A visitor id changes daily, so multi-day totals count a returning visitor once per day.
 */
export async function visitorCounts(now = Date.now()) {
  const dayMs = 86_400_000;
  const startOfToday = Math.floor(now / dayMs) * dayMs;
  const events = await readEvents(startOfToday - 29 * dayMs).catch(() => []);
  const today = new Set<string>();
  const week = new Set<string>();
  const month = new Set<string>();
  for (const e of events) {
    if (e.t !== "view") continue;
    month.add(e.vid);
    if (e.ts >= startOfToday - 6 * dayMs) week.add(e.vid);
    if (e.ts >= startOfToday) today.add(e.vid);
  }
  return { today: today.size, week: week.size, month: month.size };
}
export type VisitorCounts = Awaited<ReturnType<typeof visitorCounts>>;

// ---------- report ----------

export interface SessionRow {
  sid: string;
  start: number;
  end: number;
  ref: string;
  src: string;
  dev: Device;
  where: string;
  pages: string[];
  dur: number;
  depth: number;
  secs: Record<string, number>;
  files: string[];
  clicks: number;
}

export interface HeatClick {
  path: string;
  dev: Device;
  w: number;
  x: number;
  y: number;
  sel: string;
  ox: number;
  oy: number;
}

type Count = { key: string; n: number };

function topCounts(values: string[], limit = 10): Count[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n).slice(0, limit);
}

const FILE_HREF = /^\/media\/.+\.(pdf|docx)(\?|$)/i;

export function buildReport(events: AnalyticsEvent[], days: number, now = Date.now()) {
  const sessions = new Map<string, SessionRow>();
  const stats = new Map<string, StatEvent>(); // latest (largest) snapshot per session + page
  const vids = new Set<string>();
  const clicks: HeatClick[] = [];
  let pageviews = 0;
  const pageViews: string[] = [];

  const row = (e: AnalyticsEvent) => {
    let s = sessions.get(e.sid);
    if (!s) {
      s = { sid: e.sid, start: e.ts, end: e.ts, ref: "", src: "", dev: "desktop", where: "", pages: [], dur: 0, depth: 0, secs: {}, files: [], clicks: 0 };
      sessions.set(e.sid, s);
    }
    s.start = Math.min(s.start, e.ts);
    s.end = Math.max(s.end, e.ts);
    return s;
  };

  for (const e of events) {
    if (e.t === "view") {
      const s = row(e);
      pageviews++;
      pageViews.push(e.path);
      vids.add(e.vid);
      if (!s.pages.includes(e.path)) s.pages.push(e.path);
      if (e.ref && !s.ref) s.ref = e.ref;
      if (e.src && !s.src) s.src = e.src;
      s.dev = e.dev;
      if (!s.where) s.where = e.cc || e.lang;
    } else if (e.t === "click") {
      const s = row(e);
      s.clicks++;
      if (FILE_HREF.test(e.href)) {
        const label = e.label || decodeURIComponent(e.href.split("/").pop() || "").split("?")[0];
        if (!s.files.includes(label)) s.files.push(label);
      }
      clicks.push({ path: e.path, dev: e.dev, w: e.w, x: e.x, y: e.y, sel: e.sel, ox: e.ox, oy: e.oy });
    } else if (e.t === "stat") {
      row(e);
      const k = `${e.sid} ${e.path}`;
      const prev = stats.get(k);
      if (!prev || e.dur >= prev.dur) stats.set(k, e);
    }
  }

  for (const st of stats.values()) {
    const s = sessions.get(st.sid);
    if (!s) continue;
    s.dur += st.dur;
    if (st.path === "/") s.depth = Math.max(s.depth, st.depth);
    for (const [id, n] of Object.entries(st.secs)) s.secs[id] = (s.secs[id] || 0) + n;
  }

  // Sessions without a page view are only stat/click fragments from an earlier day; drop them.
  const all = [...sessions.values()].filter((s) => s.pages.length).sort((a, b) => b.start - a.start);

  const dayMs = 86_400_000;
  const today = Math.floor(now / dayMs);
  const daily = Array.from({ length: days }, (_, i) => {
    const d = today - (days - 1 - i);
    return { day: new Date(d * dayMs).toISOString().slice(0, 10), n: 0 };
  });
  for (const s of all) {
    const i = Math.floor(s.start / dayMs) - (today - (days - 1));
    if (i >= 0 && i < days) daily[i].n++;
  }

  const refs = new Map<string, { ref: string; visits: number; first: number; last: number; dur: number; files: Set<string>; secs: Record<string, number> }>();
  for (const s of all) {
    if (!s.ref) continue;
    const r = refs.get(s.ref) || { ref: s.ref, visits: 0, first: s.start, last: s.start, dur: 0, files: new Set<string>(), secs: {} };
    r.visits++;
    r.first = Math.min(r.first, s.start);
    r.last = Math.max(r.last, s.start);
    r.dur += s.dur;
    s.files.forEach((f) => r.files.add(f));
    for (const [id, n] of Object.entries(s.secs)) r.secs[id] = (r.secs[id] || 0) + n;
    refs.set(s.ref, r);
  }

  const home = all.filter((s) => s.pages.includes("/"));
  const sectionIds = new Set(home.flatMap((s) => Object.keys(s.secs)));
  const sections = [...sectionIds]
    .map((id) => {
      const readers = home.filter((s) => (s.secs[id] || 0) >= 2);
      const total = readers.reduce((a, s) => a + s.secs[id], 0);
      return { id, reach: home.length ? readers.length / home.length : 0, avg: readers.length ? total / readers.length : 0 };
    })
    .sort((a, b) => b.reach - a.reach);

  const withTime = all.filter((s) => s.dur > 0);
  return {
    days,
    totals: {
      visits: all.length,
      visitors: vids.size,
      pageviews,
      avgDur: withTime.length ? withTime.reduce((a, s) => a + s.dur, 0) / withTime.length : 0,
      fileOpens: all.reduce((a, s) => a + s.files.length, 0),
    },
    daily,
    refs: [...refs.values()].sort((a, b) => b.last - a.last).map((r) => ({ ...r, files: [...r.files] })),
    sources: topCounts(all.map((s) => s.src || "Direct / unknown")),
    places: topCounts(all.map((s) => s.where || "Unknown")),
    devices: topCounts(all.map((s) => s.dev)),
    pages: topCounts(pageViews),
    files: topCounts(all.flatMap((s) => s.files)),
    sections,
    recent: all.slice(0, 50),
    clicks: clicks.slice(-5000),
  };
}
export type AnalyticsReport = ReturnType<typeof buildReport>;
