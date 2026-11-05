import MediaImage from "@/components/ui/MediaImage";
import { CATEGORY_ICONS, skillIcon } from "@/lib/icons";
import { thumbUrl } from "@/lib/media-url";
import type { Profile, SkillCategory } from "@/lib/types";
import SectionTitle from "./SectionTitle";

function CategoryColumn({ category }: { category: SkillCategory }) {
  const Icon = CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.other;
  return (
    <div className="skill-column">
      <h3>
        <Icon aria-hidden className="skill-column-icon" /> {category.title}
      </h3>
      {category.description && <p className="skill-column-desc">{category.description}</p>}
      <ul className="skill-list">
        {category.items.map((item) => {
          const ItemIcon = skillIcon(item, category.icon);
          return (
            <li key={item}>
              <ItemIcon aria-hidden className="skill-icon" />
              <span>{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Skills({ profile, skills }: { profile: Profile; skills: SkillCategory[] }) {
  const technical = skills.filter((s) => s.group === "technical");
  const stacks = skills.filter((s) => s.group !== "technical");
  if (!skills.length) return null;

  return (
    <>
      <section id="skills" className="section section-alt" aria-labelledby="skills-title">
        <div className="container">
          <SectionTitle id="skills" title="Skills" intro={profile.positioning} />
          {technical.length > 0 && (
            <div className="skills-grid">
              {technical.map((c) => (
                <CategoryColumn key={c.id} category={c} />
              ))}
            </div>
          )}
        </div>
      </section>
      {stacks.length > 0 && (
        <section id="stacks" className="section" aria-labelledby="stacks-title">
          <div className="container">
            <div className="section-title">
              <h2 id="stacks-title">Business &amp; Human Stack</h2>
              <p>The skills that turn technology into outcomes people can trust and use.</p>
            </div>
            <div className="stacks-grid">
              {stacks.map((c) => {
                const Icon = CATEGORY_ICONS[c.icon] || CATEGORY_ICONS.other;
                return (
                  <article key={c.id} className={`stack-card stack-${c.group}`}>
                    <h3>
                      <Icon aria-hidden /> {c.title}
                    </h3>
                    {c.description && <p>{c.description}</p>}
                    {c.image && (
                      <figure className="stack-image">
                        <MediaImage
                          src={thumbUrl(c.image)}
                          alt={c.image.alt || c.title}
                          label={c.title}
                          width={c.image.width}
                          height={c.image.height}
                        />
                        {c.image.caption && <figcaption>{c.image.caption}</figcaption>}
                      </figure>
                    )}
                    <ul>
                      {c.items.map((item) => {
                        const ItemIcon = skillIcon(item, c.icon);
                        return (
                          <li key={item}>
                            <ItemIcon aria-hidden />
                            <span>{item}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
