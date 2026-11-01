"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuDownload,
  LuExternalLink,
  LuMaximize,
  LuScan,
  LuX,
  LuZoomIn,
  LuZoomOut,
} from "react-icons/lu";

export interface ViewerImage {
  src: string;
  alt: string;
  title: string;
  caption?: string;
  downloadUrl?: string;
}

interface Props {
  images: ViewerImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

const MIN = 1;
const MAX = 8;

/**
 * Accessible full-screen viewer for high-resolution diagrams: zoom (buttons, wheel, pinch,
 * keyboard + / - / 0), drag to pan, previous/next, optional download. Escape closes.
 */
export default function ImageViewer({ images, index, onIndex, onClose }: Props) {
  const image = images[index];
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoom = useCallback((factor: number) => {
    setScale((s) => {
      const next = Math.min(MAX, Math.max(MIN, s * factor));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const actualSize = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) return;
    const s = Math.min(MAX, Math.max(MIN, img.naturalWidth / img.clientWidth));
    setScale(s);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      onIndex((index + delta + images.length) % images.length);
      reset();
    },
    [images.length, index, onIndex, reset],
  );

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreFocus.current?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "+" || e.key === "=") zoom(1.25);
    else if (e.key === "-") zoom(0.8);
    else if (e.key === "0") reset();
    else if (e.key === "ArrowRight" && scale === 1) go(1);
    else if (e.key === "ArrowLeft" && scale === 1) go(-1);
    else if (scale > 1 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const step = 60;
      setOffset((o) => ({
        x: o.x + (e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0),
        y: o.y + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0),
      }));
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    } else return;
    e.preventDefault();
  }

  function onWheel(e: React.WheelEvent) {
    zoom(e.deltaY < 0 ? 1.15 : 0.87);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(Math.min(MAX, Math.max(MIN, (pinchStart.current.scale * dist) / pinchStart.current.dist)));
    } else if (pointers.current.size === 1 && scale > 1) {
      setOffset((o) => ({ x: o.x + (e.clientX - prev.x), y: o.y + (e.clientY - prev.y) }));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  if (!image) return null;

  return (
    <div
      ref={dialogRef}
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.title} — image viewer`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="viewer-toolbar">
        <div className="viewer-title">
          <strong>{image.title}</strong>
          {images.length > 1 && (
            <span className="viewer-count">
              {index + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="viewer-actions">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom out" title="Zoom out (−)">
            <LuZoomOut aria-hidden />
          </button>
          <span className="viewer-zoom" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in" title="Zoom in (+)">
            <LuZoomIn aria-hidden />
          </button>
          <button type="button" onClick={reset} aria-label="Fit to screen" title="Fit to screen (0)">
            <LuScan aria-hidden />
          </button>
          <button type="button" onClick={actualSize} aria-label="Actual size" title="Actual size">
            <LuMaximize aria-hidden />
          </button>
          <a href={image.src} target="_blank" rel="noopener noreferrer" aria-label="Open full image in a new tab" title="Open in new tab">
            <LuExternalLink aria-hidden />
          </a>
          {image.downloadUrl && (
            <a href={image.downloadUrl} aria-label="Download image" title="Download">
              <LuDownload aria-hidden />
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Close viewer" title="Close (Esc)" className="viewer-close">
            <LuX aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={`viewer-stage${scale > 1 ? " is-zoomed" : ""}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (scale > 1 ? reset() : zoom(2))}
        onClick={(e) => {
          if (e.target === e.currentTarget && scale === 1) onClose();
        }}
      >
        <img
          ref={imgRef}
          src={image.src}
          alt={image.alt}
          draggable={false}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>

      {images.length > 1 && (
        <>
          <button type="button" className="viewer-nav prev" onClick={() => go(-1)} aria-label="Previous image">
            <LuChevronLeft aria-hidden />
          </button>
          <button type="button" className="viewer-nav next" onClick={() => go(1)} aria-label="Next image">
            <LuChevronRight aria-hidden />
          </button>
        </>
      )}
      {image.caption && <p className="viewer-caption">{image.caption}</p>}
    </div>
  );
}
