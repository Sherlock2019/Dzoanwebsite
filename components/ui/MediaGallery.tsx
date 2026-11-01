"use client";

import { useState } from "react";
import { LuZoomIn } from "react-icons/lu";
import { fullUrl, mediaUrl, thumbUrl } from "@/lib/media-url";
import type { Media } from "@/lib/types";
import ImageViewer from "./ImageViewer";
import MediaImage from "./MediaImage";

/** Thumbnail grid for detail pages; click opens the zoomable viewer. */
export default function MediaGallery({
  media,
  title,
  allowDownload = false,
  large = false,
}: {
  media: Media[];
  title: string;
  allowDownload?: boolean;
  large?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  const images = media.map((m) => ({
    src: fullUrl(m),
    alt: m.alt || title,
    title: m.caption || title,
    caption: m.caption,
    downloadUrl: allowDownload ? mediaUrl(m.key, { download: true }) : undefined,
  }));

  return (
    <>
      <ul className={`media-gallery${large || media.length === 1 ? " is-single" : ""}`}>
        {media.map((m, i) => (
          <li key={m.key}>
            <figure>
              <button type="button" className="media-open" onClick={() => setOpen(i)} aria-label={`View larger: ${m.alt || title}`}>
                <MediaImage
                  src={large || media.length === 1 ? fullUrl(m) : thumbUrl(m)}
                  alt={m.alt || title}
                  label={title}
                  width={m.width}
                  height={m.height}
                />
                <span className="media-zoom-hint" aria-hidden>
                  <LuZoomIn /> Zoom
                </span>
              </button>
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
      {open !== null && <ImageViewer images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
