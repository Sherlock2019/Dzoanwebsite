import { LuDownload, LuFileText } from "react-icons/lu";
import { mediaUrl } from "@/lib/media-url";
import type { Certification, Experience, Profile } from "@/lib/types";
import SectionTitle from "./SectionTitle";

function TimelineItem({ item }: { item: Experience }) {
  const dates = [item.start, item.end].filter(Boolean).join(" – ");
  return (
    <li className="timeline-item">
      <h4>{item.role}</h4>
      {dates && <p className="timeline-dates">{dates}</p>}
      <p className="timeline-org">
        {item.company}
        {item.location ? `, ${item.location}` : ""}
      </p>
      {item.summary && <p className="timeline-summary">{item.summary}</p>}
      {item.bullets.length > 0 && (
        <ul>
          {item.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {item.links.length > 0 && (
        <p className="timeline-links">
          {item.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </p>
      )}
    </li>
  );
}

export default function Resume({
  profile,
  experience,
  certifications,
}: {
  profile: Profile;
  experience: Experience[];
  certifications: Certification[];
}) {
  // Group by region, keeping the first region (most recent) in the wide left column.
  const regions = [...new Set(experience.map((e) => e.region || "Experience"))];
  const [primary, ...others] = regions;
  const left = experience.filter((e) => (e.region || "Experience") === primary);
  const education = certifications.filter((c) => c.kind === "Education");

  return (
    <section id="resume" className="section" aria-labelledby="resume-title">
      <div className="container">
        <SectionTitle id="resume" title="Résumé" />
        {profile.resume && (
          <p className="resume-actions">
            <a className="btn btn-primary" href={mediaUrl(profile.resume.key)} target="_blank" rel="noopener noreferrer">
              <LuFileText aria-hidden /> View Résumé PDF
            </a>
            <a className="btn btn-outline" href={mediaUrl(profile.resume.key, { download: true })}>
              <LuDownload aria-hidden /> Download Résumé PDF
            </a>
          </p>
        )}
        <div className="resume-grid">
          <div>
            <h3 className="resume-heading">{primary ? `Professional Experience — ${primary}` : "Professional Experience"}</h3>
            <ol className="timeline">
              {left.map((item) => (
                <TimelineItem key={item.id} item={item} />
              ))}
            </ol>
          </div>
          <div>
            {others.map((region) => (
              <div key={region}>
                <h3 className="resume-heading">Earlier Experience — {region}</h3>
                <ol className="timeline">
                  {experience
                    .filter((e) => (e.region || "Experience") === region)
                    .map((item) => (
                      <TimelineItem key={item.id} item={item} />
                    ))}
                </ol>
              </div>
            ))}
            {education.length > 0 && (
              <>
                <h3 className="resume-heading">Education &amp; Technical Foundation</h3>
                <ol className="timeline">
                  {education.map((e) => (
                    <li key={e.id} className="timeline-item">
                      <h4>{e.title}</h4>
                      {e.year && <p className="timeline-dates">{e.year}</p>}
                      <p className="timeline-org">{e.issuer}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
