"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LuCalendarCheck, LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuSkipForward } from "react-icons/lu";
import {
  BANNER_CAPTION,
  BOOKING,
  DEFAULT_VARIANT_ID,
  INTRO_ROLE,
  INTRO_TIMING,
  INTRO_VARIANTS,
  QA_NAV_HEADING,
  qaStepMs,
  resolveVariant,
  typedText,
  VARIANT_STORAGE_KEY,
  type IntroSection,
  type Invitation,
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
/** Keys that scroll the sequence by hand. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/** Text with "\n" as line breaks. */
function lines(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/** The saved intro style, if storage is available. */
function readSavedVariant(): string | null {
  try {
    return window.localStorage.getItem(VARIANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveVariant(id: string) {
  try {
    window.localStorage.setItem(VARIANT_STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

interface Booking {
  href: string;
  props: { target?: string; rel?: string };
  label: string;
}

/**
 * The invitation in the bar under slide 2 (beside the arrows and the Book my calendar button):
 * "I'm here. Just book a moment in my calendar—" / "I'll be listening." and the postscript.
 */
function BarInvite({ inv, booking }: { inv: Invitation; booking: Booking }) {
  const flat = (t: string) => t.replace(/\n/g, " ");
  return (
    <div className="hc-invite">
      <p>
        {flat(inv.before)}
        <a className="intro-cta" href={booking.href} {...booking.props}>
          {inv.link}
        </a>
        {lines(inv.after)}
        {inv.end && <strong>{inv.end}</strong>}
      </p>
      <p className="hc-ps">{inv.postscript}</p>
    </div>
  );
}

/**
 * One section of slide 1. A Q&A shows its question and the first `typed` characters of its answer
 * (with a red typing cursor); a stanza shows its first two lines in red, the rest in white; a
 * closing shows its headline, lines and "Then we really need to talk."
 */
function Section({ section, typed }: { section: IntroSection; typed?: number }) {
  if (section.kind === "qa") {
    const shown = typed === undefined ? section.answer : section.answer.slice(0, typed);
    const typing = typed !== undefined;
    return (
      <>
        <p className="intro-topic">{section.topic}</p>
        <h3 className="intro-q">{lines(section.question)}</h3>
        <p className="intro-a">
          {lines(shown)}
          {typing && <span className={`intro-cursor${typed >= section.answer.length ? " is-idle" : ""}`} aria-hidden />}
        </p>
      </>
    );
  }
  if (section.kind === "stanza") {
    const all = section.text.split("\n");
    return (
      <>
        {section.title && <h3 className="intro-poem-title">{section.title}</h3>}
        {section.note && <p className="intro-poem-note">{section.note}</p>}
        <p className="intro-stanza">
          {all.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <span className={i < 2 ? "stanza-red" : undefined}>{line}</span>
            </Fragment>
          ))}
        </p>
      </>
    );
  }
  return (
    <>
      {section.headline && <h3 className="intro-q">{section.headline}</h3>}
      {section.subhead && <p className="intro-a intro-subhead">{lines(section.subhead)}</p>}
      {section.skills && <p className="intro-skills">{section.skills}</p>}
      {section.body?.map((b, i) => (
        <p key={i} className="intro-body">
          {lines(b)}
        </p>
      ))}
      {section.talk && <p className="intro-talk">{section.talk}</p>}
    </>
  );
}

/** Aspect ratio of humanaibrain (2752 × 1536). */
const BRAIN_RATIO = 2752 / 1536;
/** Places in the image, as fractions of its width and height. */
const P = (x: number, y: number) => [x / 2000, y / 1116] as const;
const NEURONS = [P(565, 340), P(565, 492), P(880, 447), P(942, 348), P(413, 573), P(860, 750), P(905, 803)];
const SPARK = P(1140, 540);
const HUMAN_ENDS = [P(960, 352), P(905, 575), P(1010, 640), P(1000, 775), P(930, 470)];
const AI_ENDS = [P(1330, 385), P(1395, 700), P(1300, 560), P(1280, 470), P(1360, 640)];

/**
 * Light drawn over the brain image: the red neurons of the human brain pulse, signals travel
 * along the fibres to the AI brain (warm) and back (cool), the central spark flares as they pass,
 * sparks drift away from it and bokeh floats. Positions follow the image's cover/position crop.
 */
function BrainLights({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const holder = canvas?.parentElement;
    if (!canvas || !ctx || !holder) return;

    interface Fibre {
      a: readonly [number, number];
      c: readonly [number, number];
      b: readonly [number, number];
    }
    interface Pulse {
      f: Fibre;
      start: number;
      dur: number;
      back: boolean;
    }
    interface Mote {
      x: number;
      y: number;
      vx: number;
      vy: number;
      born: number;
      life: number;
    }
    let w = 0;
    let h = 0;
    // Image placement on the canvas (cover + background-position).
    let ix = 0;
    let iy = 0;
    let iw = 0;
    let ih = 0;
    let frame = 0;
    let pulses: Pulse[] = [];
    let sparks: Mote[] = [];
    let nextPulse = 0;
    const phases = NEURONS.map(() => Math.random() * Math.PI * 2);
    const fibres: Fibre[] = [];
    HUMAN_ENDS.forEach((a, i) => {
      for (let k = 0; k < 2; k++) {
        const b = AI_ENDS[(i + k * 2) % AI_ENDS.length];
        const c = [SPARK[0] + (Math.random() - 0.5) * 0.03, SPARK[1] + (Math.random() - 0.5) * 0.08] as const;
        fibres.push({ a, c, b });
      }
    });
    const bokeh = Array.from({ length: 14 }, () => ({
      x: 0.62 + Math.random() * 0.38,
      y: Math.random(),
      r: 0.006 + Math.random() * 0.016,
      vy: -(0.000004 + Math.random() * 0.000008),
      ph: Math.random() * Math.PI * 2,
    }));

    const px = (p: readonly [number, number]) => [ix + p[0] * iw, iy + p[1] * ih] as const;
    const bez = (f: Fibre, t: number) => {
      const [ax, ay] = px(f.a);
      const [cx, cy] = px(f.c);
      const [bx, by] = px(f.b);
      const u = 1 - t;
      return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by] as const;
    };

    function glow(x: number, y: number, r: number, rgb: string, alpha: number) {
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Same crop as the CSS: cover, then background-position (percentages).
      const scale = Math.max(w / BRAIN_RATIO, h);
      iw = scale * BRAIN_RATIO;
      ih = scale;
      const pos = getComputedStyle(holder!).backgroundPosition.split(" ").map((v) => parseFloat(v) / 100);
      ix = (w - iw) * (Number.isFinite(pos[0]) ? pos[0] : 0.5);
      iy = (h - ih) * (Number.isFinite(pos[1]) ? pos[1] : 0.5);
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      const unit = iw / 100; // 1% of the image width

      // Bokeh floating on the AI side.
      for (const b of bokeh) {
        b.y += b.vy * 16;
        if (b.y < -0.05) b.y = 1.05;
        const [x, y] = px([b.x, b.y]);
        glow(x, y, b.r * iw, "150, 190, 230", 0.05 + 0.04 * Math.sin(now * 0.0007 + b.ph));
      }

      // Neurons of the human brain breathing.
      NEURONS.forEach((n, i) => {
        const [x, y] = px(n);
        const s = 0.5 + 0.5 * Math.sin(now * 0.0016 + phases[i]);
        glow(x, y, unit * (1.6 + 1.6 * s), "255, 92, 60", 0.22 + 0.33 * s);
      });

      // Signals along the fibres.
      if (now >= nextPulse) {
        const back = Math.random() < 0.35;
        pulses.push({ f: fibres[Math.floor(Math.random() * fibres.length)], start: now, dur: 1700 + Math.random() * 900, back });
        nextPulse = now + 220 + Math.random() * 380;
      }
      let flare = 0;
      pulses = pulses.filter((p) => {
        const t = (now - p.start) / p.dur;
        if (t >= 1) return false;
        const along = p.back ? 1 - t : t;
        if (Math.abs(along - 0.5) < 0.08) flare = Math.max(flare, 1 - Math.abs(along - 0.5) / 0.08);
        // Warm leaving the human brain, cooling towards the AI brain.
        const k = along;
        const rgb = p.back ? "120, 205, 255" : `${Math.round(255 - 120 * k)}, ${Math.round(150 + 60 * k)}, ${Math.round(80 + 175 * k)}`;
        for (let j = 0; j < 6; j++) {
          const q = Math.max(0, Math.min(1, along + (p.back ? 1 : -1) * j * 0.018));
          const [x, y] = bez(p.f, q);
          glow(x, y, unit * (0.55 - j * 0.06), rgb, 0.75 - j * 0.11);
        }
        return true;
      });

      // The central spark, flaring as signals pass through it, and sparks drifting away.
      const [sx, sy] = px(SPARK);
      const breathe = 0.5 + 0.5 * Math.sin(now * 0.0011);
      glow(sx, sy, unit * (3.5 + 2 * breathe + 4 * flare), "255, 236, 205", 0.18 + 0.12 * breathe + 0.3 * flare);
      if (Math.random() < 0.25 + flare * 0.5) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.012 + Math.random() * 0.03;
        sparks.push({ x: sx, y: sy, vx: Math.cos(ang) * sp * unit, vy: Math.sin(ang) * sp * unit, born: now, life: 1600 + Math.random() * 1800 });
      }
      sparks = sparks.filter((m) => {
        const age = (now - m.born) / m.life;
        if (age >= 1) return false;
        m.x += m.vx;
        m.y += m.vy;
        glow(m.x, m.y, unit * 0.35, "255, 214, 160", 0.8 * (1 - age));
        return true;
      });
      ctx!.globalCompositeOperation = "source-over";
    }

    function tick(now: number) {
      draw(now);
      frame = requestAnimationFrame(tick);
    }

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    if (running) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [running]);
  return <canvas ref={ref} aria-hidden />;
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
 * Home hero carousel.
 * Slide 1, in the version picked with the selector:
 *   - Questions & Answers: one question at a time; it fades in and its answer types out under it,
 *     then it stays a few seconds. "How can I help a …" topic buttons jump to any question (and
 *     pause, so visitors can read); the arrows step through the questions.
 *   - The poem: scrolls slowly and continuously; scrolling by hand holds it for a few seconds.
 *   Both end on "Then we really need to talk." and then move on to slide 2.
 * Slide 2: the banner image, with the calendar invitation in the bar under it.
 */
export default function HeroCarousel({
  banner,
  kicker,
  bookingUrl,
}: {
  banner: BannerImage | null;
  kicker: string;
  bookingUrl: string;
}) {
  const [slide, setSlide] = useState<0 | 1>(0);
  // The server always renders the default style; the saved one is applied after mount.
  const [variantId, setVariantId] = useState(DEFAULT_VARIANT_ID);
  const variant = resolveVariant(variantId);
  const sections = variant.sections;
  const last = sections.length - 1;
  const isQa = variant.id === "qa";
  /** Off only when the visitor presses Pause or picks a topic; Play turns it back on. */
  const [playing, setPlaying] = useState(true);
  /** Short hold that ends by itself: the visitor scrolling the poem by hand. */
  const [reading, setReading] = useState(false);
  const readingTimer = useRef(0);
  const [keyFocus, setKeyFocus] = useState(false);
  const reduced = usePrefersReducedMotion();
  const hidden = useTabHidden();
  // Q&A: the question shown and how much of its answer has been typed.
  const [qaIndex, setQaIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  // Poem: the scrolling box, its stanzas, and the stanza at the reading line (for the counter).
  const scroller = useRef<HTMLDivElement>(null);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  blocks.current.length = sections.length;
  const [pos, setPos] = useState(0);

  useEffect(() => {
    setVariantId(resolveVariant(readSavedVariant()).id);
  }, []);

  const autoplay = slide === 0 && playing && !reading && !hidden && !reduced && !keyFocus;
  const qaCurrent = isQa ? sections[Math.min(qaIndex, last)] : null;
  const fullTyped = qaCurrent ? typedText(qaCurrent).length : 0;

  /** Show another intro style from its start, keeping the paused/playing state. */
  function chooseVariant(id: string) {
    const v = resolveVariant(id);
    saveVariant(v.id);
    if (v.id === variantId) return;
    setVariantId(v.id);
    setQaIndex(0);
    setPos(0);
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }

  // Q&A: type the answer of the shown question (after its question has faded in).
  useEffect(() => {
    if (!isQa || slide !== 0) return;
    if (reduced) {
      setTyped(fullTyped);
      return;
    }
    setTyped(0);
    let n = 0;
    let every = 0;
    const start = window.setTimeout(() => {
      every = window.setInterval(() => {
        n += 1;
        setTyped(n);
        if (n >= fullTyped) window.clearInterval(every);
      }, INTRO_TIMING.typeCharMs);
    }, INTRO_TIMING.fadeMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(every);
    };
  }, [isQa, slide, qaIndex, fullTyped, reduced]);

  // Q&A: the one timer. After fade + typing + hold, show the next question; after the last
  // ("All the above"), move on to slide 2. Any change (topic, pause, slide, unmount) cancels it.
  useEffect(() => {
    if (!isQa || !autoplay || !qaCurrent) return;
    const t = window.setTimeout(() => (qaIndex >= last ? setSlide(1) : setQaIndex(qaIndex + 1)), qaStepMs(qaCurrent));
    return () => window.clearTimeout(t);
  }, [isQa, autoplay, qaIndex, last, qaCurrent]);

  // Poem: scroll slowly and continuously; at the end, pause, then move on to slide 2.
  useEffect(() => {
    if (isQa || !autoplay) return;
    const box = scroller.current;
    if (!box) return;
    let frame = 0;
    let endTimer = 0;
    let lastT = 0;
    let y = box.scrollTop;
    const step = (t: number) => {
      if (lastT) y += (INTRO_TIMING.poemScrollPxPerSec * Math.min(64, t - lastT)) / 1000;
      lastT = t;
      const max = box.scrollHeight - box.clientHeight;
      if (y >= max) {
        box.scrollTop = max;
        endTimer = window.setTimeout(() => setSlide(1), INTRO_TIMING.poemEndHoldMs);
        return;
      }
      box.scrollTop = y;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(endTimer);
    };
  }, [isQa, autoplay]);

  // Poem: the stanza at the reading line, for the counter.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const onScroll = () => {
      const mark = box.scrollTop + box.clientHeight * 0.4;
      let i = 0;
      blocks.current.forEach((el, k) => {
        if (el && el.offsetTop <= mark) i = k;
      });
      setPos(i);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, [isQa]);

  /** The visitor scrolled the poem by hand: hold while they read, then roll on by itself. */
  const manual = useCallback(() => {
    setReading(true);
    window.clearTimeout(readingTimer.current);
    readingTimer.current = window.setTimeout(() => setReading(false), INTRO_TIMING.resumeAfterMs);
  }, []);
  useEffect(() => () => window.clearTimeout(readingTimer.current), []);

  /** Topic button: show that question (and its answer) now, and pause so it can be read. */
  function pickTopic(i: number) {
    setQaIndex(i);
    setPlaying(false);
  }

  function goTo(s: 0 | 1) {
    // Back to slide 1 after the sequence has finished: replay it from the top.
    if (s === 0 && slide === 1) {
      const finished = isQa ? qaIndex >= last : pos >= last;
      if (finished) {
        setQaIndex(0);
        setPos(0);
        scroller.current?.scrollTo({ top: 0, behavior: "auto" });
      }
    }
    setSlide(s);
  }

  // Arrows: on slide 1 in Q&A mode they step through the questions (past the last: slide 2);
  // otherwise they switch slides.
  function next() {
    if (slide === 0 && isQa && qaIndex < last) return setQaIndex(qaIndex + 1);
    goTo(slide === 0 ? 1 : 0);
  }
  function previous() {
    if (slide === 0 && isQa && qaIndex > 0) return setQaIndex(qaIndex - 1);
    if (slide === 1 && isQa) {
      setQaIndex(last);
      return setSlide(0);
    }
    goTo(slide === 0 ? 1 : 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      if (e.key === "ArrowRight") next();
      else previous();
    }
  }

  const booking: Booking = bookingUrl
    ? { href: bookingUrl, props: { target: "_blank", rel: "noopener noreferrer" }, label: BOOKING.label }
    : { href: "#contact", props: {}, label: BOOKING.fallbackLabel };
  const caption = banner?.caption || BANNER_CAPTION;
  const counter = isQa ? qaIndex : pos;

  return (
    <div
      className={`hero-carousel${reduced ? " is-reduced" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onKeyDown={onKeyDown}
    >
      <div className="hero-slides">
        {/* Slide 1 — one question at a time, or the slowly scrolling poem */}
        <div
          className={`hero-slide intro-slide is-${variant.id}${slide === 0 ? " is-active" : ""}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`1 of 2: ${SLIDE_NAMES[0]}`}
          aria-hidden={slide !== 0}
          inert={slide !== 0}
        >
          <div className="intro-bg" aria-hidden>
            <BrainLights running={slide === 0 && !hidden && !reduced} />
          </div>
          <div className="intro-shade" aria-hidden />
          <div className="intro-head">
            {(kicker || INTRO_ROLE) && (
              <div className="intro-id">
                {kicker && <p className="intro-kicker">{kicker}</p>}
                {INTRO_ROLE && <p className="intro-role">{INTRO_ROLE}</p>}
              </div>
            )}
            <div className="intro-style" role="group" aria-label="Intro style">
              {INTRO_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="intro-style-btn"
                  aria-pressed={v.id === variant.id}
                  onClick={() => chooseVariant(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {isQa ? (
            <>
              {/* "How can I help a …": jump to any question (generated from the same content). */}
              <nav className="qa-nav" aria-label="Questions">
                <p className="qa-nav-title">{QA_NAV_HEADING}</p>
                <div className="qa-nav-btns">
                  {sections.map((s, i) =>
                    s.kind === "qa" || s.kind === "closing" ? (
                      <button
                        key={s.id ?? i}
                        type="button"
                        className="qa-nav-btn"
                        aria-pressed={qaIndex === i}
                        onClick={() => pickTopic(i)}
                      >
                        {s.nav ?? `#${i + 1}`}
                      </button>
                    ) : null,
                  )}
                </div>
              </nav>
              <div className="qa-stage">
                {qaCurrent && (
                  <article key={qaIndex} className={`intro-block is-current is-${qaCurrent.kind}`}>
                    <Section section={qaCurrent} typed={qaCurrent.kind === "qa" ? typed : undefined} />
                  </article>
                )}
              </div>
            </>
          ) : (
            <div
              ref={scroller}
              className="intro-scroll is-poem"
              tabIndex={0}
              role="region"
              aria-label={variant.title}
              onWheel={(e) => {
                // Only a wheel that really scrolls the poem counts (not scrolling the page past it).
                const b = e.currentTarget;
                if ((e.deltaY > 0 && b.scrollTop + b.clientHeight < b.scrollHeight - 1) || (e.deltaY < 0 && b.scrollTop > 0)) manual();
              }}
              onTouchMove={manual}
              onPointerDown={(e) => {
                // Dragging the scrollbar (not clicking a link) counts as manual scrolling.
                if (e.target === e.currentTarget) manual();
              }}
              onKeyDown={(e) => {
                if (SCROLL_KEYS.has(e.key) && (e.target === e.currentTarget || e.key !== " ")) manual();
              }}
              onFocus={(e) => setKeyFocus(e.target.matches(":focus-visible"))}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyFocus(false);
              }}
            >
              {sections.map((s, i) => (
                <article
                  key={i}
                  ref={(el) => {
                    blocks.current[i] = el;
                  }}
                  className={`intro-block is-${s.kind}`}
                >
                  <Section section={s} />
                </article>
              ))}
            </div>
          )}
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
        {slide === 1 && <BarInvite inv={variant.invitation} booking={booking} />}
        <button type="button" className="hc-btn" aria-label="Previous" onClick={previous}>
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
        <button type="button" className="hc-btn" aria-label="Next" onClick={next}>
          <LuChevronRight aria-hidden />
        </button>

        {slide === 0 && (
          <>
            {!reduced && (
              <button
                type="button"
                className="hc-btn"
                aria-pressed={!playing}
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <LuPause aria-hidden /> : <LuPlay aria-hidden />}
              </button>
            )}
            <span className="hc-progress">{`${counter + 1} / ${sections.length}`}</span>
            <button type="button" className="hc-btn" onClick={() => setSlide(1)}>
              <LuSkipForward aria-hidden /> Skip to invitation
            </button>
          </>
        )}
        <a className="hc-btn hc-book" href={booking.href} {...booking.props}>
          <LuCalendarCheck aria-hidden /> {booking.label}
        </a>
      </div>
    </div>
  );
}
