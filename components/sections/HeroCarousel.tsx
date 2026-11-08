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

/** Subtle animated network of blue nodes behind the intro. Static when not running. */
function NetworkCanvas({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    let frame = 0;
    const LINK = 130;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.max(18, Math.round((w * h) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }));
      draw();
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx!.strokeStyle = `rgba(34, 181, 255, ${0.22 * (1 - d / LINK)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }
      ctx!.fillStyle = "rgba(159, 216, 255, 0.7)";
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function tick() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      draw();
      frame = requestAnimationFrame(tick);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (running) frame = requestAnimationFrame(tick);
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
