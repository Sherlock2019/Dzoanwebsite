"use client";

import { useState, type CSSProperties } from "react";
import NeuralBackground from "./NeuralBackground";
import { CURRENT_IMAGE, imageBgUrl, type Slide1Bg } from "@/lib/slide1-bg";

const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/**
 * Background of slide 1 (shared by V2, V3 and V4), as chosen in the dashboard: the animated neural
 * network, or a fixed image (cover, focal point, dark overlay). Decorative: hidden from screen
 * readers and never in the way of clicks or scrolling. Only one renderer is mounted at a time; a
 * failing canvas or image falls back to the current image.
 */
export default function Slide1Backdrop({ bg, running }: { bg: Slide1Bg; running: boolean }) {
  const [failed, setFailed] = useState(false);
  const dynamic = bg.type === "dynamic" && !failed;
  const image = failed ? { ...bg.image, source: "current" as const } : bg.image;
  const url = imageBgUrl(image);
  const overlay = dynamic ? bg.dynamic.overlay : image.overlay;

  return (
    <div className="slide1-bg" aria-hidden style={{ ...layer, overflow: "hidden", background: "#030A12" }}>
      {dynamic ? (
        <>
          <NeuralBackground key={bg.dynamic.theme} settings={bg.dynamic} running={running} onFail={() => setFailed(true)} />
          {/* Keep the text side (left) quieter and darker. */}
          <div style={{ ...layer, background: "linear-gradient(90deg, rgba(3,10,18,0.85) 0%, rgba(3,10,18,0.45) 38%, rgba(3,10,18,0) 70%)" }} />
        </>
      ) : (
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
      )}
      <div style={{ ...layer, background: `rgba(3, 10, 18, ${overlay})` }} />
    </div>
  );
}
