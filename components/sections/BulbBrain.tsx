"use client";

import { useEffect, useRef } from "react";
import type { DynamicBg } from "@/lib/slide1-bg";
import { inside } from "./ElectroBrain";

// "Idea bulb" background for slide 1 (shared by V2, V3 and V4), version 2 of the electronic brain.
// Each cycle: (1) the 3D brain of glowing neurons turns, twinkling; (2) sparks start from neurons all
// over the brain, run along neural pathways and meet in the centre, charging it; (3) part of the
// neurons leave the brain and gather into a light bulb (glass, neck, screw base, filament) while the
// rest dims; (4) the bulb lights up, warm and pulsing; (5) the neurons return to the brain.
// Illustrative only. Falls back to the electronic-brain image like the "electro" theme.

const BASE = "70, 150, 255";
const PULSE = "120, 230, 255";
const WARM = "255, 214, 90";
const SPARK_COLORS = ["90, 175, 255", "255, 214, 90", "110, 255, 170"]; // blue, yellow, green
const MAX_NODES = 480;

/** Phase lengths (ms at speed 1): brain, sparks converge, form the bulb, bulb lit, back to the brain. */
const PHASES = { brain: 2600, converge: 4200, morph: 1900, lit: 4200, release: 1900 };

/** Bulb parts: 0 glass and neck, 1 screw base, 2 filament. */
type Part = 0 | 1 | 2;

interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Bulb outline in units of the brain size (x right, y down, glass centre at y = -0.3). */
function bulbLines(): { part: Part; pts: [number, number][] }[] {
  const glass: [number, number][] = [[0.22, 0.5]];
  const a0 = 0.5; // half-opening of the glass at the bottom, radians
  for (let i = 0; i <= 64; i++) {
    const a = a0 + ((Math.PI * 2 - 2 * a0) * i) / 64;
    glass.push([Math.sin(a) * 0.6, -0.3 + Math.cos(a) * 0.6]);
  }
  glass.push([-0.22, 0.5]);
  return [
    { part: 0, pts: glass },
    { part: 1, pts: [[-0.22, 0.56], [0.22, 0.56]] },
    { part: 1, pts: [[-0.2, 0.66], [0.2, 0.66]] },
    { part: 1, pts: [[-0.17, 0.76], [0.17, 0.76]] },
    { part: 1, pts: [[-0.11, 0.84], [0, 0.9], [0.11, 0.84]] },
    { part: 2, pts: [[-0.1, 0.5], [-0.1, 0.12], [-0.05, 0], [0, 0.12], [0.05, 0], [0.1, 0.12], [0.1, 0.5]] },
  ];
}

/** Points about `count` evenly spaced along the bulb outline, and the links between neighbours. */
function bulbPoints(count: number) {
  const lines = bulbLines();
  let total = 0;
  for (const { pts } of lines) for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const gap = total / Math.max(8, count - lines.length);
  const points: { x: number; y: number; part: Part }[] = [];
  const links: [number, number][] = [];
  for (const { part, pts } of lines) {
    points.push({ x: pts[0][0], y: pts[0][1], part });
    let carry = 0; // distance walked since the last point
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      let t = gap - carry;
      for (; t <= len; t += gap) {
        points.push({ x: ax + ((bx - ax) * t) / len, y: ay + ((by - ay) * t) / len, part });
        links.push([points.length - 2, points.length - 1]);
      }
      carry = len - (t - gap);
    }
  }
  return { points, links };
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export default function BulbBrain({ settings, running, onFail }: { settings: DynamicBg; running: boolean; onFail?: () => void }) {
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
    // Bulb: target points (bulb units), their links, and which neuron goes to which point.
    let bulb: { x: number; y: number; part: Part }[] = [];
    let bulbLinks: [number, number][] = [];
    let owner: number[] = []; // bulb point -> neuron
    let role: Int32Array = new Int32Array(0); // neuron -> bulb point, or -1
    let frame = 0;
    let visible = true;
    let last = 0;
    let angle = 0.6;
    let cycleStart = 0;
    let charge = 0; // centre glow from arrived sparks, 0..1
    let sparks: { n: number; born: number; life: number; color: string }[] = [];
    let pulses: { path: number[]; start: number; dur: number }[] = [];
    let spawnAcc = 0;
    // Positions of this frame: brain projection, then the drawn position (brain -> bulb).
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    let pd = new Float32Array(0); // depth factor 0 (back) .. 1 (front)
    let qx = new Float32Array(0);
    let qy = new Float32Array(0);
    let cx = 0;
    let cy = 0;
    let size = 0;

    const dur = (k: keyof typeof PHASES) => PHASES[k] / speed;
    const cycleMs = () => dur("brain") + dur("converge") + dur("morph") + dur("lit") + dur("release");

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      mobile = w < 700;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Neurons near the surface of the brain (a shell), as in the electronic brain.
      const target = Math.min(MAX_NODES, Math.round((mobile ? 200 : 380) * density));
      nodes = [];
      let tries = 0;
      while (nodes.length < target && tries++ < 40000) {
        const x = Math.random() * 2.4 - 1.2;
        const y = Math.random() * 2.2 - 1.25;
        const z = Math.random() * 1.8 - 0.9;
        if (!inside(x, y, z) || inside(x, y, z, 0.8)) continue;
        if (y > 0 && Math.abs(z) < 0.05) continue;
        nodes.push({ x, y, z });
      }
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
      // About 40 % of the neurons, picked from all over the brain, form the bulb.
      const shape = bulbPoints(Math.max(40, Math.round(nodes.length * 0.4)));
      const picked = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
      bulb = shape.points.slice(0, nodes.length);
      bulbLinks = shape.links.filter(([a, b]) => a < bulb.length && b < bulb.length);
      owner = bulb.map((_, k) => picked[k]);
      role = new Int32Array(nodes.length).fill(-1);
      owner.forEach((n, k) => (role[n] = k));
      px = new Float32Array(nodes.length);
      py = new Float32Array(nodes.length);
      pd = new Float32Array(nodes.length);
      qx = new Float32Array(nodes.length);
      qy = new Float32Array(nodes.length);
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

    /** Phase factors at time t of the cycle: m = brain (0) → bulb (1), lit = bulb light 0..1. */
    function phase(t: number) {
      const b = dur("brain");
      const c = b + dur("converge");
      const mo = c + dur("morph");
      const l = mo + dur("lit");
      const m = t < c ? 0 : t < mo ? ease((t - c) / dur("morph")) : t < l ? 1 : 1 - ease((t - l) / dur("release"));
      const lit =
        t < c + dur("morph") * 0.5
          ? 0
          : t < mo
            ? clamp01((t - c - dur("morph") * 0.5) / (dur("morph") * 0.5))
            : t < l
              ? 1
              : clamp01(1 - (t - l) / (dur("release") * 0.5));
      const converging = t >= b && t < b + dur("converge") * 0.8;
      return { m, lit, converging };
    }

    function project(m: number) {
      // Right of the text on wide screens, centred on phones (same place as the electronic brain).
      cx = mobile ? w * 0.5 : w * 0.66;
      cy = h * 0.5;
      size = Math.min(mobile ? w * 0.44 : w * 0.33, h * 0.46);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tilt = 0.18;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const x = n.x * cos + n.z * sin;
        const z0 = -n.x * sin + n.z * cos;
        const y = n.y * ct - z0 * st;
        const z = n.y * st + z0 * ct;
        const persp = 3.2 / (3.2 + z);
        px[i] = cx + x * size * persp;
        py[i] = cy - y * size * persp;
        pd[i] = Math.max(0, Math.min(1, (1 - z) / 2));
        const k = role[i];
        if (k >= 0 && m > 0) {
          qx[i] = px[i] + (cx + bulb[k].x * size - px[i]) * m;
          qy[i] = py[i] + (cy + bulb[k].y * size - py[i]) * m;
        } else {
          qx[i] = px[i];
          qy[i] = py[i];
        }
      }
    }

    function glowAt(x: number, y: number, r: number, inner: string, a: number) {
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${inner}, ${a})`);
      g.addColorStop(0.45, `rgba(${PULSE}, ${a * 0.35})`);
      g.addColorStop(1, `rgba(${PULSE}, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    /** One frame. `still`: a calm, lit bulb (paused, off screen or reduced motion). */
    function draw(now: number, still: boolean) {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (!still) angle += ((Math.PI * 2) / 26000) * speed * dt;
      const t = still ? dur("brain") + dur("converge") + dur("morph") : now - cycleStart;
      const { m, lit: lit0, converging } = phase(t);
      const lit = lit0 * (still ? 1 : 0.88 + 0.12 * Math.sin(now / 420));
      project(m);
      const coreX = cx;
      const coreY = cy - 0.3 * size; // centre of the bulb glass: where the sparks meet
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";

      // The bulb's light, behind everything.
      if (lit > 0.01) glowAt(coreX, coreY, size * 1.25, WARM, 0.26 * glow * lit + 0.04 * lit);
      // The centre, charged by arriving sparks.
      charge *= Math.exp(-dt / 1600);
      if (charge > 0.01 && m < 1) glowAt(coreX, coreY, 18 + size * 0.35 * charge, "230, 250, 255", 0.45 * glow * charge * (1 - m));

      // Brain connections fade out as the bulb forms; bulb links fade in.
      ctx!.lineWidth = 0.7;
      const fade = 1 - 0.88 * m;
      for (const [a, b] of edges) {
        const d = (pd[a] + pd[b]) / 2;
        ctx!.strokeStyle = `rgba(${BASE}, ${(0.08 + 0.34 * d) * fade})`;
        ctx!.beginPath();
        ctx!.moveTo(qx[a], qy[a]);
        ctx!.lineTo(qx[b], qy[b]);
        ctx!.stroke();
      }
      if (m > 0.01) {
        ctx!.lineWidth = 1;
        for (const [a, b] of bulbLinks) {
          const warm = bulb[a].part === 2;
          ctx!.strokeStyle = `rgba(${warm && lit > 0.05 ? WARM : PULSE}, ${m * (0.3 + 0.45 * lit)})`;
          ctx!.beginPath();
          ctx!.moveTo(qx[owner[a]], qy[owner[a]]);
          ctx!.lineTo(qx[owner[b]], qy[owner[b]]);
          ctx!.stroke();
        }
      }

      // Neurons: the bulb's become uniformly bright; the others dim.
      for (let i = 0; i < nodes.length; i++) {
        const k = role[i];
        const d = k >= 0 ? pd[i] + (1 - pd[i]) * m : pd[i];
        const a = k >= 0 ? 1 : 1 - 0.8 * m;
        const r = (mobile ? 1.3 : 1.7) * (0.6 + 0.7 * d) * (k >= 0 ? 1 + 0.35 * lit : 1);
        const filament = k >= 0 && bulb[k].part === 2 && lit > 0.05;
        ctx!.fillStyle = `rgba(${filament ? WARM : BASE}, ${(0.14 + 0.2 * d + (k >= 0 ? 0.25 * lit : 0)) * a})`;
        ctx!.beginPath();
        ctx!.arc(qx[i], qy[i], r * (2.8 + (k >= 0 ? 1.6 * lit : 0)), 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = filament ? `rgba(255, 236, 170, ${0.7 + 0.3 * lit})` : `rgba(110, 185, 255, ${(0.5 + 0.5 * d) * a})`;
        ctx!.beginPath();
        ctx!.arc(qx[i], qy[i], r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!still) {
        // Twinkles: all over the brain; on the bulb (mostly warm) while it is lit.
        const rate = (mobile ? 18 : 34) * density;
        if (Math.random() < (rate * dt) / 1000) {
          const onBulb = m > 0.5 && owner.length > 0;
          sparks.push({
            n: onBulb ? owner[Math.floor(Math.random() * owner.length)] : Math.floor(Math.random() * nodes.length),
            born: now,
            life: 700 + Math.random() * 900,
            color: onBulb && Math.random() < 0.6 ? WARM : SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          });
        }
        sparks = sparks.filter((s) => {
          const a = (now - s.born) / s.life;
          if (a >= 1) return false;
          const k = Math.sin(Math.PI * a) * (0.4 + 0.6 * (role[s.n] >= 0 ? Math.max(pd[s.n], m) : pd[s.n] * (1 - 0.8 * m)));
          ctx!.fillStyle = `rgba(${s.color}, ${0.35 * glow * k})`;
          ctx!.beginPath();
          ctx!.arc(qx[s.n], qy[s.n], 4 + 9 * glow * k, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${s.color}, ${0.95 * k})`;
          ctx!.beginPath();
          ctx!.arc(qx[s.n], qy[s.n], 2.2, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });

        // Converging sparks: from neurons all over the brain, along pathways, to the centre.
        if (converging && nodes.length > 10) {
          spawnAcc += (((mobile ? 9 : 16) * density * speed) * dt) / 1000;
          while (spawnAcc >= 1) {
            spawnAcc -= 1;
            let hub = 0;
            let best = Infinity;
            for (let i = 0; i < nodes.length; i++) {
              const dd = (px[i] - coreX) ** 2 + (py[i] - coreY) ** 2 - pd[i] * size * size * 0.05; // prefer the front
              if (dd < best) {
                best = dd;
                hub = i;
              }
            }
            const p = path(Math.floor(Math.random() * nodes.length), hub);
            if (p.length > 1) pulses.push({ path: p, start: now, dur: Math.min(2600, (p.length * 150) / speed) });
          }
        }
        pulses = pulses.filter((pl) => {
          const t2 = (now - pl.start) / pl.dur;
          if (t2 >= 1) {
            charge = Math.min(1, charge + 0.06);
            return false;
          }
          // The path, then a last leg from its final neuron into the centre.
          const pts = pl.path.length + 1;
          const X = (j: number) => (j < pl.path.length ? qx[pl.path[j]] : coreX);
          const Y = (j: number) => (j < pl.path.length ? qy[pl.path[j]] : coreY);
          const head = t2 * (pts - 1);
          for (let j = Math.max(0, Math.floor(head) - 4); j < Math.min(pts - 1, Math.ceil(head)); j++) {
            const f = Math.max(0, 1 - (head - j) / 5);
            ctx!.strokeStyle = `rgba(${PULSE}, ${0.6 * f})`;
            ctx!.lineWidth = 1.6;
            ctx!.beginPath();
            ctx!.moveTo(X(j), Y(j));
            const e = Math.min(j + 1, head);
            ctx!.lineTo(X(j) + (X(j + 1) - X(j)) * (e - j), Y(j) + (Y(j + 1) - Y(j)) * (e - j));
            ctx!.stroke();
          }
          const i = Math.floor(head);
          const f = head - i;
          const hx = X(i) + (X(Math.min(i + 1, pts - 1)) - X(i)) * f;
          const hy = Y(i) + (Y(Math.min(i + 1, pts - 1)) - Y(i)) * f;
          ctx!.fillStyle = `rgba(${PULSE}, ${0.3 * glow})`;
          ctx!.beginPath();
          ctx!.arc(hx, hy, 4 + 6 * glow, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = "rgba(230, 250, 255, 0.95)";
          ctx!.beginPath();
          ctx!.arc(hx, hy, 2, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });
      }
      ctx!.globalCompositeOperation = "source-over";
      if (!still && t >= cycleMs()) {
        cycleStart = now;
        charge = 0;
      }
    }

    function tick(now: number) {
      draw(now, false);
      frame = requestAnimationFrame(tick);
    }
    const shouldRun = () => runningRef.current && visible && document.visibilityState !== "hidden";
    const sync = () => {
      if (shouldRun()) {
        if (!frame) {
          last = 0;
          // Resume from the lit bulb (what the still frame shows), then back to the brain.
          cycleStart = performance.now() - (dur("brain") + dur("converge") + dur("morph"));
          frame = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        sparks = [];
        pulses = [];
        charge = 0;
        draw(performance.now(), true);
      }
    };
    control.current = sync;

    build();
    draw(performance.now(), true);
    sync();
    const ro = new ResizeObserver(() => {
      build();
      draw(performance.now(), !frame);
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
