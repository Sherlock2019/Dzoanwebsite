"use client";

import { useMemo, useState } from "react";
import { LuArrowRight, LuZoomIn } from "react-icons/lu";
import ImageViewer from "@/components/ui/ImageViewer";
import MediaImage from "@/components/ui/MediaImage";
import StatusBadge from "@/components/ui/StatusBadge";
import { fullUrl, mediaUrl, thumbUrl } from "@/lib/media-url";
import { ARCHITECTURE_TAGS } from "@/lib/options";
import type { Architecture, Project } from "@/lib/types";
import FilterBar, { matches } from "./FilterBar";
import SectionTitle from "./SectionTitle";

export default function Architectures({
  architectures,
  projects,
  title = "Architectures",
}: {
  architectures: Architecture[];
  projects: Project[];
  title?: string;
}) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);

  const allTags = [...new Set(architectures.flatMap((a) => a.tags))];
  const filters = [
    ...ARCHITECTURE_TAGS.filter((t) => allTags.includes(t)),
    ...allTags.filter((t) => !(ARCHITECTURE_TAGS as readonly string[]).includes(t)),
  ];
  const shown = useMemo(
    () =>
      architectures.filter(
        (a) =>
          (filter === "All" || a.tags.includes(filter)) &&
          matches(query, [a.title, a.summary, a.status, a.tags, a.technologies]),
      ),
    [architectures, filter, query],
  );
  const withImages = shown.filter((a) => a.image);
  const viewerImages = withImages.map((a) => ({
    src: fullUrl(a.image),
    alt: a.image?.alt || a.title,
    title: a.title,
    caption: `${a.status}${a.summary ? ` — ${a.summary}` : ""}`,
    downloadUrl: a.allow_download && a.image ? mediaUrl(a.image.key, { download: true }) : undefined,
  }));
  const projectTitle = (id: string) => projects.find((p) => p.id === id);

  if (!architectures.length) return null;

  return (
    <section id="architectures" className="section" aria-labelledby="architectures-title">
      <div className="container">
        <SectionTitle
          id="architectures"
          title={title}
          intro="Systems, workflows and reference architectures I designed or contributed to across AI, data, banking, multi-cloud, MLOps and supply chain. Each one is labelled with its real status — most are reference or proposed designs, not deployed systems."
        />
        <FilterBar
          id="architectures"
          label="architectures"
          filters={filters}
          active={filter}
          onFilter={setFilter}
          query={query}
          onQuery={setQuery}
          count={shown.length}
        />
        {shown.length ? (
          <ul className="card-grid arch-grid">
            {shown.map((a) => {
              const related = a.related_project ? projectTitle(a.related_project) : undefined;
              const imageIndex = withImages.indexOf(a);
              return (
                <li key={a.id} className="arch-card">
                  {a.image ? (
                    <button
                      type="button"
                      className="arch-media"
                      onClick={() => setViewing(imageIndex)}
                      aria-label={`Open diagram viewer: ${a.title}`}
                    >
                      <MediaImage src={thumbUrl(a.image)} alt={a.image.alt || a.title} label={a.title} />
                      <span className="media-zoom-hint" aria-hidden>
                        <LuZoomIn /> View &amp; zoom
                      </span>
                    </button>
                  ) : (
                    <div className="arch-media">
                      <MediaImage src="" alt={a.title} label={a.title} />
                    </div>
                  )}
                  <div className="project-body">
                    <div className="card-badges">
                      <StatusBadge status={a.status} />
                    </div>
                    <h3>
                      <a href={`/architectures/${a.slug}`}>{a.title}</a>
                    </h3>
                    {a.summary && <p className="card-summary">{a.summary}</p>}
                    {a.tags.length > 0 && (
                      <ul className="tags" aria-label="Tags">
                        {a.tags.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                    <p className="card-footer-links">
                      <a href={`/architectures/${a.slug}`}>
                        Details <LuArrowRight aria-hidden />
                      </a>
                      {related && <a href={`/projects/${related.slug}`}>Related: {related.title}</a>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-note">No architectures match this filter.</p>
        )}
      </div>
      {viewing !== null && (
        <ImageViewer images={viewerImages} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </section>
  );
}
