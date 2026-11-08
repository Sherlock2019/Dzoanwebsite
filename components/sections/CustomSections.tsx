import type { IconType } from "react-icons";
import { LuDownload, LuExternalLink, LuFileText } from "react-icons/lu";
import Medal from "@/components/ui/Medal";
import MediaImage from "@/components/ui/MediaImage";
import RecommendationIcon from "@/components/ui/RecommendationIcon";
import RichText from "@/components/ui/RichText";
import { fileKind } from "@/lib/file-kind";
import { HONOR_ICONS, SECTION_ICON_MAP } from "@/lib/icons";
import { fullUrl, mediaUrl, thumbUrl } from "@/lib/media-url";
import { hostOf } from "@/lib/text";
import type { CustomSection, SectionEntry } from "@/lib/types";

function Badge({ kind, Icon, honor }: { kind: NonNullable<SectionEntry["badge"]>; Icon: IconType; honor: boolean }) {
  if (kind === "none") return null;
  if (kind === "recommendation") return <RecommendationIcon className="custom-reco" />;
  if (kind === "medal" || honor) return <Medal tone="gold" className="custom-medal" />;
  return (
    <span className="custom-badge" aria-hidden>
      <Icon />
    </span>
  );
}

function Entry({ entry, Icon, honor }: { entry: SectionEntry; Icon: IconType; honor: boolean }) {
  return (
    <article className="custom-card">
      <div className="custom-card-head">
        <Badge kind={entry.badge || "auto"} Icon={Icon} honor={honor} />
        <div>
          {entry.title && <h3>{entry.title}</h3>}
          {entry.subtitle && <p className="custom-subtitle">{entry.subtitle}</p>}
        </div>
      </div>
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
                  <span className="custom-file-kind">{fileKind(f)}</span>
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
      {entry.files.some((f) => f.preview) && (
        <div className="custom-previews">
          {entry.files
            .filter((f) => f.preview)
            .map((f) => (
              <a key={f.key} href={mediaUrl(f.key)} target="_blank" rel="noopener noreferrer" className="custom-preview">
                <img src={mediaUrl(f.preview)} alt={`Page 1 of ${f.filename}`} loading="lazy" decoding="async" />
                <span>
                  <LuFileText aria-hidden /> Page 1 · open the full PDF
                </span>
              </a>
            ))}
        </div>
      )}
    </article>
  );
}

/** Owner-defined sections (e.g. Awards / Recommendations), each with its own sidebar link. */
export default function CustomSections({ sections }: { sections: CustomSection[] }) {
  return (
    <>
      {sections.map((s) => {
        const Icon = SECTION_ICON_MAP[s.icon] || SECTION_ICON_MAP.star;
        const honor = HONOR_ICONS.includes(s.icon);
        return (
          <section key={s.id} id={s.slug} className="section" aria-labelledby={`${s.slug}-title`}>
            <div className="container">
              <div className="section-title">
                <h2 id={`${s.slug}-title`}>{s.title}</h2>
                {/* The intro keeps the owner's line breaks and "- " bullet lists. */}
                <RichText text={s.intro} className={`custom-intro${honor ? " is-honor" : ""}`} />
              </div>
              <div className="custom-grid">
                {s.entries.map((e, i) => (
                  <Entry key={i} entry={e} Icon={Icon} honor={honor} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
