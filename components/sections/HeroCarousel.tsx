"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LuCalendarCheck, LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuSkipForward } from "react-icons/lu";
import {
  BANNER_CAPTION,
  BOOKING,
  DEFAULT_VARIANT_ID,
  INTRO_VARIANTS,
  introStep,
  resolveVariant,
  VARIANT_STORAGE_KEY,
  type IntroSection,
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

/** One section of the scrolling sequence. */
function Section({ section, booking }: { section: IntroSection; booking: Booking }) {
  if (section.kind === "qa") {
    return (
      <>
        <p className="intro-topic">{section.topic}</p>
        <h3 className="intro-q">{lines(section.question)}</h3>
        <p className="intro-a">{lines(section.answer)}</p>
      </>
    );
  }
  if (section.kind === "stanza") {
    const [first, ...rest] = section.text.split("\n");
    return (
      <>
        {section.title && <h3 className="intro-poem-title">{section.title}</h3>}
        <p className="intro-stanza">
          <strong className="intro-stanza-lead">{first}</strong>
          {rest.map((line, i) => (
            <Fragment key={i}>
              <br />
              {line}
            </Fragment>
          ))}
        </p>
      </>
    );
  }
  const inv = section.invitation;
  const cta = (
    <div className="intro-closing-cta">
      <p className="intro-invite">
        <strong className="intro-invite-lead">{inv.lead}</strong>
        <br />
        {lines(inv.before)}
        <a className="intro-cta" href={booking.href} {...booking.props}>
          {inv.link}
        </a>
        {lines(inv.after)}
      </p>
      <a className="btn btn-primary intro-book" href={booking.href} {...booking.props}>
        <LuCalendarCheck aria-hidden /> {booking.label}
      </a>
      <p className="intro-ps">{inv.postscript}</p>
    </div>
  );
  if (!section.body?.length) return cta;
  return (
    <>
      {section.headline && <h3 className="intro-q">{section.headline}</h3>}
      {section.skills && <p className="intro-skills">{section.skills}</p>}
      <div className="intro-closing-cols">
        <div>
          {section.body.map((b, i) => (
            <p key={i} className="intro-body">
              {lines(b)}
            </p>
          ))}
        </div>
        {cta}
      </div>
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
 * Slide 1: the chosen intro style (questions & answers, poem, …), one vertical scrolling sequence
 * ending with the closing invitation. It scrolls down by itself (one section at a time, a hold on
 * each) and stops at the invitation; visitors can scroll by hand at any time, which pauses it
 * until Play. Slide 2: the banner image, reached with the Next arrow. There is one timer only.
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
  /** The section the sequence has settled on. */
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** Temporary pauses: pointer over the text, or keyboard focus inside it. */
  const [hovered, setHovered] = useState(false);
  const [keyFocus, setKeyFocus] = useState(false);
  const reduced = usePrefersReducedMotion();
  const hidden = useTabHidden();
  const scroller = useRef<HTMLDivElement>(null);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  blocks.current.length = sections.length;

  useEffect(() => {
    setVariantId(resolveVariant(readSavedVariant()).id);
  }, []);

  /** Show another intro style: back to its top, same paused/playing state. */
  function chooseVariant(id: string) {
    const v = resolveVariant(id);
    saveVariant(v.id);
    if (v.id === variantId) return;
    setVariantId(v.id);
    setPos(0);
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }

  const autoplay = slide === 0 && playing && !hidden && !reduced && !hovered && !keyFocus;

  const scrollToBlock = useCallback(
    (i: number) => {
      const el = blocks.current[i];
      const box = scroller.current;
      if (!el || !box) return;
      box.scrollTo({ top: el.offsetTop, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  // The one timer: after the current block has faded in and been held, scroll to the next.
  // Any change (manual scroll, pause, slide or style change, unmount) cancels it.
  useEffect(() => {
    if (!autoplay) return;
    const step = introStep(pos, sections.length);
    if (!step) return;
    const t = window.setTimeout(() => scrollToBlock(step.next), step.delay);
    return () => window.clearTimeout(t);
  }, [autoplay, pos, sections, scrollToBlock]);

  // Track where the scroll settles (automatic or manual) to know the current block.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let t = 0;
    const settle = () => {
      const mark = box.scrollTop + box.clientHeight * 0.4;
      let i = 0;
      blocks.current.forEach((el, k) => {
        if (el && el.offsetTop <= mark) i = k;
      });
      setPos(i);
    };
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(settle, 140);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(t);
      box.removeEventListener("scroll", onScroll);
    };
  }, []);

  /** Mouse wheel, touch, scrollbar drag or scroll keys: the visitor is reading, stop. */
  const manual = () => setPlaying(false);

  const goTo = (s: 0 | 1) => {
    setSlide(s);
    setPlaying(false); // manual navigation pauses until Play
  };
  const other = (slide === 0 ? 1 : 0) as 0 | 1;

  function togglePlay() {
    if (playing) return setPlaying(false);
    if (pos >= last) scrollToBlock(0); // at the invitation, Play starts again from the top
    setPlaying(true);
  }

  function skipToInvitation() {
    setPlaying(false);
    scrollToBlock(last);
  }

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

  return (
    <div
      className={`hero-carousel${reduced ? " is-reduced" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onKeyDown={onKeyDown}
    >
      <div className="hero-slides">
        {/* Slide 1 — scrolling questions and answers, then the invitation */}
        <div
          className={`hero-slide intro-slide${slide === 0 ? " is-active" : ""}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`1 of 2: ${SLIDE_NAMES[0]}`}
          aria-hidden={slide !== 0}
          inert={slide !== 0}
        >
          <div className="intro-head">
            {kicker && <p className="intro-kicker">{kicker}</p>}
            {INTRO_VARIANTS.length > 1 && (
              // Versions of slide 1, not carousel slides: kept apart from the slide dots.
              <div className="intro-style" role="group" aria-label="Intro style">
                <span className="intro-style-label" aria-hidden>
                  Intro style
                </span>
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
            )}
          </div>
          <div
            ref={scroller}
            className={`intro-scroll is-${variant.id}`}
            tabIndex={0}
            role="region"
            aria-label={variant.title}
            onWheel={manual}
            onTouchStart={manual}
            onPointerDown={(e) => {
              // Dragging the scrollbar (not clicking a link or button) counts as manual scrolling.
              if (e.target === e.currentTarget) manual();
            }}
            onKeyDown={(e) => {
              if (SCROLL_KEYS.has(e.key) && (e.target === e.currentTarget || e.key !== " ")) manual();
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
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
                className={`intro-block is-${s.kind}${pos === i ? " is-current" : ""}`}
              >
                <Section section={s} booking={booking} />
              </article>
            ))}
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

        {slide === 0 && (
          <>
            {!reduced && (
              <button
                type="button"
                className="hc-btn"
                aria-pressed={!playing}
                aria-label={playing ? "Pause automatic scrolling" : "Play automatic scrolling"}
                onClick={togglePlay}
              >
                {playing ? <LuPause aria-hidden /> : <LuPlay aria-hidden />}
              </button>
            )}
            <span className="hc-progress">{pos < last ? `${pos + 1} / ${last}` : "Invitation"}</span>
            <button type="button" className="hc-btn" disabled={pos >= last} onClick={skipToInvitation}>
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
