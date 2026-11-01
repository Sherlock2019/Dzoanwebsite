"use client";

import { useState } from "react";
import { LuImage } from "react-icons/lu";

interface Props {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  width?: number;
  height?: number;
  eager?: boolean;
}

/** Image with a polished placeholder when there is no image or it fails to load. */
export default function MediaImage({ src, alt, label, className, width, height, eager }: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Placeholder label={label || alt} className={className} />;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function Placeholder({ label, className }: { label: string; className?: string }) {
  const letters = label
    .split(/[\s—–-]+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div className={`media-placeholder${className ? ` ${className}` : ""}`} role="img" aria-label={label}>
      <span className="media-placeholder-mark">{letters || <LuImage aria-hidden />}</span>
      <span className="media-placeholder-label">{label}</span>
    </div>
  );
}
