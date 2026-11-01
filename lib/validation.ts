import { z } from "zod";
import { isValidKey } from "@/lib/storage/index";
import { isHttpUrl } from "@/lib/text";
import {
  ARCHITECTURE_STATUSES,
  CERT_KINDS,
  CERT_STATUSES,
  CURRENT_STAGES,
  PROJECT_STATUSES,
  SKILL_GROUPS,
  SKILL_ICONS,
} from "@/lib/options";
import type { CollectionName } from "@/lib/types";

// Server-side validation for everything the owner can submit. Unknown keys are stripped.
// Server-managed fields (id, created_at, updated_at) are never taken from the client.

const text = (max = 300) => z.string().trim().max(max).default("");
const longText = (max = 20000) => z.string().max(max).default("");
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || isHttpUrl(v), "Must be a full http:// or https:// URL")
  .default("");
const storageKey = z.string().refine(isValidKey, "Invalid file reference");
const media = z.object({
  key: storageKey,
  thumb: storageKey.optional(),
  alt: z.string().trim().max(300).default(""),
  caption: z.string().trim().max(500).optional(),
  width: z.number().int().positive().max(100000).optional(),
  height: z.number().int().positive().max(100000).optional(),
});
const link = z.object({
  label: z.string().trim().min(1, "Label required").max(100),
  url: z.string().trim().max(2000).refine(isHttpUrl, "Must be a full http:// or https:// URL"),
});
const strList = (maxItems = 80, maxLen = 200) =>
  z.array(z.string().trim().min(1).max(maxLen)).max(maxItems).default([]);
const visibility = z.enum(["published", "draft"]).default("draft");
const slug = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes")
  .default("");
const sortOrder = z.number().int().min(0).max(100000).optional();
const ref = z.string().trim().max(80).default("");

export const profileSchema = z.object({
  name: text(120).pipe(z.string().min(1, "Name required")),
  headline: text(200),
  tagline: text(300),
  value_proposition: text(400),
  hero_description: longText(1500),
  mission: longText(800),
  how_i_work: text(400),
  bio_title: text(80),
  bio: longText(3000),
  positioning: text(300),
  invitation_title: text(200),
  invitation: longText(2000),
  booking_url: optionalUrl,
  booking_label: text(60),
  about_title: text(120),
  about: longText(6000),
  current_role: text(200),
  current_company: text(120),
  current_company_url: optionalUrl,
  location: text(120),
  languages: text(200),
  focus: text(200),
  approach: text(200),
  citizenship: text(120),
  email: z.string().trim().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email").default(""),
  linkedin: optionalUrl,
  github: optionalUrl,
  website: optionalUrl,
  phone: z.string().trim().max(30).regex(/^[+0-9 ().-]*$/, "Digits, spaces and + ( ) - only").default(""),
  show_phone: z.boolean().default(false),
  image: media.nullable().default(null),
  hero_image: media.nullable().default(null),
  resume: z
    .object({ key: storageKey, filename: z.string().trim().max(150).regex(/^[\w .()-]+\.pdf$/i, "PDF filename") })
    .nullable()
    .default(null),
  stats: z.array(z.object({ value: text(30), label: text(60) })).max(8).default([]),
  seo_title: text(120),
  seo_description: text(300),
});

const projectSchema = z.object({
  slug,
  group: text(80),
  title: text(150).pipe(z.string().min(1, "Title required")),
  subtitle: text(200),
  context: text(200),
  summary: longText(1200),
  problem: longText(),
  role: longText(),
  implementation: longText(),
  architecture: longText(),
  outcomes: longText(),
  status: z.enum(PROJECT_STATUSES).default("POC"),
  status_note: text(400),
  categories: strList(10, 60),
  technologies: strList(40, 60),
  media: z.array(media).max(30).default([]),
  demo_url: optionalUrl,
  repo_url: optionalUrl,
  links: z.array(link).max(20).default([]),
  related_architectures: strList(20, 80),
  featured: z.boolean().default(false),
  visibility,
  sort_order: sortOrder,
});

const architectureSchema = z.object({
  slug,
  title: text(200).pipe(z.string().min(1, "Title required")),
  summary: longText(1200),
  description: longText(),
  business_context: longText(4000),
  contribution: longText(4000),
  status: z.enum(ARCHITECTURE_STATUSES).default("Reference Architecture"),
  tags: strList(15, 60),
  technologies: strList(40, 60),
  image: media.nullable().default(null),
  related_project: ref,
  links: z.array(link).max(20).default([]),
  allow_download: z.boolean().default(false),
  visibility,
  sort_order: sortOrder,
});

const currentSchema = z.object({
  slug,
  title: text(150).pipe(z.string().min(1, "Title required")),
  summary: longText(1200),
  details: longText(),
  objective: longText(2000),
  working_on: longText(4000),
  stage: z.enum(CURRENT_STAGES).default("In Progress"),
  technologies: strList(40, 60),
  media: z.array(media).max(30).default([]),
  diagrams: z.array(media).max(20).default([]),
  links: z.array(link).max(20).default([]),
  updated_on: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use YYYY-MM-DD").default(""),
  visibility,
  sort_order: sortOrder,
});

const experienceSchema = z.object({
  company: text(150).pipe(z.string().min(1, "Company required")),
  role: text(200),
  location: text(120),
  start: text(30),
  end: text(30),
  region: text(60),
  summary: longText(3000),
  bullets: strList(15, 800),
  links: z.array(link).max(10).default([]),
  visibility,
  sort_order: sortOrder,
});

const skillSchema = z.object({
  group: z.enum(SKILL_GROUPS).default("technical"),
  title: text(120).pipe(z.string().min(1, "Title required")),
  description: longText(1000),
  icon: z.enum(SKILL_ICONS).default("other"),
  items: strList(60, 120),
  visibility,
  sort_order: sortOrder,
});

const certificationSchema = z.object({
  group: text(120),
  title: text(250).pipe(z.string().min(1, "Title required")),
  issuer: text(200),
  kind: z.enum(CERT_KINDS).default("Course"),
  status: z.enum(CERT_STATUSES).default("Completed"),
  year: text(20),
  url: optionalUrl,
  visibility,
  sort_order: sortOrder,
});

export const collectionSchemas: Record<CollectionName, z.ZodTypeAny> = {
  projects: projectSchema,
  architectures: architectureSchema,
  current: currentSchema,
  experience: experienceSchema,
  skills: skillSchema,
  certifications: certificationSchema,
};

export function formatIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
