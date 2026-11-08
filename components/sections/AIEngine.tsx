"use client";

import { useEffect, useRef } from "react";
import { ELECTRO_IMAGE, type DynamicBg } from "@/lib/slide1-bg";

// "AI engine" background for slide 1 (shared by V2, V3 and V4). The electronic brain is the core of
// an engine: Business workflows, Data and MLOps blocks feed it through connectors (packets flow in,
// each block's gear turns), a GPU compute block underneath powers it (load bars, power pulses), and
// the brain sends results out to its outputs (Insights, Automation, Better decisions), which light
// up as they arrive. Decorative and illustrative only.

type Pt = { x: number; y: number };
interface Block {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  kind: "input" | "gpu" | "output";
  glow: number;
}
interface Link {
  from: Pt;
  to: Pt;
  ctrl: Pt;
  color: string;
  out: boolean;
  block: Block;
  power?: boolean;
}
interface Packet {
  link: Link;
  start: number;
  dur: number;
}

const COLORS = {
  business: "255, 190, 90",
  data: "110, 255, 170",
  mlops: "180, 140, 255",
  gpu: "255, 220, 90",
  output: "120, 230, 255",
  line: "80, 160, 255",
};
const SPARKS = ["90, 175, 255", "255, 214, 90", "110, 255, 170"];
/** The brain inside public/electrobrain.webp (1672 × 941): crop box. */
const CROP = { x: 500, y: 20, w: 1170, h: 760 };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function AIEngine({ settings, running, onFail }: { settings: DynamicBg; running: boolean; onFail?: () => void }) {
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
    let core = { x: 0, y: 0, w: 0, h: 0 };
    let blocks: Block[] = [];
    let links: Link[] = [];
    let packets: Packet[] = [];
    let sparks: { x: number; y: number; born: number; life: number; color: string }[] = [];
    let energy = 0.3; // how busy the brain is (rises with incoming packets)
    let frame = 0;
    let visible = true;
    let last = 0;
    let gearAngle = 0;
    const nextSpawn = new Map<Link, number>();

    const img = new Image();
    let imgReady = false;
    img.onload = () => {
      imgReady = true;
      draw(performance.now(), false);
    };
    img.src = ELECTRO_IMAGE.large;

    const bez = (l: Link, t: number): Pt => {
      const u = 1 - t;
      return { x: u * u * l.from.x + 2 * u * t * l.ctrl.x + t * t * l.to.x, y: u * u * l.from.y + 2 * u * t * l.ctrl.y + t * t * l.to.y };
    };

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      mobile = w < 700;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wide = !mobile && w >= 900;
      let bh: number;
      let block: (label: string, x: number, y: number, color: string, kind: Block["kind"], width: number) => Block;
      const make = (height: number) => {
        bh = height;
        block = (label, x, y, color, kind, width) => ({ label, x: x - width / 2, y: y - bh / 2, w: width, h: bh, color, kind, glow: 0 });
      };
      let business: Block, data: Block, mlops: Block, gpu: Block, outs: Block[];
      if (wide) {
        // Wide screens: the engine wraps around the text instead of sitting under it. Inputs in a
        // row in the free band under the header, the brain on the right with GPU compute below
        // it, outputs in a column at the right edge.
        const cw = Math.min(w * 0.22, h * 0.42 * (CROP.w / CROP.h));
        const ch = cw * (CROP.h / CROP.w);
        const cx = w * 0.72;
        core = { x: cx - cw / 2, y: h * 0.54 - ch / 2, w: cw, h: ch };
        make(Math.max(26, Math.min(36, h * 0.05)));
        const bw = Math.min(w * 0.13, 170);
        const rowY = core.y - bh! * 1.6;
        business = block!("Business workflows", w * 0.42, rowY, COLORS.business, "input", bw);
        data = block!("Data", w * 0.57, rowY, COLORS.data, "input", bw * 0.75);
        mlops = block!("MLOps", cx, rowY, COLORS.mlops, "input", bw * 0.85);
        gpu = block!("GPU compute", cx, core.y + ch + bh! * 1.4, COLORS.gpu, "gpu", bw * 1.15);
        const ow = Math.min(w * 0.15, 170);
        outs = ["Insights", "Automation", "Better decisions"].map((l, i) =>
          block!(l, w - ow / 2 - 12, core.y + ch * (0.2 + i * 0.3), COLORS.output, "output", ow),
        );
      } else {
        // Phones and narrow screens: the engine centred, inputs around the brain.
        const U = Math.min(w * 0.95, h * 0.9);
        const cx = w * 0.5;
        const cy = h * 0.5;
        const cw = U * 0.44;
        const ch = cw * (CROP.h / CROP.w);
        core = { x: cx - cw / 2, y: cy - ch / 2 - U * 0.03, w: cw, h: ch };
        make(U * 0.075);
        const bw = U * 0.24;
        business = block!("Business workflows", cx - U * 0.36, cy - U * 0.2, COLORS.business, "input", bw);
        data = block!("Data", cx - U * 0.36, cy + U * 0.13, COLORS.data, "input", bw);
        mlops = block!("MLOps", cx + U * 0.02, cy - U * 0.4, COLORS.mlops, "input", bw);
        gpu = block!("GPU compute", cx, cy + U * 0.42, COLORS.gpu, "gpu", bw * 1.2);
        outs = ["Insights", "Automation", "Better decisions"].map((l, i) =>
          block!(l, cx + U * 0.38, cy - U * 0.17 + i * U * 0.15, COLORS.output, "output", U * 0.2),
        );
      }
      blocks = [business, data, mlops, gpu, ...outs];
      const mid = (b: Block): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      const coreC = { x: core.x + core.w / 2, y: core.y + core.h / 2 };
      links = [];
      const link = (b: Block, from: Pt, to: Pt, out: boolean, power = false) =>
        links.push({ from, to, ctrl: { x: (from.x + to.x) / 2, y: out ? to.y : from.y }, color: b.color, out, block: b, power });
      // Inputs: from the block's bottom (wide row) or right side (narrow) into the brain.
      const inFrom = (b: Block): Pt => (wide ? { x: mid(b).x, y: b.y + b.h } : { x: b.x + b.w, y: mid(b).y });
      link(business, inFrom(business), { x: core.x + core.w * 0.14, y: coreC.y - core.h * 0.1 }, false);
      link(data, inFrom(data), { x: core.x + core.w * 0.3, y: core.y + core.h * 0.18 }, false);
      link(mlops, { x: mid(mlops).x, y: mlops.y + mlops.h }, { x: coreC.x + core.w * 0.02, y: core.y + core.h * 0.12 }, false);
      link(gpu, { x: mid(gpu).x, y: gpu.y }, { x: coreC.x + core.w * 0.08, y: core.y + core.h * 0.86 }, false, true);
      for (const o of outs) link(o, { x: core.x + core.w * 0.9, y: coreC.y }, { x: o.x, y: mid(o).y }, true);
      packets = [];
      sparks = [];
      nextSpawn.clear();
    }

    function drawGear(x: number, y: number, r: number, a: number, color: string) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(a);
      ctx!.strokeStyle = `rgba(${color}, 0.9)`;
      ctx!.lineWidth = Math.max(1, r * 0.22);
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(Math.cos(t) * r * 0.7, Math.sin(t) * r * 0.7);
        ctx!.lineTo(Math.cos(t) * r * 1.15, Math.sin(t) * r * 1.15);
        ctx!.stroke();
      }
      ctx!.beginPath();
      ctx!.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();
    }

    function draw(now: number, animate: boolean) {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (animate) gearAngle += (dt / 1000) * 1.2 * speed;
      ctx!.clearRect(0, 0, w, h);
      const decay = Math.exp(-dt / 900);
      energy = Math.max(0.2, energy * Math.exp(-dt / 2500));

      // Connectors (pipes of the engine).
      for (const l of links) {
        ctx!.strokeStyle = `rgba(${l.power ? COLORS.gpu : COLORS.line}, ${l.power ? 0.35 : 0.28})`;
        ctx!.lineWidth = l.power ? 2.4 : 1.4;
        ctx!.beginPath();
        ctx!.moveTo(l.from.x, l.from.y);
        ctx!.quadraticCurveTo(l.ctrl.x, l.ctrl.y, l.to.x, l.to.y);
        ctx!.stroke();
      }

      // The brain at the core, brighter as it works.
      const pulse = 0.75 + 0.25 * Math.min(1, energy);
      ctx!.save();
      ctx!.globalAlpha = pulse;
      if (imgReady) ctx!.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, core.x, core.y, core.w, core.h);
      ctx!.restore();
      ctx!.globalCompositeOperation = "lighter";
      const g = ctx!.createRadialGradient(core.x + core.w * 0.5, core.y + core.h * 0.45, 0, core.x + core.w * 0.5, core.y + core.h * 0.45, core.w * 0.6);
      g.addColorStop(0, `rgba(90, 190, 255, ${0.16 * glow * energy})`);
      g.addColorStop(1, "rgba(90, 190, 255, 0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(core.x - core.w * 0.2, core.y - core.h * 0.2, core.w * 1.4, core.h * 1.4);

      if (animate) {
        // Sparkles across the brain (blue, yellow, green), more when it's busy.
        if (Math.random() < ((mobile ? 10 : 18) * density * (0.5 + energy) * dt) / 1000)
          sparks.push({
            x: core.x + core.w * (0.12 + Math.random() * 0.8),
            y: core.y + core.h * (0.08 + Math.random() * 0.62),
            born: now,
            life: 600 + Math.random() * 900,
            color: SPARKS[Math.floor(Math.random() * SPARKS.length)],
          });
        sparks = sparks.filter((s) => {
          const a = (now - s.born) / s.life;
          if (a >= 1) return false;
          const k = Math.sin(Math.PI * a);
          ctx!.fillStyle = `rgba(${s.color}, ${0.3 * glow * k})`;
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, 3 + 7 * glow * k, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${s.color}, ${0.9 * k})`;
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });

        // Packets: inputs feed the brain; the busier it is, the more results flow out.
        for (const l of links) {
          const rate = l.out ? (0.5 + 1.6 * Math.min(1, energy)) * density : (l.power ? 1.6 : 0.9) * density;
          const due = nextSpawn.get(l) ?? now + Math.random() * 1500;
          if (now >= due) {
            packets.push({ link: l, start: now, dur: (l.power ? 1100 : 1700) / speed });
            nextSpawn.set(l, now + (1000 / (rate * speed)) * (0.6 + Math.random() * 0.8));
          } else if (!nextSpawn.has(l)) nextSpawn.set(l, due);
        }
        packets = packets.filter((p) => {
          const t = (now - p.start) / p.dur;
          if (t >= 1) {
            if (p.link.out) p.link.block.glow = 1;
            else energy = Math.min(1.4, energy + (p.link.power ? 0.05 : 0.09));
            return false;
          }
          const head = bez(p.link, t);
          const tail = bez(p.link, Math.max(0, t - 0.12));
          ctx!.strokeStyle = `rgba(${p.link.color}, 0.55)`;
          ctx!.lineWidth = p.link.power ? 2.6 : 1.8;
          ctx!.beginPath();
          ctx!.moveTo(tail.x, tail.y);
          ctx!.lineTo(head.x, head.y);
          ctx!.stroke();
          ctx!.fillStyle = `rgba(${p.link.color}, ${0.3 * glow})`;
          ctx!.beginPath();
          ctx!.arc(head.x, head.y, 3 + 5 * glow, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${p.link.color}, 0.95)`;
          ctx!.beginPath();
          ctx!.arc(head.x, head.y, 2, 0, Math.PI * 2);
          ctx!.fill();
          return true;
        });
      }
      ctx!.globalCompositeOperation = "source-over";

      // Blocks: engine parts with a turning gear; GPU with load bars; outputs that light up.
      const font = Math.max(10, Math.min(14, (mobile ? w * 0.028 : w * 0.0115)));
      ctx!.font = `600 ${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx!.textBaseline = "middle";
      for (const b of blocks) {
        b.glow *= decay;
        const lit = b.kind === "output" ? b.glow : b.kind === "gpu" ? 0.4 + 0.4 * Math.min(1, energy) : 0.35;
        ctx!.fillStyle = "rgba(4, 14, 30, 0.88)";
        roundRect(ctx!, b.x, b.y, b.w, b.h, b.h * 0.3);
        ctx!.fill();
        ctx!.strokeStyle = `rgba(${b.color}, ${0.45 + 0.5 * lit})`;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
        if (lit > 0.05) {
          ctx!.save();
          ctx!.shadowColor = `rgba(${b.color}, ${0.7 * glow * lit})`;
          ctx!.shadowBlur = 16 * glow * lit;
          ctx!.stroke();
          ctx!.restore();
        }
        const pad = b.h * 0.5;
        if (b.kind === "input") drawGear(b.x + pad, b.y + b.h / 2, b.h * 0.24, gearAngle * (b.label === "Data" ? -1 : 1), b.color);
        if (b.kind === "gpu") {
          // Load bars, busier when the engine works.
          for (let i = 0; i < 5; i++) {
            const level = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.004 * speed * (animate ? 1 : 0) + i * 1.3)) * Math.min(1, 0.4 + energy * 0.6);
            const bh2 = b.h * 0.6 * level;
            ctx!.fillStyle = `rgba(${b.color}, 0.85)`;
            ctx!.fillRect(b.x + pad * 0.5 + i * b.h * 0.16, b.y + b.h * 0.8 - bh2, b.h * 0.1, bh2);
          }
        }
        if (b.kind === "output") {
          ctx!.fillStyle = `rgba(${b.color}, ${0.5 + 0.5 * lit})`;
          ctx!.beginPath();
          ctx!.arc(b.x + pad * 0.8, b.y + b.h / 2, b.h * 0.12 + b.h * 0.06 * lit, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = "rgba(225, 238, 255, 0.95)";
        const textX = b.x + (b.kind === "gpu" ? pad * 0.5 + 5 * b.h * 0.16 + 6 : b.kind === "output" ? pad * 1.5 : pad * 1.9);
        ctx!.fillText(b.label, textX, b.y + b.h / 2, b.w - (textX - b.x) - 6);
      }
      // On phones the text covers the whole width: keep the engine further in the background.
      if (mobile) {
        ctx!.fillStyle = "rgba(3, 10, 18, 0.55)";
        ctx!.fillRect(0, 0, w, h);
      }
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
        packets = [];
        sparks = [];
        draw(performance.now(), false); // the engine, still
      }
    };
    control.current = sync;

    layout();
    draw(performance.now(), false);
    sync();
    const ro = new ResizeObserver(() => {
      layout();
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
      img.onload = null;
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
