"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { LuArrowRight, LuCalendarCheck, LuChevronLeft, LuChevronRight, LuPause, LuPlay } from "react-icons/lu";
import type { Slide1Bg } from "@/lib/slide1-bg";
import Slide1Backdrop from "./Slide1Backdrop";
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
  background,
}: {
  banner: BannerImage | null;
  kicker: string;
  bookingUrl: string;
  /** Slide 1 background, as published in the dashboard. */
  background: Slide1Bg;
}) {
  const [slide, setSlide] = useState<0 | 1>(0);
  /** Visitor's Pause/Play for the background animation. */
  const [motionPaused, setMotionPaused] = useState(false);
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
          <Slide1Backdrop bg={background} running={slide === 0 && !hidden && !reduced && !motionPaused} />
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
        {slide === 0 && background.type !== "image" && !reduced && (
          <button
            type="button"
            className="hc-btn"
            aria-pressed={motionPaused}
            aria-label={motionPaused ? "Play background animation" : "Pause background animation"}
            onClick={() => setMotionPaused((m) => !m)}
          >
            {motionPaused ? <LuPlay aria-hidden /> : <LuPause aria-hidden />}
          </button>
        )}
        <a className="hc-btn hc-book" href={booking.href} {...booking.props}>
          <LuCalendarCheck aria-hidden /> {booking.label}
        </a>
      </div>
    </div>
  );
}
