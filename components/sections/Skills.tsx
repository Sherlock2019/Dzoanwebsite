import MediaImage from "@/components/ui/MediaImage";
import { CATEGORY_COLORS, CATEGORY_ICONS, skillColor, skillIcon } from "@/lib/icons";
import { thumbUrl } from "@/lib/media-url";
import type { Profile, SkillCategory } from "@/lib/types";
import { sectionLabel, sectionShown } from "@/lib/section-labels";
import SectionTitle from "./SectionTitle";

function CategoryColumn({ category }: { category: SkillCategory }) {
  const Icon = CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.other;
  return (
    <div className="skill-column">
      <h3>
        <Icon aria-hidden className="skill-column-icon" style={{ color: CATEGORY_COLORS[category.icon] || CATEGORY_COLORS.other }} />{" "}
        {category.title}
      </h3>
      {category.description && <p className="skill-column-desc">{category.description}</p>}
      <ul className="skill-list">
        {category.items.map((item) => {
          const ItemIcon = skillIcon(item, category.icon);
          return (
            <li key={item}>
              <ItemIcon aria-hidden className="skill-icon" style={{ color: skillColor(item, category.icon) }} />
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
      {sectionShown(profile, "skills") && (
      <section id="skills" className="section section-alt" aria-labelledby="skills-title">
        <div className="container">
          <SectionTitle id="skills" title={sectionLabel(profile, "skills")} intro={profile.positioning} />
          {technical.length > 0 && (
            <div className="skills-grid">
              {technical.map((c) => (
                <CategoryColumn key={c.id} category={c} />
              ))}
            </div>
          )}
        </div>
      </section>
      )}
      {stacks.length > 0 && sectionShown(profile, "stacks") && (
        <section id="stacks" className="section" aria-labelledby="stacks-title">
          <div className="container">
            <div className="section-title">
              <h2 id="stacks-title">{sectionLabel(profile, "stacks")}</h2>
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
                            <ItemIcon aria-hidden style={{ color: skillColor(item, c.icon) }} />
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
