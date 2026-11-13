"use client";

import { useEffect, useRef } from "react";
import type { DynamicBg } from "@/lib/slide1-bg";

// "Electronic brain" background for slide 1 (shared by V2, V3 and V4): a 3D brain made of glowing
// blue neurons and connections, turning a full 360° around its vertical axis. Neurons sparkle in
// blue, yellow and green, and cyan pulses run along neural pathways (forward, then softly back).
// Illustrative only. Modelled on public/electrobrain.webp, which is also its fallback.

/** Brain volume: ellipsoids (cx, cy, cz, rx, ry, rz) in model units (x front→back, y up, z sideways). */
const LOBES = [
  [0, 0.12, 0, 1.0, 0.62, 0.8], // cerebrum
  [-0.55, -0.05, 0, 0.5, 0.52, 0.72], // frontal lobe
  [0.62, 0.02, 0, 0.5, 0.5, 0.7], // occipital lobe
  [0.02, -0.32, 0, 0.62, 0.3, 0.74], // temporal lobes
  [0.58, -0.56, 0, 0.36, 0.22, 0.46], // cerebellum
  [0.26, -0.86, 0, 0.1, 0.36, 0.12], // brain stem
] as const;

/** Whether a model point is inside the brain volume (scaled by `s`). Shared with the bulb theme. */
export const inside = (x: number, y: number, z: number, s = 1) =>
  LOBES.some(([cx, cy, cz, rx, ry, rz]) => ((x - cx) / (rx * s)) ** 2 + ((y - cy) / (ry * s)) ** 2 + ((z - cz) / (rz * s)) ** 2 <= 1);

const SPARK_COLORS = ["90, 175, 255", "255, 214, 90", "110, 255, 170"]; // blue, yellow, green
const BASE = "70, 150, 255";
const PULSE = "120, 230, 255";
const MAX_NODES = 480;

interface P3 {
  x: number;
  y: number;
  z: number;
}

export default function ElectroBrain({ settings, running, onFail }: { settings: DynamicBg; running: boolean; onFail?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);
  const control = useRef<(() => void) | null>(null);
  const { density, speed, glow } = settings;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      onFail?.();
      return;
    }
    let w = 0;
    let h = 0;
    let mobile = false;
    let nodes: P3[] = [];
    let edges: [number, number][] = [];
    let adj: number[][] = [];
    let frame = 0;
    let visible = true;
    let last = 0;
    let angle = 0.6;
    // Twinkling neurons and travelling pulses.
    let sparks: { n: number; born: number; life: number; color: string }[] = [];
    let pulses: { path: number[]; start: number; dur: number; back: boolean }[] = [];
    let nextPulse = 0;
    // Projected positions of this frame.
    let px: Float32Array = new Float32Array(0);
    let py: Float32Array = new Float32Array(0);
    let pd: Float32Array = new Float32Array(0); // depth factor 0 (back) .. 1 (front)

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      mobile = w < 700;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Neurons near the surface of the brain (a shell), so it reads as a glowing mesh.
      const target = Math.min(MAX_NODES, Math.round((mobile ? 200 : 380) * density));
      nodes = [];
      let tries = 0;
      while (nodes.length < target && tries++ < 40000) {
        const x = Math.random() * 2.4 - 1.2;
        const y = Math.random() * 2.2 - 1.25;
        const z = Math.random() * 1.8 - 0.9;
        if (!inside(x, y, z) || inside(x, y, z, 0.8)) continue;
        if (y > 0 && Math.abs(z) < 0.05) continue; // the gap between the two hemispheres
        nodes.push({ x, y, z });
      }
      // Each neuron connects to its 3 nearest neighbours.
      const seen = new Set<string>();
      edges = [];
      nodes.forEach((a, i) => {
        nodes
          .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
          .filter((o) => o.j !== i)
          .sort((p, q) => p.d - q.d)
          .slice(0, 3)
          .forEach(({ j }) => {
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!seen.has(key)) {
              seen.add(key);
              edges.push([Math.min(i, j), Math.max(i, j)]);
            }
          });
      });
      adj = nodes.map(() => []);
      for (const [a, b] of edges) {
        adj[a].push(b);
        adj[b].push(a);
      }
      px = new Float32Array(nodes.length);
      py = new Float32Array(nodes.length);
      pd = new Float32Array(nodes.length);
      sparks = [];
      pulses = [];
    }

    /** Shortest path (by hops) between two neurons. */
    function path(from: number, to: number): number[] {
      const prev = new Map<number, number>([[from, -1]]);
      const queue = [from];
      while (queue.length) {
        const n = queue.shift()!;
        if (n === to) break;
        for (const m of adj[n]) {
          if (prev.has(m)) continue;
          prev.set(m, n);
          queue.push(m);
        }
      }
      if (!prev.has(to)) return [];
      const p: number[] = [];
      for (let n = to; n !== -1; n = prev.get(n)!) p.unshift(n);
      return p;
    }

    function project() {
      // The brain sits to the right on wide screens (text side stays calm), centred on phones.
      const cx = mobile ? w * 0.5 : w * 0.66;
      const cy = h * 0.5;
      const size = Math.min(mobile ? w * 0.44 : w * 0.33, h * 0.46);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tilt = 0.18;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        // Turn around the vertical axis, then a slight forward tilt.
        const x = n.x * cos + n.z * sin;
        const z0 = -n.x * sin + n.z * cos;
        const y = n.y * ct - z0 * st;
        const z = n.y * st + z0 * ct;
        const persp = 3.2 / (3.2 + z);
        px[i] = cx + x * size * persp;
        py[i] = cy - y * size * persp;
        pd[i] = Math.max(0, Math.min(1, (1 - z) / 2));
      }
    }

    function draw(now: number, animate: boolean) {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (animate) angle += ((Math.PI * 2) / 26000) * speed * dt; // a full turn in ~26 s at speed 1
      project();
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";

      // Connections, brighter toward the front.
      ctx!.lineWidth = 0.7;
      for (const [a, b] of edges) {
        const d = (pd[a] + pd[b]) / 2;
        ctx!.strokeStyle = `rgba(${BASE}, ${0.08 + 0.34 * d})`;
        ctx!.beginPath();
        ctx!.moveTo(px[a], py[a]);
        ctx!.lineTo(px[b], py[b]);
        ctx!.stroke();
      }
      // Neurons.
      for (let i = 0; i < nodes.length; i++) {
        const d = pd[i];
        const r = (mobile ? 1.3 : 1.7) * (0.6 + 0.7 * d);
        ctx!.fillStyle = `rgba(${BASE}, ${0.14 + 0.2 * d})`;
        ctx!.beginPath();
        ctx!.arc(px[i], py[i], r * 2.8, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(110, 185, 255, ${0.5 + 0.5 * d})`;
        ctx!.beginPath();
        ctx!.arc(px[i], py[i], r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (animate) {
        // Sparkles: neurons twinkle in blue, yellow and green (smooth in and out, no flashing).
        const rate = (mobile ? 18 : 34) * density;
        if (Math.random() < (rate * dt) / 1000)
          sparks.push({
            n: Math.floor(Math.random() * nodes.length),
            born: now,
            life: 700 + Math.random() * 900,
            color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          });
        sparks = sparks.filter((s) => {
          const a = (now - s.born) / s.life;
          if (a >= 1) return false;
          const k = Math.sin(Math.PI * a) * (0.4 + 0.6 * pd[s.n]);
          ctx!.fillStyle = `rgba(${s.color}, ${0.35 * glow * k})`;
          ctx!.beginPath();
          ctx!.arc(px[s.n], py[s.n], 4 + 9 * glow * k, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${s.color}, ${0.95 * k})`;
          ctx!.beginPath();
          ctx!.arc(px[s.n], py[s.n], 2.2, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });

        // Pulses along a neural pathway: forward, then softly back.
        if (now >= nextPulse && nodes.length > 10) {
          const order = nodes.map((_, i) => i).sort((p, q) => nodes[p].x - nodes[q].x);
          const front = order.slice(0, Math.round(order.length * 0.15));
          const back = order.slice(-Math.round(order.length * 0.15));
          const p = path(front[Math.floor(Math.random() * front.length)], back[Math.floor(Math.random() * back.length)]);
          if (p.length > 2) {
            const dur = (p.length * 260) / speed;
            pulses.push({ path: p, start: now, dur, back: false });
            pulses.push({ path: [...p].reverse(), start: now + dur + 500 / speed, dur: dur * 1.2, back: true });
          }
          nextPulse = now + (4200 + Math.random() * 1800) / speed;
        }
        pulses = pulses.filter((pl) => {
          const t = (now - pl.start) / pl.dur;
          if (t < 0) return true;
          if (t >= 1) return false;
          const strength = pl.back ? 0.5 : 1;
          const head = t * (pl.path.length - 1);
          // A lit trail behind the head.
          for (let k = Math.max(0, Math.floor(head) - 4); k < Math.min(pl.path.length - 1, Math.ceil(head)); k++) {
            const a = pl.path[k];
            const b = pl.path[k + 1];
            const fade = Math.max(0, 1 - (head - k) / 5);
            ctx!.strokeStyle = `rgba(${PULSE}, ${0.6 * strength * fade})`;
            ctx!.lineWidth = 1.6;
            ctx!.beginPath();
            ctx!.moveTo(px[a], py[a]);
            ctx!.lineTo(px[b], py[b]);
            ctx!.stroke();
          }
          const i = Math.floor(head);
          const f = head - i;
          const a = pl.path[i];
          const b = pl.path[Math.min(i + 1, pl.path.length - 1)];
          const hx = px[a] + (px[b] - px[a]) * f;
          const hy = py[a] + (py[b] - py[a]) * f;
          ctx!.fillStyle = `rgba(${PULSE}, ${0.3 * glow * strength})`;
          ctx!.beginPath();
          ctx!.arc(hx, hy, 4 + 6 * glow, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(230, 250, 255, ${0.95 * strength})`;
          ctx!.beginPath();
          ctx!.arc(hx, hy, 2, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    function tick(now: number) {
      draw(now, true);
      frame = requestAnimationFrame(tick);
    }
    const shouldRun = () => runningRef.current && visible && document.visibilityState !== "hidden";
    const sync = () => {
      if (shouldRun()) {
        if (!frame) {
          last = 0;
          frame = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        sparks = [];
        pulses = [];
        draw(performance.now(), false); // a still brain
      }
    };
    control.current = sync;

    build();
    draw(performance.now(), false);
    sync();
    const ro = new ResizeObserver(() => {
      build();
      draw(performance.now(), false);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      control.current = null;
    };
    // onFail is a callback from the parent; rebuilding when it changes identity isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, speed, glow]);

  useEffect(() => {
    runningRef.current = running;
    control.current?.();
  }, [running]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
