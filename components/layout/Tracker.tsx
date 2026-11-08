"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Cookie-free visitor tracker. Records page views, clicks (for the heatmap), time spent per
 * section, scroll depth and which documents were opened, and sends them to /api/track in small
 * batches. A `?r=<name>` tracking link tags the visit (remembered on that browser), then the tag
 * is removed from the address bar. Nothing runs inside an iframe (the admin heatmap preview).
 */

const ENDPOINT = "/api/track";
const IDLE_MS = 60_000; // stop counting time after a minute with no scroll, mouse or key activity

interface Page {
  path: string;
  dur: number;
  depth: number;
  secs: Record<string, number>;
  dirty: boolean;
}

interface State {
  sid: string;
  ref: string;
  src: string;
  queue: object[];
  page: Page | null;
  lastActive: number;
}

let state: State | null = null;

function storage(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function get(s: Storage | null, k: string) {
  try {
    return s?.getItem(k) || "";
  } catch {
    return "";
  }
}

function set(s: Storage | null, k: string, v: string) {
  try {
    s?.setItem(k, v);
  } catch {
    // private mode or blocked storage: the visit is still counted, just not linked across pages
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/** A CSS path from the nearest element with an id, so a click maps back to the same element. */
function selectorFor(start: Element): string {
  const parts: string[] = [];
  let node: Element | null = start;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      return parts.join(">");
    }
    const parent: Element | null = node.parentElement;
    if (!parent || parts.length >= 25) return "";
    const tag = node.tagName.toLowerCase();
    const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
    node = parent;
  }
  parts.unshift("body");
  return parts.join(">");
}

function send(payload: string) {
  try {
    const blob = new Blob([payload], { type: "text/plain" });
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return;
  } catch {
    // fall through to fetch
  }
  fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
}

function snapshot() {
  const s = state;
  const p = s?.page;
  if (!s || !p || !p.dirty) return;
  p.dirty = false;
  s.queue.push({ t: "stat", path: p.path, dur: p.dur, depth: p.depth, secs: p.secs });
}

function flush() {
  const s = state;
  if (!s || !s.queue.length) return;
  const events = s.queue.splice(0, 100);
  send(JSON.stringify({ sid: s.sid, ref: s.ref, src: s.src, w: window.innerWidth, events }));
  if (s.queue.length) flush();
}

function init(): State {
  const session = storage("session");
  const local = storage("local");
  let sid = get(session, "pf_sid");
  if (!/^[a-z0-9]{8,32}$/.test(sid)) {
    sid = randomId();
    set(session, "pf_sid", sid);
  }

  const url = new URL(window.location.href);
  let ref = (url.searchParams.get("r") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  if (ref) {
    set(local, "pf_ref", ref);
    url.searchParams.delete("r");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } else {
    ref = get(local, "pf_ref").replace(/[^a-z0-9-]/g, "");
  }

  let src = get(session, "pf_src");
  if (!src) {
    const utm = url.searchParams.get("utm_source");
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      src = utm || (r && r.host !== window.location.host ? r.host.replace(/^www\./, "") : "");
    } catch {
      src = utm || "";
    }
    if (src) set(session, "pf_src", src.slice(0, 100));
  }

  const s: State = { sid, ref, src: src.slice(0, 100), queue: [], page: null, lastActive: Date.now() };

  const active = () => (s.lastActive = Date.now());
  const measureDepth = () => {
    const p = s.page;
    if (!p) return;
    const doc = document.documentElement;
    const depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight)) * 100));
    if (depth > p.depth) {
      p.depth = depth;
      p.dirty = true;
    }
  };
  window.addEventListener("scroll", () => {
    active();
    measureDepth();
  }, { passive: true });
  for (const ev of ["mousemove", "keydown", "touchstart", "wheel"]) window.addEventListener(ev, active, { passive: true });

  document.addEventListener(
    "click",
    (e) => {
      active();
      const p = s.page;
      const target = e.target instanceof Element ? e.target : null;
      if (!p || !target) return;
      const el = target.closest("svg") || target;
      const rect = el.getBoundingClientRect();
      const link = target.closest("a");
      let href = "";
      if (link) {
        try {
          const u = new URL(link.href, window.location.href);
          href = u.host === window.location.host ? u.pathname + u.search : u.host + u.pathname;
        } catch {
          href = "";
        }
      }
      const label = link ? (link.textContent || link.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim() : "";
      const unit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
      s.queue.push({
        t: "click",
        path: p.path,
        x: Math.round(e.pageX),
        y: Math.round(e.pageY),
        sel: selectorFor(el),
        ox: unit((e.clientX - rect.left) / rect.width),
        oy: unit((e.clientY - rect.top) / rect.height),
        href: href.slice(0, 200),
        label: label.slice(0, 80),
      });
      if (link) {
        snapshot();
        flush();
      }
    },
    { capture: true, passive: true },
  );

  // Once a second: count visible, active time, and credit it to the section filling most of the screen.
  window.setInterval(() => {
    const p = s.page;
    if (!p || document.visibilityState !== "visible" || Date.now() - s.lastActive > IDLE_MS) return;
    p.dur++;
    p.dirty = true;
    let best: string | null = null;
    let bestH = 0;
    document.querySelectorAll("main section[id]").forEach((sec) => {
      const r = sec.getBoundingClientRect();
      const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (h > bestH) {
        bestH = h;
        best = sec.id;
      }
    });
    if (best) p.secs[best] = (p.secs[best] || 0) + 1;
    measureDepth();
  }, 1000);

  window.setInterval(() => {
    snapshot();
    flush();
  }, 20_000);

  const leave = () => {
    snapshot();
    flush();
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && leave());
  window.addEventListener("pagehide", leave);
  return s;
}

function viewPage(path: string) {
  if (!state) state = init();
  if (state.page?.path === path) return;
  snapshot();
  state.page = { path, dur: 0, depth: 0, secs: {}, dirty: false };
  state.queue.push({ t: "view", path });
  flush();
}

export default function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.self !== window.top) return;
    if (/bot|crawl|spider|headless/i.test(navigator.userAgent)) return;
    viewPage(pathname || "/");
  }, [pathname]);
  return null;
}
