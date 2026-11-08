"use client";

import { useEffect, useRef } from "react";
import { PALETTE_RGB, type DynamicBg } from "@/lib/slide1-bg";

// Animated neural network for the background of slide 1 (shared by V2, V3 and V4).
// Illustrative only (not a real model): neurons have explicit layers and real edges, and each
// cycle runs (1) forward signals along the edges, layer by layer, (2) neurons brightening as signals
// arrive, (3) softer cyan signals travelling back, (4) a calm pause before the next cycle.
//
// Themes: "layered" (input layer left, hidden layers, output layer right, kept toward the
// centre/right so the text side stays quiet) or "brain" (neurons inside a brain outline, joined to
// their nearest neighbours; signals follow paths through that graph).

interface Neuron {
  x: number;
  y: number;
  /** Layer index (layered) or left-to-right band (brain). */
  layer: number;
  ph: number;
  /** Glow from forward / backward signals, 0..1, fading over time (no flashing). */
  fwd: number;
  bwd: number;
}

interface Edge {
  a: number;
  b: number;
  w: number;
}

interface Signal {
  edge: Edge;
  /** Travels from `from` to `to` (node indexes). */
  from: number;
  to: number;
  start: number;
  dur: number;
  back: boolean;
}

/** Brain outline in unit coordinates: ellipses (cx, cy, rx, ry). */
const BRAIN = [
  [0.5, 0.4, 0.42, 0.32], // cerebrum
  [0.24, 0.5, 0.2, 0.24], // frontal lobe
  [0.72, 0.5, 0.2, 0.26], // occipital lobe
  [0.66, 0.74, 0.17, 0.1], // cerebellum
  [0.56, 0.86, 0.045, 0.13], // brain stem
] as const;
const inBrain = (u: number, v: number) => BRAIN.some(([cx, cy, rx, ry]) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1);

const MAX_NODES = 110;
const MAX_EDGES = 700;

export default function NeuralBackground({
  settings,
  running,
  onFail,
}: {
  settings: DynamicBg;
  running: boolean;
  onFail?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);
  const control = useRef<{ start: () => void; stop: () => void } | null>(null);
  const { theme, palette, density, speed, glow } = settings;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      onFail?.();
      return;
    }
    const colors = PALETTE_RGB[palette] ?? PALETTE_RGB["blue-cyan"];
    let w = 0;
    let h = 0;
    let mobile = false;
    let nodes: Neuron[] = [];
    let edges: Edge[] = [];
    let out: Edge[][] = []; // edges by node, toward the next layer (layered) / neighbours (brain)
    let signals: Signal[] = [];
    let frame = 0;
    let last = 0;
    let visible = true;
    // Cycle state.
    let cycleStart = 0;
    let events: { at: number; run: (now: number) => void }[] = [];
    let nextEvent = 0;
    let cycleMs = 0;
    let fwdActive = new Set<number>();
    let bwdActive = new Set<number>();

    const step = () => 520 / speed; // ms between layers
    const travel = () => step() * 0.85; // a signal arrives before the next layer fires

    function rand(a: number, b: number) {
      return a + Math.random() * (b - a);
    }

    function buildLayered() {
      const L = mobile ? 5 : 7;
      const x0 = mobile ? 0.08 : 0.36;
      const x1 = 0.95;
      const hidden = Math.round((mobile ? 5 : 8) * density);
      const layers: number[][] = [];
      for (let i = 0; i < L; i++) {
        const count = i === 0 ? (mobile ? 4 : 5) : i === L - 1 ? 3 : Math.max(3, Math.min(12, hidden + (i % 2 ? -1 : 1)));
        const x = w * (x0 + ((x1 - x0) * i) / (L - 1));
        const ids: number[] = [];
        for (let j = 0; j < count && nodes.length < MAX_NODES; j++) {
          const y = h * (0.14 + (0.72 * (j + 0.5)) / count) + rand(-0.02, 0.02) * h;
          ids.push(nodes.push({ x: x + rand(-8, 8), y, layer: i, ph: rand(0, 6.28), fwd: 0, bwd: 0 }) - 1);
        }
        layers.push(ids);
      }
      for (let i = 0; i < L - 1; i++)
        for (const a of layers[i])
          for (const b of layers[i + 1]) if (Math.random() < 0.75 && edges.length < MAX_EDGES) edges.push({ a, b, w: Math.random() });
    }

    function buildBrain() {
      // A brain-shaped box toward the centre/right (centred on phones).
      const bw = mobile ? w * 0.92 : Math.min(w * 0.6, h * 1.35);
      const bh = bw / 1.35;
      const ox = mobile ? (w - bw) / 2 : w * 0.97 - bw;
      const oy = (h - bh) / 2;
      const target = Math.min(MAX_NODES, Math.round((mobile ? 55 : 100) * density));
      const minD = bw / Math.sqrt(target) / 1.9;
      let tries = 0;
      while (nodes.length < target && tries++ < 6000) {
        const u = Math.random();
        const v = Math.random();
        if (!inBrain(u, v)) continue;
        const x = ox + u * bw;
        const y = oy + v * bh;
        if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < minD)) continue;
        nodes.push({ x, y, layer: Math.min(7, Math.floor(u * 8)), ph: rand(0, 6.28), fwd: 0, bwd: 0 });
      }
      // Each neuron joins its 3 nearest neighbours.
      const seen = new Set<string>();
      nodes.forEach((n, i) => {
        nodes
          .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
          .filter((o) => o.j !== i)
          .sort((p, q) => p.d - q.d)
          .slice(0, 3)
          .forEach(({ j }) => {
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!seen.has(key) && edges.length < MAX_EDGES) {
              seen.add(key);
              edges.push({ a: Math.min(i, j), b: Math.max(i, j), w: Math.random() });
            }
          });
      });
    }

    /** Shortest path (by hops) between two neurons of the brain graph. */
    function path(from: number, to: number): number[] {
      const prev = new Map<number, number>([[from, -1]]);
      const queue = [from];
      while (queue.length) {
        const n = queue.shift()!;
        if (n === to) break;
        for (const e of out[n]) {
          const m = e.a === n ? e.b : e.a;
          if (!prev.has(m)) {
            prev.set(m, n);
            queue.push(m);
          }
        }
      }
      if (!prev.has(to)) return [];
      const p: number[] = [];
      for (let n = to; n !== -1; n = prev.get(n)!) p.unshift(n);
      return p;
    }

    const edgeOf = (a: number, b: number) => out[a].find((e) => e.a === b || e.b === b);

    function send(from: number, to: number, now: number, back: boolean, delay = 0) {
      const edge = edgeOf(from, to);
      if (edge) signals.push({ edge, from, to, start: now + delay, dur: travel() * rand(0.85, 1), back });
    }

    /** Plan one cycle: forward wave, backward wave, then a pause. */
    function planCycle(now: number) {
      events = [];
      fwdActive = new Set();
      bwdActive = new Set();
      cycleStart = now;
      nextEvent = 0;
      const s = step();
      if (theme === "layered") {
        const L = Math.max(...nodes.map((n) => n.layer)) + 1;
        const inputs = nodes.map((n, i) => (n.layer === 0 ? i : -1)).filter((i) => i >= 0);
        inputs.sort(() => Math.random() - 0.5).slice(0, 3).forEach((i) => fwdActive.add(i));
        for (let l = 0; l < L - 1; l++)
          events.push({
            at: l * s,
            run: (t) => {
              for (const a of [...fwdActive].filter((i) => nodes[i].layer === l)) {
                const outs = out[a].filter((e) => e.a === a).sort(() => Math.random() - 0.5).slice(0, 3);
                for (const e of outs) send(a, e.b, t, false, rand(0, s * 0.1));
              }
            },
          });
        const back0 = (L - 1) * s + s * 1.6;
        for (let l = L - 1; l > 0; l--)
          events.push({
            at: back0 + (L - 1 - l) * s * 1.15,
            run: (t) => {
              const from = l === L - 1 ? [...fwdActive].filter((i) => nodes[i].layer === l) : [...bwdActive].filter((i) => nodes[i].layer === l);
              for (const b of from) {
                const ins = out[b]
                  .filter((e) => e.b === b)
                  .sort(() => Math.random() - 0.5)
                  .slice(0, 2);
                for (const e of ins) send(b, e.a, t, true, rand(0, s * 0.1));
              }
            },
          });
        cycleMs = back0 + (L - 1) * s * 1.15 + 1800 / speed;
      } else {
        // Brain: a few paths from the left (front) to the right (back) of the brain.
        const order = nodes.map((n, i) => i).sort((p, q) => nodes[p].x - nodes[q].x);
        const left = order.slice(0, Math.max(3, Math.round(order.length * 0.15)));
        const right = order.slice(-Math.max(3, Math.round(order.length * 0.15)));
        const paths = [0, 1, 2]
          .map(() => path(left[Math.floor(Math.random() * left.length)], right[Math.floor(Math.random() * right.length)]))
          .filter((p) => p.length > 1);
        const longest = Math.max(1, ...paths.map((p) => p.length));
        for (let k = 0; k < longest - 1; k++)
          events.push({
            at: k * s,
            run: (t) => {
              for (const p of paths) if (k < p.length - 1) send(p[k], p[k + 1], t, false);
            },
          });
        const back0 = (longest - 1) * s + s * 1.6;
        for (let k = 0; k < longest - 1; k++)
          events.push({
            at: back0 + k * s * 1.15,
            run: (t) => {
              for (const p of paths) {
                const r = [...p].reverse();
                if (k < r.length - 1) send(r[k], r[k + 1], t, true);
              }
            },
          });
        cycleMs = back0 + (longest - 1) * s * 1.15 + 1800 / speed;
      }
    }

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      mobile = w < 700;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = [];
      edges = [];
      signals = [];
      if (theme === "brain") buildBrain();
      else buildLayered();
      out = nodes.map(() => []);
      for (const e of edges) {
        out[e.a].push(e);
        if (theme === "brain") out[e.b].push(e);
      }
      // Layered: incoming edges are found from `out` of the previous layer (edges point forward).
      if (theme === "layered") for (const e of edges) if (!out[e.b].includes(e)) out[e.b].push(e);
      planCycle(performance.now());
    }

    function draw(now: number, animate: boolean) {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      ctx!.clearRect(0, 0, w, h);
      const decay = Math.exp(-dt / 700);
      const drift = animate ? 1 : 0;

      // Connections: fine lines, the strongest weights a little brighter.
      ctx!.lineWidth = 0.7;
      ctx!.strokeStyle = `rgba(${colors.base}, 0.22)`;
      ctx!.beginPath();
      for (const e of edges) {
        if (e.w > 0.8) continue;
        ctx!.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx!.lineTo(nodes[e.b].x, nodes[e.b].y);
      }
      ctx!.stroke();
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = `rgba(${colors.base}, 0.38)`;
      ctx!.beginPath();
      for (const e of edges) {
        if (e.w <= 0.8) continue;
        ctx!.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx!.lineTo(nodes[e.b].x, nodes[e.b].y);
      }
      ctx!.stroke();

      // Signals along their edges, with a short trail.
      ctx!.globalCompositeOperation = "lighter";
      signals = signals.filter((s) => {
        const p = (now - s.start) / s.dur;
        if (p < 0) return true;
        const to = nodes[s.to];
        if (p >= 1) {
          if (s.back) {
            to.bwd = 1;
            bwdActive.add(s.to);
          } else {
            to.fwd = 1;
            fwdActive.add(s.to);
          }
          return false;
        }
        const from = nodes[s.from];
        const at = (q: number) => [from.x + (to.x - from.x) * q, from.y + (to.y - from.y) * q] as const;
        const rgb = s.back ? colors.backward : colors.forward;
        const strength = s.back ? 0.55 : 0.9;
        const [hx, hy] = at(p);
        const [tx, ty] = at(Math.max(0, p - 0.22));
        ctx!.strokeStyle = `rgba(${rgb}, ${0.45 * strength})`;
        ctx!.lineWidth = 1.3;
        ctx!.beginPath();
        ctx!.moveTo(tx, ty);
        ctx!.lineTo(hx, hy);
        ctx!.stroke();
        ctx!.fillStyle = `rgba(${rgb}, ${0.22 * glow * strength})`;
        ctx!.beginPath();
        ctx!.arc(hx, hy, 3 + 4 * glow, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(${rgb}, ${strength})`;
        ctx!.beginPath();
        ctx!.arc(hx, hy, 1.7, 0, Math.PI * 2);
        ctx!.fill();
        return true;
      });

      // Neurons: small and blue; a restrained cyan glow when activated.
      for (const n of nodes) {
        n.fwd *= decay;
        n.bwd *= decay;
        const x = n.x + Math.sin(now * 0.0004 + n.ph) * 2 * drift;
        const y = n.y + Math.cos(now * 0.0005 + n.ph) * 2 * drift;
        if (n.fwd > 0.02) {
          ctx!.fillStyle = `rgba(${colors.forward}, ${0.35 * glow * n.fwd})`;
          ctx!.beginPath();
          ctx!.arc(x, y, 3 + 7 * n.fwd * glow, 0, Math.PI * 2);
          ctx!.fill();
        }
        if (n.bwd > 0.02) {
          ctx!.fillStyle = `rgba(${colors.backward}, ${0.25 * glow * n.bwd})`;
          ctx!.beginPath();
          ctx!.arc(x, y, 3 + 5 * n.bwd * glow, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      // Every neuron: a soft halo, then its dot.
      const r = mobile ? 1.6 : 2.2;
      for (const n of nodes) {
        const x = n.x + Math.sin(now * 0.0004 + n.ph) * 2 * drift;
        const y = n.y + Math.cos(now * 0.0005 + n.ph) * 2 * drift;
        ctx!.fillStyle = `rgba(${colors.base}, 0.16)`;
        ctx!.beginPath();
        ctx!.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";
      for (const n of nodes) {
        const x = n.x + Math.sin(now * 0.0004 + n.ph) * 2 * drift;
        const y = n.y + Math.cos(now * 0.0005 + n.ph) * 2 * drift;
        ctx!.fillStyle = `rgba(${colors.base}, ${0.85 + 0.15 * Math.max(n.fwd, n.bwd)})`;
        ctx!.beginPath();
        ctx!.arc(x, y, r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function tick(now: number) {
      while (nextEvent < events.length && now - cycleStart >= events[nextEvent].at) events[nextEvent++].run(now);
      if (now - cycleStart >= cycleMs) planCycle(now);
      draw(now, true);
      frame = requestAnimationFrame(tick);
    }

    const shouldRun = () => runningRef.current && visible && document.visibilityState !== "hidden";
    function start() {
      if (frame || !shouldRun()) return;
      last = 0;
      planCycle(performance.now());
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      signals = [];
      for (const n of nodes) n.fwd = n.bwd = 0;
      draw(performance.now(), false); // a calm, static network
    }
    const sync = () => (shouldRun() ? start() : stop());
    control.current = { start: sync, stop: sync };

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
  }, [theme, palette, density, speed, glow]);

  // Start/stop without rebuilding the network when only `running` changes.
  useEffect(() => {
    runningRef.current = running;
    control.current?.start();
  }, [running]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
