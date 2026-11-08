import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, DetailBlock, ExternalLinks, TagList } from "@/components/detail/Detail";
import DownloadGate from "@/components/ui/DownloadGate";
import MediaGallery from "@/components/ui/MediaGallery";
import StatusBadge from "@/components/ui/StatusBadge";
import { getPublishedBySlug } from "@/lib/content";
import { formatDate } from "@/lib/text";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublishedBySlug("current", (await params).slug);
  return p ? { title: p.title, description: p.summary } : { title: "Project not found" };
}

export default async function CurrentProjectPage({ params }: Props) {
  const p = await getPublishedBySlug("current", (await params).slug);
  if (!p) notFound();

  return (
    <article className="detail container">
      <BackLink href="/#current" label="All project details" />
      <header className="detail-header">
        <div className="card-badges">
          <StatusBadge status={p.stage} />
          <span className="card-date">Updated {formatDate(p.updated_on || p.updated_at)}</span>
        </div>
        <h1>{p.title}</h1>
      </header>
      {p.summary && <p className="detail-lead">{p.summary}</p>}
      <MediaGallery media={p.media} title={p.title} />
      <div className="detail-columns">
        <div>
          <DetailBlock title="Current objective" text={p.objective} />
          <DetailBlock title="What I am working on" text={p.working_on} />
          <DetailBlock title="Details" text={p.details} />
          {p.diagrams.length > 0 && (
            <section className="detail-block">
              <h2>Architecture diagrams</h2>
              <MediaGallery media={p.diagrams} title={`${p.title} — diagram`} />
            </section>
          )}
        </div>
        <aside>
          {(p.downloads || []).length > 0 && (
            <section className="detail-block">
              <h2>Full project details</h2>
              <div className="download-row">
                {p.downloads.map((f, i) => (
                  <DownloadGate key={i} projectId={p.id} index={i} filename={f.filename} projectTitle={p.title} />
                ))}
              </div>
            </section>
          )}
          <TagList title="Technologies" items={p.technologies} />
          <ExternalLinks links={p.links} />
        </aside>
      </div>
    </article>
  );
}
