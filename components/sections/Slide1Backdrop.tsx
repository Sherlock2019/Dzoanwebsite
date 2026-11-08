"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AIEngine from "./AIEngine";
import ElectroBrain from "./ElectroBrain";
import NeuralBackground from "./NeuralBackground";
import { mediaUrl } from "@/lib/media-url";
import { CURRENT_IMAGE, imageBgUrl, type Slide1Bg } from "@/lib/slide1-bg";

const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/**
 * Muted, looping background video. It plays only while allowed (not paused, on screen, tab
 * visible, no reduced motion); otherwise it stays on its current frame.
 */
function VideoLayer({ src, position, running, onFail }: { src: string; position: { x: number; y: number }; running: boolean; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Checked here too: the page's own reduced-motion flag is only known after the first render.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (running && visible && !reduce) el.play().catch(() => {}); // autoplay may be refused: it just stays still
    else el.pause();
  }, [running, visible, src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={onFail}
      style={{ ...layer, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${position.x}% ${position.y}%` }}
    />
  );
}

/**
 * Background of slide 1 (shared by V2, V3 and V4), as chosen in the dashboard: an animated neural
 * network, a fixed image (cover, focal point, dark overlay) or an uploaded video. Decorative: hidden
 * from screen readers and never in the way of clicks or scrolling. Only one renderer is mounted at a
 * time; a failing canvas, image or video falls back to an image.
 */
export default function Slide1Backdrop({ bg, running }: { bg: Slide1Bg; running: boolean }) {
  const [failed, setFailed] = useState(false);
  const fail = () => setFailed(true);
  const dynamic = bg.type === "dynamic" && !failed;
  const video = bg.type === "video" && !failed && bg.video.media !== null;
  const theme = bg.dynamic.theme;
  // Themes drawn from the electronic-brain image fall back to that image.
  const electro = theme === "electro" || theme === "engine";
  // A failing canvas or video shows a matching image instead.
  const image = failed || bg.type === "video" ? { ...bg.image, source: electro && bg.type === "dynamic" ? ("electro" as const) : ("current" as const) } : bg.image;
  const url = imageBgUrl(image);
  const overlay = dynamic ? bg.dynamic.overlay : video ? bg.video.overlay : image.overlay;
  const imageLayer = (
    <div
      style={{
        ...layer,
        // The current image underneath: shown if an uploaded image fails to load.
        backgroundImage: url === CURRENT_IMAGE.large ? `url("${url}")` : `url("${url}"), url("${CURRENT_IMAGE.large}")`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: `${image.position.x}% ${image.position.y}%`,
      }}
    />
  );

  return (
    <div className="slide1-bg" aria-hidden style={{ ...layer, overflow: "hidden", background: "#030A12" }}>
      {dynamic ? (
        <>
          {theme === "engine" ? (
            <AIEngine settings={bg.dynamic} running={running} onFail={fail} />
          ) : theme === "electro" ? (
            <ElectroBrain settings={bg.dynamic} running={running} onFail={fail} />
          ) : (
            <NeuralBackground key={bg.dynamic.theme} settings={bg.dynamic} running={running} onFail={fail} />
          )}
          {/* Keep the text side (left) quieter and darker. */}
          <div style={{ ...layer, background: "linear-gradient(90deg, rgba(3,10,18,0.85) 0%, rgba(3,10,18,0.45) 38%, rgba(3,10,18,0) 70%)" }} />
        </>
      ) : video ? (
        <>
          {/* The current image shows while the video loads. */}
          {imageLayer}
          <VideoLayer key={bg.video.media!.key} src={mediaUrl(bg.video.media!.key)} position={bg.video.position} running={running} onFail={fail} />
        </>
      ) : (
        imageLayer
      )}
      <div style={{ ...layer, background: `rgba(3, 10, 18, ${overlay})` }} />
    </div>
  );
}
