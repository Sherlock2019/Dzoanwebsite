import DownloadGate from "@/components/ui/DownloadGate";
import MediaImage from "@/components/ui/MediaImage";
import StatusBadge from "@/components/ui/StatusBadge";
import { thumbUrl } from "@/lib/media-url";
import { formatDate } from "@/lib/text";
import type { CurrentProject } from "@/lib/types";
import SectionTitle from "./SectionTitle";

/** Button text when a project has a single gated file (with several, each shows its filename). */
export const DOWNLOAD_LABEL = "Projects Portfolio Download";

export default function CurrentProjects({ items }: { items: CurrentProject[] }) {
  if (!items.length) return null;
  return (
    <section id="current" className="section section-alt" aria-labelledby="current-title">
      <div className="container">
        <SectionTitle
          id="current"
          title="Full Project Details"
          intro="In-depth write-ups of my projects: the problem, architecture, key decisions and results. Confirm your email to download."
        />
        <ul className="card-grid">
          {items.map((p) => {
            const cover = p.media[0] || p.diagrams[0];
            return (
              <li key={p.id} className="project-card current-card">
                <div className="project-media">
                  <MediaImage src={thumbUrl(cover)} alt={cover?.alt || p.title} label={p.title} />
                </div>
                <div className="project-body">
                  <div className="card-badges">
                    <StatusBadge status={p.stage} />
                    <span className="card-date">Updated {formatDate(p.updated_on || p.updated_at)}</span>
                  </div>
                  <h3>
                    <a href={`/current/${p.slug}`} className="stretched-link">
                      {p.title}
                    </a>
                  </h3>
                  {p.summary && <p className="card-summary">{p.summary}</p>}
                  {p.technologies.length > 0 && (
                    <ul className="tags" aria-label="Technologies">
                      {p.technologies.slice(0, 5).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {p.downloads.length > 0 && (
                    <div className="download-row">
                      {p.downloads.map((f, i) => (
                        <DownloadGate
                          key={i}
                          projectId={p.id}
                          index={i}
                          filename={f.filename}
                          projectTitle={p.title}
                          label={p.downloads.length === 1 ? DOWNLOAD_LABEL : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
