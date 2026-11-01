import { inline } from "@/components/ui/RichText";
import type { Profile } from "@/lib/types";

/** "My mission" + "How I work" flow. `dark` = styled for the Home hero. */
export default function Mission({ profile, dark = false }: { profile: Profile; dark?: boolean }) {
  if (!profile.mission) return null;
  const steps = profile.how_i_work.split(/\s*(?:→|->)\s*/).filter(Boolean);
  return (
    <aside className={`about-mission${dark ? " is-dark" : ""}`} aria-label="My mission">
      <p className="mission-label">My mission</p>
      <p className="about-mission-text">{inline(profile.mission)}</p>
      {steps.length > 0 && (
        <div className="how-i-work">
          <span className="how-label">How I work:</span>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
