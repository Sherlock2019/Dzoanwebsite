import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LuDownload } from "react-icons/lu";
import { BackLink, DetailBlock, ExternalLinks, TagList } from "@/components/detail/Detail";
import MediaGallery from "@/components/ui/MediaGallery";
import StatusBadge from "@/components/ui/StatusBadge";
import { getPublishedBySlug } from "@/lib/content";
import { mediaUrl, thumbUrl } from "@/lib/media-url";
import { loadPublicContent } from "@/lib/public-cache";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const STATUS_EXPLAINED: Record<string, string> = {
  Production: "Running in production.",
  POC: "Built and demonstrated as a proof of concept.",
  "Reference Architecture": "A reference pattern showing how the pieces fit together — not a specific deployed system.",
  "Proposed Design": "A proposed target design. Components shown are planned or conceptual unless stated otherwise.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getPublishedBySlug("architectures", (await params).slug);
  if (!a) return { title: "Architecture not found" };
  return {
    title: a.title,
    description: a.summary,
    openGraph: { title: a.title, description: a.summary, images: a.image ? [thumbUrl(a.image)] : undefined },
  };
}

export default async function ArchitecturePage({ params }: Props) {
  const a = await getPublishedBySlug("architectures", (await params).slug);
  if (!a) notFound();
  const { projects } = await loadPublicContent();
  const related = projects.find((p) => p.id === a.related_project);

  return (
    <article className="detail container">
      <BackLink href="/#architectures" label="All architectures" />
      <header className="detail-header">
        <div className="card-badges">
          <StatusBadge status={a.status} />
          {a.tags.map((t) => (
            <span key={t} className="badge tone-gray">
              {t}
            </span>
          ))}
        </div>
        <h1>{a.title}</h1>
        {STATUS_EXPLAINED[a.status] && <p className="status-note">{STATUS_EXPLAINED[a.status]}</p>}
      </header>

      {a.summary && <p className="detail-lead">{a.summary}</p>}
      {a.image && <MediaGallery media={[a.image]} title={a.title} allowDownload={a.allow_download} large />}
      {a.image && a.allow_download && (
        <p>
          <a className="btn btn-outline" href={mediaUrl(a.image.key, { download: true })}>
            <LuDownload aria-hidden /> Download full-resolution diagram
          </a>
        </p>
      )}

      <div className="detail-columns">
        <div>
          <DetailBlock title="Overview" text={a.description} />
          <DetailBlock title="Business use case" text={a.business_context} />
          <DetailBlock title="My role" text={a.contribution} />
        </div>
        <aside>
          <TagList title="Technologies" items={a.technologies} />
          {related && (
            <section className="detail-block">
              <h2>Related project</h2>
              <p>
                <a href={`/projects/${related.slug}`}>{related.title}</a>
              </p>
            </section>
          )}
          <ExternalLinks links={a.links} />
        </aside>
      </div>
    </article>
  );
}
