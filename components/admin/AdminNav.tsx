"use client";

import { usePathname } from "next/navigation";
import {
  LuActivity,
  LuAward,
  LuBriefcase,
  LuCode,
  LuExternalLink,
  LuImage,
  LuLayers,
  LuLayoutDashboard,
  LuListOrdered,
  LuLogOut,
  LuNetwork,
  LuRocket,
  LuSettings,
  LuSparkles,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import { SECTION_ICON_MAP } from "@/lib/icons";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LuLayoutDashboard },
  { href: "/admin/profile#menu-sections", label: "Menu: names & order", icon: LuListOrdered },
  { href: "/admin/profile", label: "Profile & résumé", icon: LuUser },
  { href: "/admin/background", label: "Slide 1 background", icon: LuImage },
  { href: "/admin/projects", label: "Projects", icon: LuCode },
  { href: "/admin/architectures", label: "Architectures", icon: LuNetwork },
  { href: "/admin/current", label: "Full resume portfolio", icon: LuRocket },
  { href: "/admin/experience", label: "Experience", icon: LuBriefcase },
  { href: "/admin/skills", label: "Skills & stacks", icon: LuSettings },
  { href: "/admin/certifications", label: "Certifications", icon: LuAward },
  { href: "/admin/sections", label: "Custom sections", icon: LuLayers },
];

const AI_LINK = { href: "/admin/ai", label: "AI & documents", icon: LuSparkles };
const ANALYTICS_LINK = { href: "/admin/analytics", label: "Visitors & heatmap", icon: LuActivity };

interface Visitors {
  today: number;
  week: number;
  month: number;
}

export default function AdminNav({
  email,
  sections = [],
  visitors,
}: {
  email: string;
  sections?: { id: string; title: string; icon: string }[];
  visitors?: Visitors;
}) {
  const path = usePathname();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <aside className="admin-nav">
      <p className="admin-brand">Portfolio admin</p>
      {visitors && (
        <a href={ANALYTICS_LINK.href} className="visitor-counter" aria-label={`Visitors: ${visitors.today} today, ${visitors.week} in 7 days, ${visitors.month} in 30 days`}>
          <span>
            <strong>{visitors.today}</strong> today
          </span>
          <span>
            <strong>{visitors.week}</strong> 7 days
          </span>
          <span>
            <strong>{visitors.month}</strong> 30 days
          </span>
          <small>
            <LuUsers aria-hidden /> Visitors
          </small>
        </a>
      )}
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
            <a href={ANALYTICS_LINK.href} className={path.startsWith(ANALYTICS_LINK.href) ? "active" : undefined} aria-current={path.startsWith(ANALYTICS_LINK.href) ? "page" : undefined}>
              <LuActivity aria-hidden /> {ANALYTICS_LINK.label}
            </a>
          </li>
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
