import { LuArrowLeft, LuExternalLink, LuGithub, LuPlay } from "react-icons/lu";
import RichText from "@/components/ui/RichText";
import type { Link } from "@/lib/types";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="back-link" href={href}>
      <LuArrowLeft aria-hidden /> {label}
    </a>
  );
}

export function DetailBlock({ title, text }: { title: string; text: string }) {
  if (!text?.trim()) return null;
  return (
    <section className="detail-block">
      <h2>{title}</h2>
      <RichText text={text} />
    </section>
  );
}

export function TagList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="detail-block">
      <h2>{title}</h2>
      <ul className="tags tags-lg">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

/** External links: open safely in a new tab; demo servers are flagged as possibly unavailable. */
export function ExternalLinks({ demo, repo, links }: { demo?: string; repo?: string; links: Link[] }) {
  if (!demo && !repo && links.length === 0) return null;
  const insecure = [demo, ...links.map((l) => l.url)].some((u) => u?.startsWith("http://"));
  return (
    <section className="detail-block">
      <h2>Links</h2>
      <p className="detail-links">
        {demo && (
          <a className="btn btn-primary" href={demo} target="_blank" rel="noopener noreferrer">
            <LuPlay aria-hidden /> Open public demo <LuExternalLink aria-label="(opens in a new tab)" />
          </a>
        )}
        {repo && (
          <a className="btn btn-outline" href={repo} target="_blank" rel="noopener noreferrer">
            <LuGithub aria-hidden /> Source code <LuExternalLink aria-label="(opens in a new tab)" />
          </a>
        )}
        {links.map((l) => (
          <a key={l.url} className="btn btn-outline" href={l.url} target="_blank" rel="noopener noreferrer">
            {l.label} <LuExternalLink aria-label="(opens in a new tab)" />
          </a>
        ))}
      </p>
      {demo && (
        <p className="detail-note">
          Demos run on a separate showcase server, not on customer systems, and may be temporarily unavailable.
          {insecure ? " Some links use plain HTTP." : ""}
        </p>
      )}
    </section>
  );
}
