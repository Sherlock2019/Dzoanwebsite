"use client";

import { useEffect, useRef } from "react";
import type { DynamicBg } from "@/lib/slide1-bg";
import { inside } from "./ElectroBrain";

// "Idea bulb" background for slide 1 (shared by V2, V3 and V4): the electronic brain where an idea is
// born. Each cycle (~14 s at speed 1): (1) the 3D brain of glowing neurons turns, twinkling; (2) sparks
// start from neurons all over the brain, run along neural pathways and meet in the centre; (3) over
// ~5 s, neurons leave the brain one after another, sparkling as they fly through the centre, and
// gather like drones in a night sky into a small light bulb inside the brain, traced progressively
// (glass, then screw base, then filament), each point the same small neuron as everywhere else;
// (4) the finished bulb sparkles brighter than the dimmed brain around it, the filament warm yellow;
// (5) it dissolves: the neurons fly back to their places in the brain, and the loop starts again.
// Illustrative only. Falls back to the electronic-brain image like the "electro" theme.

const BASE = "70, 150, 255";
const PULSE = "120, 230, 255";
const WARM = "255, 214, 90";
const SPARK_COLORS = ["90, 175, 255", "255, 214, 90", "110, 255, 170"]; // blue, yellow, green
const BULB_SPARKS = ["235, 248, 255", "140, 235, 255", "255, 214, 90"]; // white, cyan, yellow
const MAX_NODES = 480;

/**
 * Phase lengths (ms at speed 1): brain, sparks start converging, the bulb forms progressively,
 * the finished bulb sparkles, then it dissolves back into the brain.
 */
const PHASES = { brain: 2000, converge: 1800, form: 5000, lit: 2600, dissolve: 2800 };
/** Flight of one neuron: brain → through the centre → its place in the bulb, and back (ms at speed 1). */
const FLIGHT = 1500;
const FLIGHT_BACK = 1400;

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

/** The bulb's size relative to the brain: small enough to sit inside it. */
const BULB_SCALE = 0.5;

/** Points spaced `gap` apart (bulb units) along the bulb outline. */
function bulbPoints(gap: number) {
  const lines = bulbLines();
  const points: { x: number; y: number; part: Part }[] = [];
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
      }
      carry = len - (t - gap);
    }
  }
  return points;
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
    // Bulb: target points (bulb units) and which neuron goes to which point.
    let bulb: { x: number; y: number; part: Part }[] = [];
    let owner: number[] = []; // bulb point -> neuron
    let role: Int32Array = new Int32Array(0); // neuron -> bulb point, or -1
    // Per bulb point: when its neuron leaves (forming, dissolving) and a small detour near the centre.
    let leaveAt = new Float32Array(0);
    let returnAt = new Float32Array(0);
    let detourX = new Float32Array(0);
    let detourY = new Float32Array(0);
    let mOf = new Float32Array(0); // per neuron, this frame: 0 in the brain .. 1 in the bulb
    let coreX = 0;
    let coreY = 0;
    let frame = 0;
    let visible = true;
    let last = 0;
    let angle = 0.6;
    let cycleStart = 0;
    let charge = 0; // centre glow from arrived sparks, 0..1
    let sparks: { n: number; born: number; life: number; color: string }[] = [];
    let pulses: { path: number[]; start: number; dur: number }[] = [];
    let spawnAcc = 0;
    let spawnBulb = 0;
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
    const cycleMs = () => dur("brain") + dur("converge") + dur("form") + dur("lit") + dur("dissolve");
    /** Time in the cycle when the bulb is complete (also the still frame). */
    const formedAt = () => dur("brain") + dur("converge") + dur("form");

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
      // The bulb: points a few neuron-widths apart (like drones), so each one reads as its own light.
      // Its neurons are picked from all over the brain; at most half of them, so the brain stays.
      layout();
      const gapPx = mobile ? 9 : 12;
      const shape = bulbPoints(gapPx / (size * BULB_SCALE));
      const picked = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
      bulb = shape.slice(0, Math.floor(nodes.length / 2));
      owner = bulb.map((_, k) => picked[k]);
      role = new Int32Array(nodes.length).fill(-1);
      owner.forEach((n, k) => (role[n] = k));
      // Departures follow the outline (glass, then base, then filament), so the shape is traced
      // progressively, with a little jitter so it feels like a swarm rather than a pen.
      const nb = bulb.length;
      leaveAt = Float32Array.from(bulb, (_, k) => clamp01(k / Math.max(1, nb - 1) + (Math.random() - 0.5) * 0.06));
      returnAt = Float32Array.from(bulb, () => Math.random());
      detourX = Float32Array.from(bulb, () => (Math.random() - 0.5) * 0.36);
      detourY = Float32Array.from(bulb, () => (Math.random() - 0.5) * 0.36);
      mOf = new Float32Array(nodes.length);
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

    /**
     * Phase factors at time t of the cycle: m = how much of the bulb exists (0 .. 1, dims the brain),
     * lit = the finished bulb's sparkle 0..1, converging = sparks run to the centre.
     */
    function phase(t: number) {
      const b = dur("brain");
      const c = b + dur("converge");
      const f = c + dur("form");
      const l = f + dur("lit");
      const m = t < c ? 0 : t < f ? clamp01((t - c) / dur("form")) : t < l ? 1 : 1 - clamp01((t - l) / dur("dissolve"));
      const lit =
        t < f - dur("form") * 0.15
          ? 0
          : t < f
            ? clamp01((t - f + dur("form") * 0.15) / (dur("form") * 0.15))
            : t < l
              ? 1
              : clamp01(1 - (t - l) / (dur("dissolve") * 0.4));
      const converging = t >= b && t < c + dur("form") * 0.5;
      return { m, lit, converging };
    }

    /** Where bulb point k's neuron is at time t: 0 in the brain .. 1 in its place in the bulb. */
    function flight(k: number, t: number) {
      const c = dur("brain") + dur("converge");
      const l = formedAt() + dur("lit");
      if (t < c) return 0;
      if (t < l) return ease((t - c - leaveAt[k] * (dur("form") - FLIGHT / speed)) / (FLIGHT / speed));
      return 1 - ease((t - l - returnAt[k] * (dur("dissolve") - FLIGHT_BACK / speed)) / (FLIGHT_BACK / speed));
    }

    function layout() {
      // Right of the text on wide screens, centred on phones (same place as the electronic brain).
      cx = mobile ? w * 0.5 : w * 0.66;
      cy = h * 0.5;
      size = Math.min(mobile ? w * 0.44 : w * 0.33, h * 0.46);
    }

    /** Screen position of a bulb point: centred in the brain, glass slightly above the middle. */
    const bulbX = (k: number) => cx + bulb[k].x * size * BULB_SCALE;
    const bulbYAt = (y: number) => cy + (y + 0.1) * size * BULB_SCALE;
    const bulbY = (k: number) => bulbYAt(bulb[k].y);

    function project(t: number) {
      layout();
      coreX = cx;
      coreY = bulbYAt(-0.3); // centre of the bulb glass: where the sparks and neurons meet
      const bs = size * BULB_SCALE;
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
        const s = k >= 0 ? flight(k, t) : 0;
        mOf[i] = s;
        if (s > 0) {
          // A curve from the neuron's place in the brain, through (near) the centre, to the bulb.
          const ox = coreX + detourX[k] * bs;
          const oy = coreY + detourY[k] * bs;
          const u = 1 - s;
          qx[i] = u * u * px[i] + 2 * u * s * ox + s * s * bulbX(k);
          qy[i] = u * u * py[i] + 2 * u * s * oy + s * s * bulbY(k);
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
      const t = still ? formedAt() + 1 : now - cycleStart;
      const { m, lit: lit0, converging } = phase(t);
      const lit = lit0 * (still ? 1 : 0.88 + 0.12 * Math.sin(now / 420));
      project(t);
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      const bs = size * BULB_SCALE;

      // Nothing is drawn for the bulb itself: its shape and light come only from its neurons.
      // The centre, charged by arriving sparks.
      charge *= Math.exp(-dt / 1600);
      if (charge > 0.01 && m < 1) glowAt(coreX, coreY, 10 + bs * 0.35 * charge, "230, 250, 255", 0.4 * glow * charge * (1 - m));

      // Brain connections: those touching a bulb neuron fade out as it leaves (no stretched lines);
      // the others only dim, so the brain stays around the bulb.
      ctx!.lineWidth = 0.7;
      for (const [a, b] of edges) {
        const d = (pd[a] + pd[b]) / 2;
        const fade = role[a] >= 0 || role[b] >= 0 ? Math.max(0, 1 - 4 * Math.max(mOf[a], mOf[b])) : 1 - 0.5 * m;
        if (fade <= 0.01) continue;
        ctx!.strokeStyle = `rgba(${BASE}, ${(0.08 + 0.34 * d) * fade})`;
        ctx!.beginPath();
        ctx!.moveTo(qx[a], qy[a]);
        ctx!.lineTo(qx[b], qy[b]);
        ctx!.stroke();
      }
      // Neurons, the same size and style as the electronic brain. The bulb's shine brighter than the
      // brain around them (which dims), and its filament turns warm yellow when it is on.
      for (let i = 0; i < nodes.length; i++) {
        const k = role[i];
        const onBulb = k >= 0;
        const s = mOf[i];
        const d = onBulb ? pd[i] + (1 - pd[i]) * s : pd[i];
        const a = onBulb ? 1 : 1 - 0.5 * m;
        const r = (mobile ? 1.3 : 1.7) * (0.6 + 0.7 * d);
        const moving = Math.sin(Math.PI * s); // 0 at rest, 1 mid-flight
        const boost = onBulb ? Math.max(s * (0.35 + 0.65 * lit), moving) : 0; // 0 .. 1: brighter than the brain
        // In flight, the neuron sparkles: a small spark halo around it, as it travels.
        if (moving > 0.05) {
          ctx!.fillStyle = `rgba(${PULSE}, ${0.28 * glow * moving})`;
          ctx!.beginPath();
          ctx!.arc(qx[i], qy[i], 3 + 6 * glow * moving, 0, Math.PI * 2);
          ctx!.fill();
        }
        const warm = onBulb && bulb[k].part === 2 && lit > 0.05;
        ctx!.fillStyle = `rgba(${warm ? WARM : BASE}, ${(0.14 + 0.2 * d + 0.3 * boost) * a})`;
        ctx!.beginPath();
        ctx!.arc(qx[i], qy[i], r * (2.8 + 0.8 * boost), 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = warm
          ? `rgba(255, 232, 160, ${0.75 + 0.25 * lit})`
          : `rgba(${Math.round(110 + 120 * boost)}, ${Math.round(185 + 60 * boost)}, 255, ${(0.5 + 0.5 * d) * a})`;
        ctx!.beginPath();
        ctx!.arc(qx[i], qy[i], r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!still) {
        // Twinkles all over the brain, as in the electronic brain…
        const rate = (mobile ? 18 : 34) * density * (1 - 0.5 * m);
        if (Math.random() < (rate * dt) / 1000)
          sparks.push({
            n: Math.floor(Math.random() * nodes.length),
            born: now,
            life: 700 + Math.random() * 900,
            color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          });
        // …and, once the bulb has formed, its own neurons sparkle far more: that is its light.
        // Filament neurons sparkle warm yellow; the glass and base white, cyan and yellow.
        if (owner.length) {
          const bulbRate = (mobile ? 30 : 55) * m * (0.4 + 0.6 * lit);
          spawnBulb += (bulbRate * dt) / 1000;
          while (spawnBulb >= 1) {
            spawnBulb -= 1;
            const k = Math.floor(Math.random() * owner.length);
            if (mOf[owner[k]] < 0.95) continue; // only neurons already in place: the bulb lights up as it forms
            sparks.push({
              n: owner[k],
              born: now,
              life: 500 + Math.random() * 700,
              color: bulb[k].part === 2 ? WARM : BULB_SPARKS[Math.floor(Math.random() * BULB_SPARKS.length)],
            });
          }
        }
        sparks = sparks.filter((s) => {
          const a = (now - s.born) / s.life;
          if (a >= 1) return false;
          const k = Math.sin(Math.PI * a) * (0.4 + 0.6 * (role[s.n] >= 0 ? Math.max(pd[s.n], mOf[s.n]) : pd[s.n] * (1 - 0.5 * m)));
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
          cycleStart = performance.now() - formedAt();
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
