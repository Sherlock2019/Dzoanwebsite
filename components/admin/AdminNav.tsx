"use client";

import { usePathname } from "next/navigation";
import {
  LuAward,
  LuBriefcase,
  LuCode,
  LuExternalLink,
  LuLayoutDashboard,
  LuLogOut,
  LuNetwork,
  LuRocket,
  LuSettings,
  LuUser,
} from "react-icons/lu";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LuLayoutDashboard },
  { href: "/admin/profile", label: "Profile & résumé", icon: LuUser },
  { href: "/admin/projects", label: "Projects", icon: LuCode },
  { href: "/admin/architectures", label: "Architectures", icon: LuNetwork },
  { href: "/admin/current", label: "Current projects", icon: LuRocket },
  { href: "/admin/experience", label: "Experience", icon: LuBriefcase },
  { href: "/admin/skills", label: "Skills & stacks", icon: LuSettings },
  { href: "/admin/certifications", label: "Certifications", icon: LuAward },
];

export default function AdminNav({ email }: { email: string }) {
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
            const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <li key={href}>
                <a href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden /> {label}
                </a>
              </li>
            );
          })}
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
