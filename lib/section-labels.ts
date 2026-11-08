import type { Profile } from "@/lib/types";

/** Built-in sections: default names, shown in the left menu and as the section heading. */
export const SECTION_LABELS = {
  home: "Home",
  about: "About",
  skills: "Skills",
  stacks: "Business & Human Stack",
  resume: "Résumé",
  projects: "Projects",
  architectures: "Architectures",
  current: "Full Resume Portfolio Download",
  certifications: "Certifications & Learning",
  contact: "Contact",
} as const;

export type SectionId = keyof typeof SECTION_LABELS;

/** Home is the top banner and always shown; every other built-in section can be hidden. */
export const HIDEABLE: readonly SectionId[] = (Object.keys(SECTION_LABELS) as SectionId[]).filter((id) => id !== "home");

/** The owner's custom name for a section (Admin → Profile), or the default. */
export function sectionLabel(profile: Pick<Profile, "section_labels">, id: SectionId): string {
  return profile.section_labels?.[id]?.trim() || SECTION_LABELS[id];
}

/** False when the owner removed this section from the site (Admin → Profile → Sections). */
export function sectionShown(profile: Pick<Profile, "hidden_sections">, id: SectionId): boolean {
  return !profile.hidden_sections?.includes(id);
}
