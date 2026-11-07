// Content model shared by the public site, the owner dashboard and both data providers.
// Media objects only store storage keys; URLs are built with lib/media-url.ts.

export type Visibility = "published" | "draft";

export interface Media {
  key: string;
  thumb?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Link {
  label: string;
  url: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface ResumeFile {
  key: string;
  filename: string;
}

export interface Profile {
  id: "main";
  name: string;
  headline: string;
  tagline: string;
  value_proposition: string;
  hero_description: string;
  mission: string;
  how_i_work: string;
  bio_title: string;
  bio: string;
  positioning: string;
  invitation_title: string;
  invitation: string;
  booking_url: string;
  booking_label: string;
  about_title: string;
  about: string;
  current_role: string;
  current_company: string;
  current_company_url: string;
  location: string;
  languages: string;
  focus: string;
  approach: string;
  citizenship: string;
  email: string;
  linkedin: string;
  github: string;
  website: string;
  phone: string;
  show_phone: boolean;
  image: Media | null;
  hero_image: Media | null;
  resume: ResumeFile | null;
  stats: Stat[];
  seo_title: string;
  seo_description: string;
  updated_at: string;
}

interface Base {
  id: string;
  sort_order: number;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface Project extends Base {
  slug: string;
  group: string;
  title: string;
  subtitle: string;
  context: string;
  summary: string;
  problem: string;
  role: string;
  implementation: string;
  architecture: string;
  outcomes: string;
  status: string;
  status_note: string;
  categories: string[];
  technologies: string[];
  media: Media[];
  demo_url: string;
  repo_url: string;
  links: Link[];
  related_architectures: string[];
  featured: boolean;
}

export interface Architecture extends Base {
  slug: string;
  title: string;
  summary: string;
  description: string;
  business_context: string;
  contribution: string;
  status: string;
  tags: string[];
  technologies: string[];
  image: Media | null;
  related_project: string;
  links: Link[];
  allow_download: boolean;
}

export interface CurrentProject extends Base {
  slug: string;
  title: string;
  summary: string;
  details: string;
  objective: string;
  working_on: string;
  stage: string;
  technologies: string[];
  media: Media[];
  diagrams: Media[];
  links: Link[];
  updated_on: string;
}

export interface Experience extends Base {
  company: string;
  role: string;
  location: string;
  start: string;
  end: string;
  region: string;
  summary: string;
  bullets: string[];
  links: Link[];
}

export interface SkillCategory extends Base {
  group: "technical" | "business" | "human";
  title: string;
  description: string;
  icon: string;
  items: string[];
  image?: Media | null;
}

export interface Certification extends Base {
  group: string;
  title: string;
  issuer: string;
  kind: string;
  status: string;
  year: string;
  url: string;
}

/** An uploaded PDF or Word document (stored under documents/). */
export interface Attachment {
  key: string;
  filename: string;
  /** Page-1 preview image of a PDF (documents/…/<uuid>.thumb.webp), made by the server on save. */
  preview?: string;
}

export interface SectionEntry {
  /** Icon on the card. "auto" = gold medal on honour sections, else the section icon. */
  badge?: "auto" | "medal" | "recommendation" | "none";
  title: string;
  subtitle: string;
  text: string;
  url: string;
  url_label: string;
  images: Media[];
  files: Attachment[];
}

/** Owner-defined home-page section (e.g. Awards / Recommendations) with its own sidebar link. */
export interface CustomSection extends Base {
  slug: string;
  title: string;
  icon: string;
  intro: string;
  entries: SectionEntry[];
}

export interface EntityMap {
  projects: Project;
  architectures: Architecture;
  current: CurrentProject;
  experience: Experience;
  skills: SkillCategory;
  certifications: Certification;
  sections: CustomSection;
}

export type CollectionName = keyof EntityMap;
export type Entity = EntityMap[CollectionName];

export const COLLECTIONS: CollectionName[] = [
  "projects",
  "architectures",
  "current",
  "experience",
  "skills",
  "certifications",
  "sections",
];

export function isCollection(value: string): value is CollectionName {
  return (COLLECTIONS as string[]).includes(value);
}

/** Collections that have a public detail page addressed by slug. */
export const SLUGGED: CollectionName[] = ["projects", "architectures", "current"];
