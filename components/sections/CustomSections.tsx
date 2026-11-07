import { LuDownload, LuExternalLink, LuFileText } from "react-icons/lu";
import MediaImage from "@/components/ui/MediaImage";
import RichText from "@/components/ui/RichText";
import { fullUrl, mediaUrl, thumbUrl } from "@/lib/media-url";
import { hostOf } from "@/lib/text";
import type { CustomSection, SectionEntry } from "@/lib/types";
import SectionTitle from "./SectionTitle";

function Entry({ entry }: { entry: SectionEntry }) {
  return (
    <article className="custom-card">
      {entry.title && <h3>{entry.title}</h3>}
      {entry.subtitle && <p className="custom-subtitle">{entry.subtitle}</p>}
      {entry.images.length > 0 && (
        <div className={`custom-images${entry.images.length > 1 ? " is-multi" : ""}`}>
          {entry.images.map((m) => (
            <figure key={m.key}>
              <a href={fullUrl(m)} target="_blank" rel="noopener noreferrer">
                <MediaImage src={thumbUrl(m)} alt={m.alt || entry.title} label={entry.title || "Image"} width={m.width} height={m.height} />
              </a>
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <RichText text={entry.text} />
      {(entry.files.length > 0 || entry.url) && (
        <ul className="custom-links">
          {entry.files.map((f) => {
            const isPdf = f.key.endsWith(".pdf");
            return (
              <li key={f.key}>
                <a href={mediaUrl(f.key)} {...(isPdf ? { target: "_blank", rel: "noopener noreferrer" } : { download: f.filename })}>
                  {isPdf ? <LuFileText aria-hidden /> : <LuDownload aria-hidden />}
                  <span>{f.filename}</span>
                  <span className="custom-file-kind">{isPdf ? "PDF" : "Word"}</span>
                </a>
              </li>
            );
          })}
          {entry.url && (
            <li>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                <LuExternalLink aria-hidden />
                <span>{entry.url_label || hostOf(entry.url)}</span>
              </a>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

/** Owner-defined sections (e.g. Awards / Recommendations), each with its own sidebar link. */
export default function CustomSections({ sections }: { sections: CustomSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.id} id={s.slug} className="section" aria-labelledby={`${s.slug}-title`}>
          <div className="container">
            <SectionTitle id={s.slug} title={s.title} intro={s.intro} />
            <div className="custom-grid">
              {s.entries.map((e, i) => (
                <Entry key={i} entry={e} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
