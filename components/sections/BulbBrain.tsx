"use client";

import { useEffect, useRef } from "react";
import type { DynamicBg } from "@/lib/slide1-bg";
import { inside } from "./ElectroBrain";

// "Idea bulb" background for slide 1 (shared by V2, V3 and V4): the electronic brain where an idea is
// born. Each cycle (~14 s at speed 1): (1) the 3D brain of glowing neurons turns, twinkling; (2) sparks
// start from neurons all over the brain, run along neural pathways and meet in the centre; (3) over
// ~5 s, neurons leave the brain one after another, sparkling as they fly through the centre, and
// gather like drones in a night sky into a small 3D light bulb inside the brain (points on its
// surface, turning with the brain, with the same depth shading), built bottom-up (screw base, neck,
// glass, then the filament), each point the same small neuron as everywhere else;
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

/** The bulb, in the brain's model units (y up), inside the brain: glass sphere centre and radius. */
const GLASS_Y = 0.22;
const GLASS_R = 0.42;
/** The glass is open at the bottom where the neck starts (cosine of the opening, from the centre). */
const GLASS_OPEN = 0.82;
/** Neurons at full bulb size (fewer when the brain has fewer neurons: at most half of them). */
const BULB_FULL = 210;

/**
 * Points on the surface of a 3D light bulb, like drones in the sky: screw base rings, neck, glass
 * sphere (open at the bottom), filament inside. Ordered bottom-up, filament last: the order in
 * which they are built. `f` (0..1) thins every part evenly when fewer neurons are available.
 */
function bulb3D(f: number): (P3 & { part: Part })[] {
  const pts: (P3 & { part: Part })[] = [];
  const n = (count: number) => Math.max(4, Math.round(count * f));
  const ring = (y: number, r: number, count: number, part: Part, turn: number) => {
    const c = n(count);
    for (let i = 0; i < c; i++) {
      const a = turn + (Math.PI * 2 * i) / c;
      pts.push({ x: r * Math.cos(a), y, z: r * Math.sin(a), part });
    }
  };
  // Screw base, from its tip up, then the neck.
  ring(-0.49, 0.07, 6, 1, 0);
  ring(-0.42, 0.15, 14, 1, 0.2);
  ring(-0.35, 0.155, 14, 1, 0.4);
  ring(-0.28, 0.16, 14, 1, 0.6);
  ring(-0.21, 0.17, 12, 0, 0.8);
  ring(-0.155, 0.205, 13, 0, 1);
  // Glass: evenly spread over the sphere (Fibonacci), bottom opening left out, built bottom to top.
  const glass: (P3 & { part: Part })[] = [];
  const total = n(122);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const v = 1 - (2 * (i + 0.5)) / total; // -1 (bottom) .. 1 (top)
    if (v < -GLASS_OPEN) continue;
    const r = Math.sqrt(1 - v * v);
    const a = i * golden;
    glass.push({ x: GLASS_R * r * Math.cos(a), y: GLASS_Y + GLASS_R * v, z: GLASS_R * r * Math.sin(a), part: 0 });
  }
  glass.sort((p, q) => p.y - q.y);
  pts.push(...glass);
  // Filament: two supports and a zigzag, in the middle of the glass. Last: the idea lights up.
  const fil: [number, number][] = [[-0.07, -0.15], [-0.07, 0.12], [-0.035, 0.2], [0, 0.12], [0.035, 0.2], [0.07, 0.12], [0.07, -0.15]];
  const lens = fil.slice(1).map((p, i) => Math.hypot(p[0] - fil[i][0], p[1] - fil[i][1]));
  const length = lens.reduce((s, l) => s + l, 0);
  const c = n(16);
  for (let j = 0; j < c; j++) {
    let d = (length * j) / (c - 1);
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const t = Math.min(1, d / lens[i]);
    pts.push({ x: fil[i][0] + (fil[i + 1][0] - fil[i][0]) * t, y: fil[i][1] + (fil[i + 1][1] - fil[i][1]) * t, z: 0, part: 2 });
  }
  return pts;
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
    // Bulb: target points (3D, brain model units) and which neuron goes to which point.
    let bulb: (P3 & { part: Part })[] = [];
    let owner: number[] = []; // bulb point -> neuron
    let role: Int32Array = new Int32Array(0); // neuron -> bulb point, or -1
    // Per bulb point: when its neuron leaves (forming, dissolving) and a small detour near the centre.
    let leaveAt = new Float32Array(0);
    let returnAt = new Float32Array(0);
    let detourX = new Float32Array(0);
    let detourY = new Float32Array(0);
    let detourZ = new Float32Array(0);
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
      // The 3D bulb, made of neurons picked from all over the brain: at most half of them, so the
      // brain keeps its shape around it.
      const picked = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
      bulb = bulb3D(Math.min(1, nodes.length / 2 / BULB_FULL)).slice(0, Math.floor(nodes.length / 2));
      owner = bulb.map((_, k) => picked[k]);
      role = new Int32Array(nodes.length).fill(-1);
      owner.forEach((n, k) => (role[n] = k));
      // Departures follow the outline (glass, then base, then filament), so the shape is traced
      // progressively, with a little jitter so it feels like a swarm rather than a pen.
      const nb = bulb.length;
      leaveAt = Float32Array.from(bulb, (_, k) => clamp01(k / Math.max(1, nb - 1) + (Math.random() - 0.5) * 0.06));
      returnAt = Float32Array.from(bulb, () => Math.random());
      detourX = Float32Array.from(bulb, () => (Math.random() - 0.5) * 0.3);
      detourY = Float32Array.from(bulb, () => (Math.random() - 0.5) * 0.3);
      detourZ = Float32Array.from(bulb, () => (Math.random() - 0.5) * 0.3);
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

    // One 3D → screen projection for the brain and the bulb alike: same rotation, tilt and
    // perspective, so the bulb turns with the brain and has the same depth shading.
    let rCos = 1;
    let rSin = 0;
    const TILT_C = Math.cos(0.18);
    const TILT_S = Math.sin(0.18);
    let sx = 0;
    let sy = 0;
    let sd = 0;
    function toScreen(mx: number, my: number, mz: number) {
      const x = mx * rCos + mz * rSin;
      const z0 = -mx * rSin + mz * rCos;
      const y = my * TILT_C - z0 * TILT_S;
      const z = my * TILT_S + z0 * TILT_C;
      const persp = 3.2 / (3.2 + z);
      sx = cx + x * size * persp;
      sy = cy - y * size * persp;
      sd = Math.max(0, Math.min(1, (1 - z) / 2)); // depth factor 0 (back) .. 1 (front)
    }

    function project(t: number) {
      layout();
      rCos = Math.cos(angle);
      rSin = Math.sin(angle);
      toScreen(0, GLASS_Y, 0); // centre of the bulb glass: where the sparks and neurons meet
      coreX = sx;
      coreY = sy;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        toScreen(n.x, n.y, n.z);
        px[i] = qx[i] = sx;
        py[i] = qy[i] = sy;
        pd[i] = sd;
        const k = role[i];
        const s = k >= 0 ? flight(k, t) : 0;
        mOf[i] = s;
        if (s > 0) {
          // In 3D: a curve from the neuron's place in the brain, through (near) the centre, to its
          // place on the bulb. Projected like everything else, so depth keeps changing on the way.
          const b = bulb[k];
          const u = 1 - s;
          const ox = detourX[k];
          const oy = GLASS_Y + detourY[k];
          const oz = detourZ[k];
          toScreen(u * u * n.x + 2 * u * s * ox + s * s * b.x, u * u * n.y + 2 * u * s * oy + s * s * b.y, u * u * n.z + 2 * u * s * oz + s * s * b.z);
          qx[i] = sx;
          qy[i] = sy;
          pd[i] = sd;
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
      const bs = size * GLASS_R; // the glass radius on screen

      // Nothing is drawn for the bulb itself: its shape and light come only from its neurons.
      // The centre, charged by arriving sparks.
      charge *= Math.exp(-dt / 1600);
      if (charge > 0.01 && m < 1) glowAt(coreX, coreY, 10 + bs * 0.6 * charge, "230, 250, 255", 0.4 * glow * charge * (1 - m));

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
        // Real depth (back of the bulb dimmer, front brighter: that is what makes it 3D), lifted a little.
        const d = onBulb ? pd[i] + (1 - pd[i]) * 0.35 * s : pd[i];
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
