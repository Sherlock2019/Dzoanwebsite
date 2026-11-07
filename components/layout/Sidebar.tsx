"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaGithub, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { LuLayoutDashboard, LuMail, LuMenu, LuX } from "react-icons/lu";
import type { FlagBadge } from "@/lib/flags";
import { NAV_ICONS, SECTION_ICON_MAP } from "@/lib/icons";
import Flag from "./Flag";

export interface NavItem {
  id: string;
  label: string;
  /** Icon key from SECTION_ICON_MAP (custom sections); built-in links use their id. */
  icon?: string;
}

export interface Social {
  kind: "email" | "linkedin" | "github" | "whatsapp";
  href: string;
  label: string;
}

const SOCIAL_ICONS = { email: LuMail, linkedin: FaLinkedinIn, github: FaGithub, whatsapp: FaWhatsapp };

interface Props {
  name: string;
  imageUrl: string;
  initials: string;
  socials: Social[];
  citizenship: FlagBadge[];
  languages: FlagBadge[];
  nav: NavItem[];
  isOwner: boolean;
}

export default function Sidebar({ name, imageUrl, initials, socials, citizenship, languages, nav, isOwner }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");
  const [imgFailed, setImgFailed] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Scroll-spy: highlight the section currently in view (home page only).
  useEffect(() => {
    if (window.location.pathname !== "/") {
      const section = window.location.pathname.split("/")[1];
      setActive(section === "current" ? "current" : section || "home");
      return;
    }
    const sections = nav
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [nav]);

  // Close the drawer with Escape and return focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-controls="site-sidebar"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <LuX aria-hidden /> : <LuMenu aria-hidden />}
      </button>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} aria-hidden />}

      <header id="site-sidebar" className={`sidebar${open ? " is-open" : ""}`}>
        <div className="sidebar-profile">
          {imageUrl && !imgFailed ? (
            <img src={imageUrl} alt={`Portrait of ${name}`} className="avatar" onError={() => setImgFailed(true)} />
          ) : (
            <div className="avatar avatar-initials" role="img" aria-label={name}>
              {initials}
            </div>
          )}
          <h1 className="sidebar-name">
            <Link href="/#home" onClick={() => setOpen(false)}>
              {name}
            </Link>
          </h1>
          {(citizenship.length > 0 || languages.length > 0) && (
            <dl className="sidebar-flags">
              {citizenship.length > 0 && (
                <div>
                  <dt>Citizen</dt>
                  <dd>
                    {citizenship.map((f) => (
                      <Flag key={f.code} code={f.code} label={`${f.label} citizenship`} />
                    ))}
                  </dd>
                </div>
              )}
              {languages.length > 0 && (
                <div>
                  <dt>Speaks</dt>
                  <dd>
                    {languages.map((f) => (
                      <Flag key={f.code} code={f.code} label={f.label} />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {socials.length > 0 && (
            <ul className="social-links">
              {socials.map((s) => {
                const Icon = SOCIAL_ICONS[s.kind];
                const external = s.kind !== "email";
                return (
                  <li key={s.kind}>
                    <a
                      href={s.href}
                      aria-label={s.label}
                      title={s.label}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      <Icon aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <nav aria-label="Main" className="sidebar-nav">
          <ul>
            {nav.map((item) => {
              const Icon = (item.icon && SECTION_ICON_MAP[item.icon]) || NAV_ICONS[item.id];
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`/#${item.id}`}
                    className={isActive ? "active" : undefined}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {Icon && <Icon aria-hidden className="nav-icon" />}
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
            {isOwner && (
              <li className="nav-owner">
                <Link href="/admin">
                  <LuLayoutDashboard aria-hidden className="nav-icon" />
                  <span>Admin / Edit</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </header>
    </>
  );
}
