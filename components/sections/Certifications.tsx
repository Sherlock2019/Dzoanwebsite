import { LuAward, LuBookOpen, LuExternalLink, LuGraduationCap } from "react-icons/lu";
import type { Certification } from "@/lib/types";
import SectionTitle from "./SectionTitle";

const KIND_ICON = { Certification: LuAward, Course: LuBookOpen, Training: LuBookOpen, Education: LuGraduationCap };

export default function Certifications({ items, title = "Certifications & Learning" }: { items: Certification[]; title?: string }) {
  if (!items.length) return null;
  const groups = [...new Set(items.map((c) => c.group || "Other"))];
  return (
    <section id="certifications" className="section" aria-labelledby="certifications-title">
      <div className="container">
        <SectionTitle
          id="certifications"
          title={title}
          intro="Professional certifications are labelled “Certification”; courses and programmes are labelled “Course”."
        />
        <div className="cert-grid">
          {groups.map((group) => (
            <article key={group} className="cert-card">
              <h3>{group}</h3>
              <ul>
                {items
                  .filter((c) => (c.group || "Other") === group)
                  .map((c) => {
                    const Icon = KIND_ICON[c.kind as keyof typeof KIND_ICON] || LuBookOpen;
                    return (
                      <li key={c.id}>
                        <Icon aria-hidden className={`cert-icon kind-${c.kind.toLowerCase()}`} />
                        <div>
                          <p className="cert-title">
                            {c.url ? (
                              <a href={c.url} target="_blank" rel="noopener noreferrer">
                                {c.title} <LuExternalLink aria-label="(opens in a new tab)" />
                              </a>
                            ) : (
                              c.title
                            )}
                          </p>
                          <p className="cert-meta">
                            <span className={`cert-kind kind-${c.kind.toLowerCase()}`}>{c.kind}</span>
                            {c.status === "In progress" && <span className="cert-kind kind-progress">In progress</span>}
                            {c.issuer && <span>{c.issuer}</span>}
                            {c.year && <span>{c.year}</span>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
