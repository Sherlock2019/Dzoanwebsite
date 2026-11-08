"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LuArrowRight, LuCalendarCheck, LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuSkipForward } from "react-icons/lu";
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
import type { Slide1Bg } from "@/lib/slide1-bg";
import Slide1Backdrop from "./Slide1Backdrop";

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
function Section({ section, typed, onTalk }: { section: IntroSection; typed?: number; onTalk?: () => void }) {
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
      {/* "Then we really need to talk. →": leads to slide 2 and its calendar invitation. */}
      {section.talk && (
        <button type="button" className="intro-talk-btn" onClick={onTalk}>
          {section.talk} <LuArrowRight aria-hidden />
        </button>
      )}
    </>
  );
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
  background,
}: {
  banner: BannerImage | null;
  kicker: string;
  bookingUrl: string;
  /** Slide 1 background, as published in the dashboard. */
  background: Slide1Bg;
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
  /** The Pause button also stills the background animation (picking a topic doesn't). */
  const [motionPaused, setMotionPaused] = useState(false);
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
          <Slide1Backdrop bg={background} running={slide === 0 && !hidden && !reduced && !motionPaused} />
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
                    <Section section={qaCurrent} typed={qaCurrent.kind === "qa" ? typed : undefined} onTalk={() => setSlide(1)} />
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
              // A click (or a drag of the scrollbar) holds the poem for a few seconds too.
              onPointerDown={manual}
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
                  <Section section={s} onTalk={() => setSlide(1)} />
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
                onClick={() => {
                  setMotionPaused(playing);
                  setPlaying(!playing);
                }}
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
