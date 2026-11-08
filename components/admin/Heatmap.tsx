"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Click heatmap: loads the live page in a same-origin iframe and paints a heat layer inside it,
 * so it scrolls with the page. Each click is placed on the element that was clicked (CSS path +
 * offset inside it), so it lands correctly at any screen width; if that element no longer exists
 * the raw page coordinates are used instead.
 */

export interface Click {
  path: string;
  dev: "desktop" | "tablet" | "mobile";
  w: number;
  x: number;
  y: number;
  sel: string;
  ox: number;
  oy: number;
}

const LAYOUTS = {
  desktop: { width: 1366, label: "Desktop", devices: ["desktop", "tablet"] },
  mobile: { width: 390, label: "Mobile", devices: ["mobile"] },
} as const;
type Layout = keyof typeof LAYOUTS;

const VIEW_HEIGHT = 680; // visible height of the preview, in screen pixels
const RES = 0.5; // heat layer resolution relative to the page; blur doesn't need more
const RADIUS = 40; // page pixels

// Sequential warm ramp (light yellow → deep red): one direction, no rainbow.
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 237, 160]],
  [0.35, [254, 178, 76]],
  [0.7, [240, 59, 32]],
  [1, [128, 0, 38]],
];

function paletteAt(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    const [t0, c0] = STOPS[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const PALETTE = Array.from({ length: 256 }, (_, i) => paletteAt(i / 255));

function paint(win: Window, clicks: Click[], frameWidth: number): number {
  const doc = win.document;
  const root = doc.documentElement;
  let canvas = doc.getElementById("pf-heat") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = doc.createElement("canvas");
    canvas.id = "pf-heat";
    Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", zIndex: "2147483647" });
    doc.body.appendChild(canvas);
  }
  canvas.style.width = "0px";
  canvas.style.height = "0px";
  const W = root.scrollWidth;
  const H = root.scrollHeight;
  canvas.width = Math.ceil(W * RES);
  canvas.height = Math.ceil(H * RES);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx || !clicks.length) return 0;

  const points: [number, number][] = [];
  for (const c of clicks) {
    let el: Element | null = null;
    try {
      el = c.sel ? doc.querySelector(c.sel) : null;
    } catch {
      el = null;
    }
    const r = el?.getBoundingClientRect();
    if (r && (r.width || r.height)) {
      points.push([r.left + win.scrollX + c.ox * r.width, r.top + win.scrollY + c.oy * r.height]);
    } else {
      points.push([c.w ? (c.x * frameWidth) / c.w : c.x, c.y]);
    }
  }

  const radius = RADIUS * RES;
  // A lone click must still read clearly; many overlapping clicks saturate toward deep red.
  ctx.globalAlpha = Math.min(0.85, Math.max(0.2, 3 / Math.sqrt(points.length)));
  for (const [x, y] of points) {
    const px = x * RES;
    const py = y * RES;
    const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 6) {
      d[i + 3] = 0;
      continue;
    }
    const [r, g, b] = PALETTE[a];
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = Math.min(235, Math.round(a * 1.7)); // fades out smoothly at the edge
  }
  ctx.putImageData(img, 0, 0);
  return points.length;
}

export default function Heatmap({ clicks, paths }: { clicks: Click[]; paths: string[] }) {
  const [path, setPath] = useState(paths.includes("/") ? "/" : paths[0]);
  const [layout, setLayout] = useState<Layout>("desktop");
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState("Loading the page…");
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { width, devices } = LAYOUTS[layout];
  const shown = useMemo(
    () => clicks.filter((c) => c.path === path && (devices as readonly string[]).includes(c.dev)),
    [clicks, path, devices],
  );

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const draw = useCallback(() => {
    const win = frame.current?.contentWindow;
    if (!win || !win.document.body) return;
    try {
      const n = paint(win, shown, width);
      setStatus(n ? `${n} click${n === 1 ? "" : "s"} shown` : "No clicks recorded for this page and layout yet.");
    } catch {
      setStatus("Couldn't draw the heatmap on this page.");
    }
  }, [shown, width]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  function onLoad() {
    const win = frame.current?.contentWindow;
    if (!win) return;
    // A preview, not a browser: block navigation and the page's own click handlers.
    win.document.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    drawRef.current();
    // Re-paint as images load and the page grows.
    let last = 0;
    const iv = win.setInterval(() => {
      const h = win.document.documentElement.scrollHeight;
      if (h !== last) {
        last = h;
        drawRef.current();
      }
    }, 1000);
    win.setTimeout(() => win.clearInterval(iv), 15_000);
  }

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="heatmap">
      <div className="heatmap-controls admin-form">
        <label>
          <span className="admin-label">Page</span>
          <select value={path} onChange={(e) => { setStatus("Loading the page…"); setPath(e.target.value); }}>
            {paths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="heatmap-layouts" role="group" aria-label="Layout">
          {(Object.keys(LAYOUTS) as Layout[]).map((k) => (
            <button key={k} type="button" className={`btn btn-sm ${k === layout ? "btn-primary" : "btn-outline"}`} aria-pressed={k === layout} onClick={() => { setStatus("Loading the page…"); setLayout(k); }}>
              {LAYOUTS[k].label}
            </button>
          ))}
        </div>
        <p className="hint" aria-live="polite">
          {status}
        </p>
        <div className="heatmap-legend hint" aria-hidden>
          fewer <span /> more clicks
        </div>
      </div>
      <div ref={box} className="heatmap-box" style={{ height: VIEW_HEIGHT }}>
        <iframe
          key={`${path}-${layout}`}
          ref={frame}
          src={path}
          title={`Heatmap preview of ${path}`}
          onLoad={onLoad}
          style={{ width, height: VIEW_HEIGHT / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      </div>
    </div>
  );
}
