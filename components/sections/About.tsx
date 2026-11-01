import { LuChevronRight } from "react-icons/lu";
import Flag from "@/components/layout/Flag";
import MediaImage from "@/components/ui/MediaImage";
import RichText from "@/components/ui/RichText";
import { bioItemFlags } from "@/lib/flags";
import { fullUrl } from "@/lib/media-url";
import { hostOf, initials, phoneDigits } from "@/lib/text";
import type { Profile } from "@/lib/types";
import SectionTitle from "./SectionTitle";

function bioFlags(item: string) {
  const flags = bioItemFlags(item);
  if (!flags.length) return null;
  return (
    <span className="bio-flags">
      {flags.map((f) => (
        <Flag key={f.code} code={f.code} label={f.label} />
      ))}
    </span>
  );
}

export default function About({ profile }: { profile: Profile }) {
  const details: { label: string; value: React.ReactNode }[] = [];
  if (profile.focus) details.push({ label: "Focus", value: profile.focus });
  if (profile.location) details.push({ label: "Location", value: profile.location });
  if (profile.approach) details.push({ label: "Approach", value: profile.approach });
  if (profile.languages) details.push({ label: "Languages", value: profile.languages });
  if (profile.citizenship) details.push({ label: "Citizenship", value: profile.citizenship });
  if (profile.email) details.push({ label: "Email", value: <a href={`mailto:${profile.email}`}>{profile.email}</a> });
  const digits = profile.show_phone ? phoneDigits(profile.phone) : "";
  if (digits)
    details.push({
      label: "WhatsApp",
      value: (
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
          {profile.phone}
        </a>
      ),
    });
  if (profile.linkedin)
    details.push({
      label: "LinkedIn",
      value: (
        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
          {hostOf(profile.linkedin).replace(/^www\./, "")}
          {new URL(profile.linkedin).pathname.replace(/\/$/, "")}
        </a>
      ),
    });

  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <div className="container">
        <div className="about-head">
          <SectionTitle id="about" title="About" />
          {profile.bio && (
            <aside className="about-mission bio-box" aria-label={profile.bio_title || "My bio"}>
              <p className="mission-label">{profile.bio_title || "My Bio"}</p>
              <RichText text={profile.bio} className="bio-text" itemExtra={bioFlags} />
            </aside>
          )}
        </div>
        <div className="about-grid">
          <div className="about-photo">
            {profile.image ? (
              <MediaImage src={fullUrl(profile.image)} alt={profile.image.alt || `Portrait of ${profile.name}`} label={profile.name} />
            ) : (
              <div className="about-initials" role="img" aria-label={`${profile.name} (photo coming soon)`}>
                {initials(profile.name)}
              </div>
            )}
          </div>
          <div className="about-content">
            <h3>{profile.about_title || profile.headline}</h3>
            <RichText text={profile.about} />
            {profile.current_role && (
              <p className="about-current">
                Currently I am working as {profile.current_role}
                {profile.current_company && (
                  <>
                    {" "}at{" "}
                    {profile.current_company_url ? (
                      <a href={profile.current_company_url} target="_blank" rel="noopener noreferrer">
                        {profile.current_company}
                      </a>
                    ) : (
                      profile.current_company
                    )}
                  </>
                )}
                .
              </p>
            )}
            {details.length > 0 && (
              <div className="details-card">
                <dl>
                  {details.map((d) => (
                    <div key={d.label}>
                      <dt>
                        <LuChevronRight aria-hidden /> {d.label}:
                      </dt>
                      <dd>{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
