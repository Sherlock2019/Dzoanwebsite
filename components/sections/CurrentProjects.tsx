import MediaImage from "@/components/ui/MediaImage";
import StatusBadge from "@/components/ui/StatusBadge";
import { thumbUrl } from "@/lib/media-url";
import { formatDate } from "@/lib/text";
import type { CurrentProject } from "@/lib/types";
import SectionTitle from "./SectionTitle";

export default function CurrentProjects({ items }: { items: CurrentProject[] }) {
  if (!items.length) return null;
  return (
    <section id="current" className="section section-alt" aria-labelledby="current-title">
      <div className="container">
        <SectionTitle id="current" title="Current Projects" intro="What I am working on now. Most recently updated first." />
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
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
