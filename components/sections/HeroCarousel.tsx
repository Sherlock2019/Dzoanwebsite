"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { LuArrowRight, LuCalendarCheck, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import {
  BANNER_CAPTION,
  BOOKING,
  INTRO_ROLE,
  INTRO_VARIANTS,
  INVITATION,
  POEM,
  QA_CLOSING,
  QA_ITEMS,
  resolveVariant,
  SLIDE_NAMES,
  TALK,
  VARIANT_STORAGE_KEY,
  type Invitation,
  type VariantId,
} from "@/lib/hero-intro";

export interface BannerImage {
  src: string;
  srcSet: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}


/** Text with "\n" as line breaks. */
function lines(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}


interface Booking {
  href: string;
  props: { target?: string; rel?: string };
  label: string;
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

/** Text with its "\n" turned into spaces, for text that flows in a grid cell. */
const flow = (text: string) => text.replace(/\s*\n\s*/g, " ");

/** The saved version of slide 1, if storage is available. */
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

/**
 * The invitation in the bar under slide 2: "I'm here. Just book a moment in my calendar—" /
 * "I'll be listening." and the postscript.
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
 * Slide 1, Q&A version: every question with its answer, then the closing (with `end`, the talk
 * button). On desktop the closing fills the rest of the last grid row, beside the 10th question.
 */
function QaContent({ end }: { end: ReactNode }) {
  return (
    <div className="qa-grid">
      {QA_ITEMS.map((qa) => (
        <article key={qa.topic} className="qa-item">
          <p className="qa-topic">{qa.topic}</p>
          <h3 className="qa-q">{flow(qa.question)}</h3>
          <p className="qa-a">{flow(qa.answer)}</p>
        </article>
      ))}
      <div className="qa-summary">
        <h3 className="qa-summary-title">{QA_CLOSING.headline}</h3>
        <p className="qa-summary-sub">{QA_CLOSING.subhead}</p>
        <p className="intro-skills">{QA_CLOSING.skills}</p>
        <p className="qa-summary-body">{QA_CLOSING.body}</p>
        {end}
      </div>
    </div>
  );
}

/** Slide 1, poem version: the whole poem, stanzas in columns read top to bottom. */
function PoemContent() {
  return (
    <>
      <header className="poem-head">
        <h3 className="intro-poem-title">{POEM.title}</h3>
        <p className="intro-poem-note">{POEM.note}</p>
      </header>
      <div className="poem-cols">
        {POEM.stanzas.map((s, i) => {
          const [first, ...rest] = s.text.split("\n");
          return (
            <p key={i} className="poem-stanza">
              {s.plainLead ? first : <strong className="intro-stanza-lead">{first}</strong>}
              {rest.map((line, j) => (
                <Fragment key={j}>
                  <br />
                  {line}
                </Fragment>
              ))}
            </p>
          );
        })}
      </div>
    </>
  );
}

/**
 * Home hero carousel, navigated by hand (arrows, dots, ← →); nothing moves by itself.
 * Slide 1: the version picked with the selector (all questions & answers, or the whole poem),
 * ending with a "Then we really need to talk. →" button that leads to slide 2.
 * Slide 2: the handshake banner, with the calendar invitation in the bar under it.
 * Only the shown slide takes space, so each slide is as tall as its content (no clipping, no
 * inner scrolling); on small screens the page simply scrolls.
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
  // The server renders the default version; the saved one is applied after mount.
  const [variant, setVariant] = useState<VariantId>(INTRO_VARIANTS[0].id);
  const reduced = usePrefersReducedMotion();
  const hidden = useTabHidden();
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    setVariant(resolveVariant(readSavedVariant()));
  }, []);

  function chooseVariant(id: VariantId) {
    saveVariant(id);
    setVariant(id);
  }

  function goTo(s: 0 | 1) {
    moved.current = true;
    setSlide(s);
  }
  const other = (slide === 0 ? 1 : 0) as 0 | 1;

  // After a change, bring the carousel's top into view if the visitor had scrolled past it
  // (slide 1 can be much taller than slide 2, e.g. the whole poem on a phone).
  useEffect(() => {
    if (!moved.current) return;
    const el = root.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [slide, reduced]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      goTo(other);
    }
  }

  const booking: Booking = bookingUrl
    ? { href: bookingUrl, props: { target: "_blank", rel: "noopener noreferrer" }, label: BOOKING.label }
    : { href: "#contact", props: {}, label: BOOKING.fallbackLabel };
  const caption = banner?.caption || BANNER_CAPTION;
  // The end of slide 1 (both versions): leads to slide 2.
  const talkButton = (
    <button type="button" className="hc-talk-btn" onClick={() => goTo(1)}>
      {TALK} <LuArrowRight aria-hidden />
    </button>
  );
  const slideProps = (i: 0 | 1, extra: string) => ({
    className: `hero-slide ${extra}${slide === i ? " is-active" : ""}`,
    role: "group",
    "aria-roledescription": "slide",
    "aria-label": `${i + 1} of 2: ${SLIDE_NAMES[i]}`,
    "aria-hidden": slide !== i,
    inert: slide !== i,
  });

  return (
    <div
      ref={root}
      className={`hero-carousel${reduced ? " is-reduced" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onKeyDown={onKeyDown}
    >
      <div className="hero-slides">
        {/* Slide 1 — all questions & answers, or the whole poem */}
        <div {...slideProps(0, `intro-slide is-${variant}`)}>
          <div className="intro-bg" aria-hidden>
            <BrainLights running={slide === 0 && !hidden && !reduced} />
          </div>
          <div className="intro-shade" aria-hidden />
          <div className="hc-content">
            <div className="hc-head">
              <div className="intro-id">
                {kicker && <p className="intro-kicker">{kicker}</p>}
                {INTRO_ROLE && <p className="intro-role">{INTRO_ROLE}</p>}
              </div>
              <div className="intro-style" role="group" aria-label="Intro style">
                {INTRO_VARIANTS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="intro-style-btn"
                    aria-pressed={v.id === variant}
                    onClick={() => chooseVariant(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {variant === "qa" ? (
              <QaContent end={talkButton} />
            ) : (
              <>
                <PoemContent />
                {talkButton}
              </>
            )}
          </div>
        </div>

        {/* Slide 2 — Business & Technology: the handshake banner */}
        <div {...slideProps(1, "banner-slide")}>
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
        {slide === 1 && <BarInvite inv={variant === "poem" ? POEM.invitation : INVITATION} booking={booking} />}
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
        <a className="hc-btn hc-book" href={booking.href} {...booking.props}>
          <LuCalendarCheck aria-hidden /> {booking.label}
        </a>
      </div>
    </div>
  );
}
