import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, DetailBlock, ExternalLinks, TagList } from "@/components/detail/Detail";
import MediaGallery from "@/components/ui/MediaGallery";
import MediaImage from "@/components/ui/MediaImage";
import StatusBadge from "@/components/ui/StatusBadge";
import { getPublishedBySlug } from "@/lib/content";
import { thumbUrl } from "@/lib/media-url";
import { loadPublicContent } from "@/lib/public-cache";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getPublishedBySlug("projects", (await params).slug);
  if (!project) return { title: "Project not found" };
  const image = project.media[0] ? thumbUrl(project.media[0]) : undefined;
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: project.title, description: project.summary, images: image ? [image] : undefined },
  };
}

export default async function ProjectPage({ params }: Props) {
  const project = await getPublishedBySlug("projects", (await params).slug);
  if (!project) notFound();
  const { architectures } = await loadPublicContent();
  const related = architectures.filter(
    (a) => project.related_architectures.includes(a.id) || a.related_project === project.id,
  );

  return (
    <article className="detail container">
      <BackLink href="/#projects" label="All projects" />
      <header className="detail-header">
        <div className="card-badges">
          <StatusBadge status={project.status} />
          {project.categories.map((c) => (
            <span key={c} className="badge tone-gray">
              {c}
            </span>
          ))}
        </div>
        <h1>{project.title}</h1>
        {project.subtitle && <p className="detail-subtitle">{project.subtitle}</p>}
        {project.context && <p className="detail-context">{project.context}</p>}
        {project.status_note && <p className="status-note">{project.status_note}</p>}
      </header>

      {project.summary && <p className="detail-lead">{project.summary}</p>}
      <MediaGallery media={project.media} title={project.title} />

      <div className="detail-columns">
        <div>
          <DetailBlock title="Problem & business context" text={project.problem} />
          <DetailBlock title="My role & contribution" text={project.role} />
          <DetailBlock title="What I built or designed" text={project.implementation} />
          <DetailBlock title="Architecture & workflow" text={project.architecture} />
          <DetailBlock title="Outcomes" text={project.outcomes} />
        </div>
        <aside>
          <section className="detail-block">
            <h2>Delivery stage</h2>
            <p>
              <StatusBadge status={project.status} />
            </p>
          </section>
          <TagList title="Technologies" items={project.technologies} />
          <ExternalLinks demo={project.demo_url} repo={project.repo_url} links={project.links} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="detail-block">
          <h2>Related architectures</h2>
          <ul className="related-grid">
            {related.map((a) => (
              <li key={a.id}>
                <a href={`/architectures/${a.slug}`} className="related-card">
                  <MediaImage src={thumbUrl(a.image)} alt={a.image?.alt || a.title} label={a.title} />
                  <span>
                    <StatusBadge status={a.status} />
                    <strong>{a.title}</strong>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
