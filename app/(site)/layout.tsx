import ChatWidget from "@/components/chat/ChatWidget";
import AdminHotkey from "@/components/layout/AdminHotkey";
import Tracker from "@/components/layout/Tracker";
import { chatEnabled } from "@/lib/ai/config";
import Sidebar, { type NavItem, type Social } from "@/components/layout/Sidebar";
import { getOwnerSession } from "@/lib/auth/guard";
import { citizenshipFlags, languageFlags } from "@/lib/flags";
import { thumbUrl } from "@/lib/media-url";
import { loadPublicContent } from "@/lib/public-cache";
import { siteSections } from "@/lib/section-labels";
import { initials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [content, session] = await Promise.all([loadPublicContent(), getOwnerSession()]);
  const { profile } = content;

  const nav: NavItem[] = siteSections(content).map(({ id, label, icon }) => ({ id, label, icon }));

  const socials: Social[] = [];
  if (profile.linkedin) socials.push({ kind: "linkedin", href: profile.linkedin, label: "LinkedIn profile" });
  if (profile.github) socials.push({ kind: "github", href: profile.github, label: "GitHub profile" });
  if (profile.email) socials.push({ kind: "email", href: `mailto:${profile.email}`, label: `Email ${profile.email}` });
  if (profile.show_phone && profile.phone) {
    socials.push({ kind: "whatsapp", href: `https://wa.me/${profile.phone.replace(/[^0-9]/g, "")}`, label: "WhatsApp" });
  }

  return (
    <div className="site">
      <AdminHotkey />
      {!session && <Tracker />}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        name={profile.name}
        imageUrl={thumbUrl(profile.image)}
        initials={initials(profile.name)}
        socials={socials}
        citizenship={citizenshipFlags(profile.citizenship)}
        languages={languageFlags(profile.languages)}
        nav={nav}
        isOwner={Boolean(session)}
      />
      <main id="main" className="main" tabIndex={-1}>
        {children}
        <footer className="site-footer">
          <p>
            © {new Date().getFullYear()} {profile.name}. Public demo links point to showcase environments, separate from
            confidential customer systems.
          </p>
        </footer>
      </main>
      {chatEnabled() && <ChatWidget name={profile.name} />}
    </div>
  );
}
