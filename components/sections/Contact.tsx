import { FaGithub, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { LuCalendarCheck, LuDownload, LuMail, LuMapPin, LuPhone } from "react-icons/lu";
import { mediaUrl } from "@/lib/media-url";
import { hostOf, phoneDigits } from "@/lib/text";
import type { Profile } from "@/lib/types";
import SectionTitle from "./SectionTitle";

export default function Contact({ profile }: { profile: Profile }) {
  const cards: { icon: React.ReactNode; label: string; value: string; href?: string; external?: boolean }[] = [];
  if (profile.email) cards.push({ icon: <LuMail />, label: "Email", value: profile.email, href: `mailto:${profile.email}` });
  if (profile.linkedin)
    cards.push({
      icon: <FaLinkedinIn />,
      label: "LinkedIn",
      value: `${hostOf(profile.linkedin).replace(/^www\./, "")}${new URL(profile.linkedin).pathname.replace(/\/$/, "")}`,
      href: profile.linkedin,
      external: true,
    });
  if (profile.github)
    cards.push({
      icon: <FaGithub />,
      label: "GitHub",
      value: `${hostOf(profile.github)}${new URL(profile.github).pathname.replace(/\/$/, "")}`,
      href: profile.github,
      external: true,
    });
  if (profile.show_phone && profile.phone)
    cards.push({
      icon: <FaWhatsapp />,
      label: "WhatsApp",
      value: profile.phone,
      href: `https://wa.me/${profile.phone.replace(/[^0-9]/g, "")}`,
      external: true,
    });
  if (profile.show_phone && profile.phone)
    cards.push({ icon: <LuPhone />, label: "Call", value: profile.phone, href: `tel:+${phoneDigits(profile.phone)}` });
  if (profile.booking_url)
    cards.push({
      icon: <LuCalendarCheck />,
      label: profile.booking_label || "Book an interview",
      value: "Pick a time in my calendar",
      href: profile.booking_url,
      external: true,
    });
  if (profile.location) cards.push({ icon: <LuMapPin />, label: "Location", value: profile.location });

  return (
    <section id="contact" className="section section-alt" aria-labelledby="contact-title">
      <div className="container">
        <SectionTitle
          id="contact"
          title="Contact"
          intro="Open to conversations about AI, data and cloud solution architecture — remote or hybrid. Email is the fastest way to reach me."
        />
        <ul className="contact-grid">
          {cards.map((c) => (
            <li key={c.label} className="contact-card">
              <span className="contact-icon" aria-hidden>
                {c.icon}
              </span>
              <div>
                <h3>{c.label}</h3>
                {c.href ? (
                  <a href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {c.value}
                  </a>
                ) : (
                  <p>{c.value}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {profile.resume && (
          <p className="contact-resume">
            <a className="btn btn-outline" href={mediaUrl(profile.resume.key, { download: true })}>
              <LuDownload aria-hidden /> Download my résumé (PDF)
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
