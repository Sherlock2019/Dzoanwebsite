"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuRotateCcw, LuSkipForward } from "react-icons/lu";
import {
  answerText,
  BANNER_CAPTION,
  INTRO_PAIRS,
  INTRO_START,
  introStep,
  partText,
  type IntroPart,
  type IntroState,
} from "@/lib/hero-intro";

export interface BannerImage {
  src: string;
  srcSet: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}

const SLIDE_NAMES = ["Introduction", "Banner"] as const;

/** Text with "\n" as line breaks. */
function lines(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/** The first `count` characters of an answer, keeping its links. */
function typedAnswer(parts: IntroPart[], count: number, linksFocusable: boolean): ReactNode[] {
  let left = count;
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (left <= 0) return;
    const text = partText(p).slice(0, left);
    left -= text.length;
    out.push(
      typeof p === "string" ? (
        <Fragment key={i}>{lines(text)}</Fragment>
      ) : (
        <a key={i} href={p.href} className="intro-cta" tabIndex={linksFocusable ? 0 : -1}>
          {lines(text)}
        </a>
      ),
    );
  });
  return out;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/**
 * Animated neural network behind the intro: layers of neurons with weighted connections. Signals
 * run forward through the layers (blue, like a forward pass), then back (amber, like
 * backpropagation), and each neuron glows as a signal reaches it. Static when not running.
 */
function NetworkCanvas({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    interface Neuron {
      bx: number;
      by: number;
      x: number;
      y: number;
      ph: number;
      fwd: number; // glow from the forward pass, 0..1
      bwd: number; // glow from the backward pass, 0..1
    }
    interface Link {
      a: Neuron;
      b: Neuron;
      layer: number;
      w: number; // weight 0..1: line strength
    }
    interface Signal {
      link: Link;
      start: number;
      dur: number;
      back: boolean;
    }
    const FWD = "34, 181, 255";
    const BWD = "255, 184, 102";
    const STEP_MS = 430; // time between layers firing
    const PAUSE_MS = 650; // pause at each end of a pass

    let w = 0;
    let h = 0;
    let layers: Neuron[][] = [];
    let links: Link[] = [];
    let signals: Signal[] = [];
    let dust: { x: number; y: number; vx: number; vy: number }[] = [];
    let events: { at: number; layer: number; back: boolean }[] = [];
    let cycleMs = 0;
    let cycleStart = 0;
    let nextEvent = 0;
    let last = 0;
    let frame = 0;

    function build() {
      const count = Math.max(5, Math.min(10, Math.round(w / 130)));
      const perLayer = Math.max(5, Math.min(11, Math.round(h / 58)));
      layers = Array.from({ length: count }, (_, i) => {
        const n = Math.max(3, perLayer - Math.floor(Math.random() * 3));
        const x = w * (0.04 + (0.92 * i) / (count - 1));
        return Array.from({ length: n }, (_, j) => {
          const by = h * (0.08 + (0.84 * (j + 0.5)) / n) + (Math.random() - 0.5) * h * 0.05;
          const bx = x + (Math.random() - 0.5) * 34;
          return { bx, by, x: bx, y: by, ph: Math.random() * Math.PI * 2, fwd: 0, bwd: 0 };
        });
      });
      links = [];
      for (let i = 0; i < layers.length - 1; i++)
        for (const a of layers[i]) for (const b of layers[i + 1]) if (Math.random() < 0.72) links.push({ a, b, layer: i, w: Math.random() });
      dust = Array.from({ length: Math.round((w * h) / 26000) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
      // One training cycle: forward pass layer by layer, pause, backward pass, pause.
      const L = layers.length - 1;
      events = [];
      for (let i = 0; i < L; i++) events.push({ at: i * STEP_MS, layer: i, back: false });
      const backStart = L * STEP_MS + PAUSE_MS;
      for (let i = L - 1; i >= 0; i--) events.push({ at: backStart + (L - 1 - i) * STEP_MS, layer: i, back: true });
      cycleMs = backStart + L * STEP_MS + PAUSE_MS;
      signals = [];
      nextEvent = 0;
      cycleStart = performance.now();
    }

    function fire(layer: number, back: boolean, now: number) {
      for (const link of links) {
        if (link.layer !== layer || Math.random() > 0.42) continue;
        signals.push({ link, start: now + Math.random() * 140, dur: 520 + Math.random() * 320, back });
      }
    }

    function draw(now: number, animate: boolean) {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      ctx!.clearRect(0, 0, w, h);

      // Neurons drift a little around their place.
      for (const layer of layers)
        for (const n of layer) {
          n.x = n.bx + (animate ? Math.sin(now * 0.00045 + n.ph) * 5 : 0);
          n.y = n.by + (animate ? Math.cos(now * 0.0005 + n.ph) * 5 : 0);
          const decay = Math.exp(-dt / 420);
          n.fwd *= decay;
          n.bwd *= decay;
        }

      // Connections: faint, the strongest weights a little brighter.
      ctx!.lineWidth = 0.7;
      ctx!.strokeStyle = `rgba(${FWD}, 0.07)`;
      ctx!.beginPath();
      for (const l of links) {
        if (l.w > 0.75) continue;
        ctx!.moveTo(l.a.x, l.a.y);
        ctx!.lineTo(l.b.x, l.b.y);
      }
      ctx!.stroke();
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = `rgba(${FWD}, 0.15)`;
      ctx!.beginPath();
      for (const l of links) {
        if (l.w <= 0.75) continue;
        ctx!.moveTo(l.a.x, l.a.y);
        ctx!.lineTo(l.b.x, l.b.y);
      }
      ctx!.stroke();

      // Background dust for depth.
      ctx!.fillStyle = "rgba(159, 216, 255, 0.28)";
      for (const d of dust) {
        if (animate) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < 0 || d.x > w) d.vx *= -1;
          if (d.y < 0 || d.y > h) d.vy *= -1;
        }
        ctx!.fillRect(d.x, d.y, 1.2, 1.2);
      }

      // Signals travelling along connections, with a short glowing trail.
      ctx!.globalCompositeOperation = "lighter";
      signals = signals.filter((s) => {
        const p = (now - s.start) / s.dur;
        if (p < 0) return true;
        const target = s.back ? s.link.a : s.link.b;
        if (p >= 1) {
          if (s.back) target.bwd = 1;
          else target.fwd = 1;
          return false;
        }
        const from = s.back ? s.link.b : s.link.a;
        const at = (q: number) => [from.x + (target.x - from.x) * q, from.y + (target.y - from.y) * q];
        const color = s.back ? BWD : FWD;
        const [hx, hy] = at(p);
        const [tx, ty] = at(Math.max(0, p - 0.2));
        ctx!.strokeStyle = `rgba(${color}, 0.5)`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(tx, ty);
        ctx!.lineTo(hx, hy);
        ctx!.stroke();
        ctx!.fillStyle = `rgba(${color}, 0.25)`;
        ctx!.beginPath();
        ctx!.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(${color}, 0.95)`;
        ctx!.beginPath();
        ctx!.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx!.fill();
        return true;
      });

      // Neurons, glowing when a signal has just reached them.
      for (const layer of layers)
        for (const n of layer) {
          if (n.fwd > 0.03) {
            ctx!.fillStyle = `rgba(${FWD}, ${0.35 * n.fwd})`;
            ctx!.beginPath();
            ctx!.arc(n.x, n.y, 3 + 7 * n.fwd, 0, Math.PI * 2);
            ctx!.fill();
          }
          if (n.bwd > 0.03) {
            ctx!.fillStyle = `rgba(${BWD}, ${0.35 * n.bwd})`;
            ctx!.beginPath();
            ctx!.arc(n.x, n.y, 3 + 7 * n.bwd, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      ctx!.globalCompositeOperation = "source-over";
      for (const layer of layers)
        for (const n of layer) {
          ctx!.fillStyle = `rgba(159, 216, 255, ${0.55 + 0.45 * Math.max(n.fwd, n.bwd)})`;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, 2, 0, Math.PI * 2);
          ctx!.fill();
        }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(performance.now(), false);
    }

    function tick(now: number) {
      // Fire the layers whose turn has come in the current training cycle.
      while (nextEvent < events.length && now - cycleStart >= events[nextEvent].at) {
        fire(events[nextEvent].layer, events[nextEvent].back, now);
        nextEvent++;
      }
      if (now - cycleStart >= cycleMs) {
        cycleStart = now;
        nextEvent = 0;
      }
      draw(now, true);
      frame = requestAnimationFrame(tick);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (running) {
      cycleStart = performance.now();
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [running]);
  return <canvas ref={ref} className="intro-canvas" aria-hidden />;
}

/**
 * Home hero carousel. Slide 1: animated questions and answers (one pair at a time). Slide 2: the
 * banner image, shown after the final frame and kept until the visitor replays the intro.
 * There is no independent timer: slide 1 itself moves to slide 2 when its sequence ends.
 */
export default function HeroCarousel({ banner, kicker }: { banner: BannerImage | null; kicker: string }) {
  const [state, setState] = useState<IntroState>(INTRO_START);
  const [playing, setPlaying] = useState(true);
  const reduced = usePrefersReducedMotion();
  const hidden = useTabHidden();
  const { slide, pair } = state;
  const current = INTRO_PAIRS[pair];
  const isLast = pair === INTRO_PAIRS.length - 1;

  // Reduced motion: whole pair at once, no automatic progression.
  const qShown = reduced ? current.question.length : state.q;
  const aShown = reduced ? answerText(current).length : state.a;
  const done = qShown >= current.question.length && aShown >= answerText(current).length;
  const autoplay = slide === 0 && playing && !hidden && !reduced;

  // One pending step at a time; any state change (including manual navigation) cancels it.
  useEffect(() => {
    if (!autoplay) return;
    const step = introStep(state);
    if (!step) return;
    const t = window.setTimeout(() => setState(step.next), step.delay);
    return () => window.clearTimeout(t);
  }, [autoplay, state]);

  const goTo = useCallback((s: 0 | 1) => {
    // Returning to slide 1 always restarts the sequence.
    setState(s === 0 ? INTRO_START : (prev) => ({ ...prev, slide: 1 }));
    if (s === 0) setPlaying(true);
  }, []);
  const toPair = (i: number) => setState({ slide: 0, pair: i, q: 0, a: 0 });
  const other = (slide === 0 ? 1 : 0) as 0 | 1;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      goTo(other);
    }
  }

  const caption = banner?.caption || BANNER_CAPTION;

  return (
    <div
      className={`hero-carousel${reduced ? " is-reduced" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onKeyDown={onKeyDown}
    >
      <div className="hero-slides">
        {/* Slide 1 — animated questions and answers */}
        <div
          className={`hero-slide intro-slide${slide === 0 ? " is-active" : ""}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`1 of 2: ${SLIDE_NAMES[0]}`}
          aria-hidden={slide !== 0}
          inert={slide !== 0}
        >
          <NetworkCanvas running={slide === 0 && !hidden && !reduced} />
          <div className="intro-content">
            {kicker && <p className="intro-kicker">{kicker}</p>}
            <div className="intro-stage">
              {/* Invisible copies of every pair reserve the tallest height: no layout jumps. */}
              {INTRO_PAIRS.map((p, i) => (
                <div key={i} className="intro-pair is-ghost" aria-hidden>
                  <p className="intro-q">{p.question}</p>
                  <p className="intro-a">{typedAnswer(p.answer, Infinity, false)}</p>
                </div>
              ))}
              <div className="intro-pair" aria-hidden={!done}>
                <p className="intro-q">
                  {current.question.slice(0, qShown)}
                  {!reduced && qShown < current.question.length && <span className="intro-cursor" />}
                </p>
                <p className="intro-a">
                  {typedAnswer(current.answer, aShown, done)}
                  {!reduced && qShown >= current.question.length && <span className={`intro-cursor${done ? " is-idle" : ""}`} />}
                </p>
              </div>
            </div>
            {/* Screen readers get each pair once it is complete, not letter by letter. */}
            <p className="sr-only" aria-live="polite">
              {done && slide === 0 ? `${current.question} ${answerText(current)}` : ""}
            </p>
          </div>
        </div>

        {/* Slide 2 — banner image */}
        <div
          className={`hero-slide banner-slide${slide === 1 ? " is-active" : ""}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`2 of 2: ${SLIDE_NAMES[1]}`}
          aria-hidden={slide !== 1}
          inert={slide !== 1}
        >
          {banner ? (
            <figure className="hero-banner">
              <img
                src={banner.src}
                srcSet={banner.srcSet}
                sizes="(max-width: 1023px) 100vw, calc(100vw - 300px)"
                alt={banner.alt}
                width={banner.width}
                height={banner.height}
                fetchPriority="high"
              />
              <figcaption>{caption}</figcaption>
            </figure>
          ) : (
            <div className="hero-banner hero-banner-fallback">
              <p>{caption}</p>
            </div>
          )}
        </div>
      </div>

      <div className="hero-carousel-controls">
        <button type="button" className="hc-btn" aria-label="Previous slide" onClick={() => goTo(other)}>
          <LuChevronLeft aria-hidden />
        </button>
        <div className="hc-dots" role="group" aria-label="Choose slide">
          {SLIDE_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              className="hc-dot"
              aria-label={`Slide ${i + 1}: ${name}`}
              aria-current={slide === i ? "true" : undefined}
              onClick={() => goTo(i as 0 | 1)}
            />
          ))}
        </div>
        <button type="button" className="hc-btn" aria-label="Next slide" onClick={() => goTo(other)}>
          <LuChevronRight aria-hidden />
        </button>

        {slide === 0 ? (
          <>
            {(reduced || !playing) && (
              <>
                <button type="button" className="hc-btn" disabled={pair === 0} onClick={() => toPair(pair - 1)}>
                  Previous question
                </button>
                <button type="button" className="hc-btn" disabled={isLast} onClick={() => toPair(pair + 1)}>
                  Next question
                </button>
              </>
            )}
            {!reduced && (
              <button
                type="button"
                className="hc-btn"
                aria-pressed={!playing}
                aria-label={playing ? "Pause intro" : "Play intro"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <LuPause aria-hidden /> : <LuPlay aria-hidden />}
              </button>
            )}
            <span className="hc-progress" aria-label={`Question ${pair + 1} of ${INTRO_PAIRS.length}`}>
              {pair + 1} / {INTRO_PAIRS.length}
            </span>
            <button type="button" className="hc-btn" onClick={() => goTo(1)}>
              <LuSkipForward aria-hidden /> Skip intro
            </button>
          </>
        ) : (
          <button type="button" className="hc-btn" onClick={() => goTo(0)}>
            <LuRotateCcw aria-hidden /> Replay intro
          </button>
        )}
      </div>
    </div>
  );
}
