import type { CustomSection, Profile, SkillCategory } from "@/lib/types";

/** Built-in sections: default names, shown in the left menu and as the section heading. */
export const SECTION_LABELS = {
  home: "Home",
  about: "About",
  skills: "Skills",
  stacks: "Business & Human Stack",
  resume: "Résumé",
  projects: "Projects",
  architectures: "Architectures",
  current: "Full Portfolio Download",
  certifications: "Certifications & Learning",
  "ai-toolbox": "AI Toolbox",
  contact: "Contact",
} as const;

export type SectionId = keyof typeof SECTION_LABELS;

/** Home (the banner) is always shown, but can be moved like any other section. */
export const HIDEABLE: readonly SectionId[] = (Object.keys(SECTION_LABELS) as SectionId[]).filter((id) => id !== "home");

/** The owner's custom name for a section (Admin → Profile), or the default. */
export function sectionLabel(profile: Pick<Profile, "section_labels">, id: SectionId): string {
  return profile.section_labels?.[id]?.trim() || SECTION_LABELS[id];
}

/** False when the owner removed this section from the site (Admin → Profile → Sections). */
export function sectionShown(profile: Pick<Profile, "hidden_sections">, id: SectionId): boolean {
  return !profile.hidden_sections?.includes(id);
}

const isBuiltIn = (id: string): id is SectionId => id in SECTION_LABELS;

/** Default order: built-ins, custom sections (by their own order), the AI Toolbox, Contact last. */
export function defaultOrder(customSlugs: string[]): string[] {
  return ["home", "about", "skills", "stacks", "resume", "projects", "architectures", "current", "certifications", ...customSlugs, "ai-toolbox", "contact"];
}

/**
 * The owner's saved order, limited to sections that still exist. Sections missing from it (e.g. a
 * custom section added later) go right after the section that precedes them in the default order.
 */
export function applyOrder(defaults: string[], saved: string[] = []): string[] {
  const out = [...new Set(saved)].filter((id) => defaults.includes(id));
  defaults.forEach((id, i) => {
    if (out.includes(id)) return;
    const prev = defaults
      .slice(0, i)
      .reverse()
      .find((p) => out.includes(p));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, id);
  });
  return out;
}

export interface SiteSection {
  id: string;
  label: string;
  /** Custom-section icon name; built-ins use their own icon. */
  icon?: string;
  custom?: CustomSection;
}

/** Sections shown on the site (Home included), in the owner's order, skipping hidden or empty ones. */
export function siteSections(content: {
  profile: Profile;
  skills: SkillCategory[];
  projects: unknown[];
  architectures: unknown[];
  current: unknown[];
  certifications: unknown[];
  sections: CustomSection[];
}): SiteSection[] {
  const { profile } = content;
  const hasContent: Record<SectionId, boolean> = {
    home: true,
    about: true,
    skills: content.skills.length > 0,
    stacks: content.skills.some((s) => s.group !== "technical"),
    resume: true,
    projects: content.projects.length > 0,
    architectures: content.architectures.length > 0,
    current: content.current.length > 0,
    certifications: content.certifications.length > 0,
    "ai-toolbox": true,
    contact: true,
  };
  const custom = new Map(content.sections.map((s) => [s.slug, s]));
  const out: SiteSection[] = [];
  for (const id of applyOrder(defaultOrder([...custom.keys()]), profile.section_order)) {
    const c = custom.get(id);
    if (c) out.push({ id, label: c.title, icon: c.icon, custom: c });
    else if (isBuiltIn(id) && hasContent[id] && (id === "home" || sectionShown(profile, id))) out.push({ id, label: sectionLabel(profile, id) });
  }
  return out;
}
