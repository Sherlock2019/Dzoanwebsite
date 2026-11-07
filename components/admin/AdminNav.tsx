"use client";

import { usePathname } from "next/navigation";
import {
  LuAward,
  LuBriefcase,
  LuCode,
  LuExternalLink,
  LuLayers,
  LuLayoutDashboard,
  LuLogOut,
  LuNetwork,
  LuRocket,
  LuSettings,
  LuSparkles,
  LuUser,
} from "react-icons/lu";
import { SECTION_ICON_MAP } from "@/lib/icons";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LuLayoutDashboard },
  { href: "/admin/profile", label: "Profile & résumé", icon: LuUser },
  { href: "/admin/projects", label: "Projects", icon: LuCode },
  { href: "/admin/architectures", label: "Architectures", icon: LuNetwork },
  { href: "/admin/current", label: "Current projects", icon: LuRocket },
  { href: "/admin/experience", label: "Experience", icon: LuBriefcase },
  { href: "/admin/skills", label: "Skills & stacks", icon: LuSettings },
  { href: "/admin/certifications", label: "Certifications", icon: LuAward },
  { href: "/admin/sections", label: "Custom sections", icon: LuLayers },
];

const AI_LINK = { href: "/admin/ai", label: "AI & documents", icon: LuSparkles };

export default function AdminNav({ email, sections = [] }: { email: string; sections?: { id: string; title: string; icon: string }[] }) {
  const path = usePathname();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <aside className="admin-nav">
      <p className="admin-brand">Portfolio admin</p>
      <nav aria-label="Dashboard">
        <ul>
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? path === "/admin" : path === href || (path.startsWith(`${href}/`) && !sections.some((s) => path === `/admin/sections/${s.id}`));
            return (
              <li key={href}>
                <a href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden /> {label}
                </a>
              </li>
            );
          })}
          {sections.map((s) => {
            const href = `/admin/sections/${s.id}`;
            const Icon = SECTION_ICON_MAP[s.icon] || SECTION_ICON_MAP.star;
            const active = path === href;
            return (
              <li key={s.id} className="admin-nav-sub">
                <a href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden /> {s.title}
                </a>
              </li>
            );
          })}
          <li>
            <a href={AI_LINK.href} className={path.startsWith(AI_LINK.href) ? "active" : undefined} aria-current={path.startsWith(AI_LINK.href) ? "page" : undefined}>
              <LuSparkles aria-hidden /> {AI_LINK.label}
            </a>
          </li>
        </ul>
      </nav>
      <div className="admin-nav-foot">
        <a href="/" target="_blank" rel="noopener noreferrer">
          <LuExternalLink aria-hidden /> View site
        </a>
        <p className="hint">{email}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
          <LuLogOut aria-hidden /> Sign out
        </button>
      </div>
    </aside>
  );
}
