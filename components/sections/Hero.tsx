import { FaWhatsapp } from "react-icons/fa";
import { LuArrowRight, LuCalendarCheck, LuDownload, LuMail, LuNetwork, LuPhone } from "react-icons/lu";
import RichText, { inline } from "@/components/ui/RichText";
import HeroCarousel from "./HeroCarousel";
import Mission from "./Mission";
import { fullUrl, mediaUrl, thumbUrl } from "@/lib/media-url";
import { SITE_VERSION } from "@/lib/site-version";
import { resolveSlide1Bg } from "@/lib/slide1-bg";
import { phoneDigits } from "@/lib/text";
import type { Profile } from "@/lib/types";

export default function Hero({
  profile,
  hasProjects,
  hasArchitectures,
}: {
  profile: Profile;
  hasProjects: boolean;
  hasArchitectures: boolean;
}) {
  const digits = profile.show_phone ? phoneDigits(profile.phone) : "";
  const hasContact = Boolean(profile.email || digits || profile.booking_url);

  return (
    <section id="home" className="hero" aria-labelledby="home-title">
      <HeroCarousel
        kicker={profile.name}
        background={resolveSlide1Bg(profile.slide1_bg, SITE_VERSION)}
        banner={
          profile.hero_image
            ? {
                src: fullUrl(profile.hero_image),
                srcSet: `${thumbUrl(profile.hero_image)} 960w, ${fullUrl(profile.hero_image)} ${profile.hero_image.width || 2048}w`,
                alt: profile.hero_image.alt,
                width: profile.hero_image.width,
                height: profile.hero_image.height,
                caption: profile.hero_image.caption,
              }
            : null
        }
      />
      <div className="hero-inner">
        <p className="hero-kicker">{profile.headline}</p>
        <h2 id="home-title" className="hero-name">
          {profile.name}
        </h2>
        {profile.tagline && <p className="hero-tagline">{inline(profile.tagline)}</p>}
        {profile.mission ? (
          <Mission profile={profile} dark />
        ) : (
          profile.value_proposition && <p className="hero-value">{profile.value_proposition}</p>
        )}
        {profile.hero_description && <p className="hero-description">{profile.hero_description}</p>}

        {(profile.invitation || hasContact) && (
          <div className="invite-card">
            {profile.invitation_title && <h3>{profile.invitation_title}</h3>}
            <RichText text={profile.invitation} className="invite-text" />
            {hasContact && (
              <div className="invite-actions">
                {profile.booking_url && (
                  <a className="btn btn-primary" href={profile.booking_url} target="_blank" rel="noopener noreferrer">
                    <LuCalendarCheck aria-hidden /> {profile.booking_label || "Book an interview"}
                  </a>
                )}
                {digits && (
                  <a className="btn btn-whatsapp" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                    <FaWhatsapp aria-hidden /> WhatsApp {profile.phone}
                  </a>
                )}
                {digits && (
                  <a className="btn btn-light" href={`tel:+${digits}`}>
                    <LuPhone aria-hidden /> Call me
                  </a>
                )}
                {profile.email && (
                  <a className="btn btn-light" href={`mailto:${profile.email}`}>
                    <LuMail aria-hidden /> {profile.email}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="hero-actions">
          {hasProjects && (
            <a className="btn btn-ghost" href="#projects">
              View My Projects <LuArrowRight aria-hidden />
            </a>
          )}
          {hasArchitectures && (
            <a className="btn btn-ghost" href="#architectures">
              <LuNetwork aria-hidden /> Explore Architectures
            </a>
          )}
          {profile.resume && (
            <a className="btn btn-ghost" href={mediaUrl(profile.resume.key, { download: true })}>
              <LuDownload aria-hidden /> Download Résumé
            </a>
          )}
        </div>

        {profile.stats.length > 0 && (
          <dl className="hero-stats">
            {profile.stats.map((s) => (
              <div key={s.label} className="hero-stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
