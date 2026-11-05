import {
  ARCHITECTURE_STATUSES,
  ARCHITECTURE_TAGS,
  CERT_KINDS,
  CERT_STATUSES,
  CURRENT_STAGES,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  SKILL_GROUPS,
  SKILL_ICONS,
  VISIBILITIES,
} from "@/lib/options";
import type { CollectionName } from "@/lib/types";

// Form definitions for the owner dashboard. Client-safe. Server-side validation lives in
// lib/validation.ts — keep the two in step when adding fields.

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "date"
  | "select"
  | "multiselect"
  | "tags"
  | "lines"
  | "checkbox"
  | "image"
  | "images"
  | "links"
  | "ref"
  | "refs";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  options?: readonly string[];
  suggestions?: readonly string[];
  rows?: number;
  collection?: "projects" | "architectures";
  required?: boolean;
  /** Text field that suggests values already used in this collection (e.g. group names). */
  suggestExisting?: boolean;
}

export interface CollectionConfig {
  name: CollectionName;
  label: string;
  singular: string;
  description: string;
  titleField: string;
  subtitleField?: string;
  publicPath?: "projects" | "architectures" | "current";
  /** Field used to divide the dashboard list into sections. */
  groupField?: string;
  fields: Field[];
  defaults: Record<string, unknown>;
}

const visibility: Field = {
  name: "visibility",
  label: "Visibility",
  type: "select",
  options: VISIBILITIES,
  help: "Drafts (and their images) are never shown to visitors.",
};

const BULLETS = "Blank line = new paragraph. Start lines with “- ” for a bullet list.";

export const COLLECTION_CONFIG: Record<CollectionName, CollectionConfig> = {
  projects: {
    name: "projects",
    label: "Projects",
    singular: "project",
    description: "Portfolio projects with screenshots, delivery stage, technologies and links. Projects are shown under their Group, in this order.",
    titleField: "title",
    subtitleField: "status",
    publicPath: "projects",
    groupField: "group",
    defaults: { group: "", status: "POC", visibility: "draft", categories: [], technologies: [], media: [], links: [], related_architectures: [], featured: false },
    fields: [
      {
        name: "group",
        label: "Group (type of project)",
        type: "text",
        suggestExisting: true,
        help: "Projects with the same group are shown together under this heading, e.g. “Live AI Demos”. Type a new name to create a group.",
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Short subtitle", type: "text" },
      { name: "slug", label: "URL slug", type: "text", help: "Leave blank to generate from the title." },
      { name: "context", label: "Employer / context", type: "text", help: "Where this work happened, e.g. “Rackspace Technology”." },
      { name: "status", label: "Delivery stage", type: "select", options: PROJECT_STATUSES, help: "Use Production only for systems actually running in production." },
      { name: "status_note", label: "Stage note (public)", type: "textarea", rows: 2, help: "Clarify scope, e.g. “The public demo is a separate showcase.”" },
      { name: "categories", label: "Categories (filters)", type: "multiselect", options: PROJECT_CATEGORIES },
      { name: "featured", label: "Featured project", type: "checkbox" },
      visibility,
      { name: "summary", label: "Short summary (card hover)", type: "textarea", rows: 3 },
      { name: "problem", label: "Problem / business context", type: "textarea", rows: 4, help: BULLETS },
      { name: "role", label: "My role & contribution", type: "textarea", rows: 3, help: BULLETS },
      { name: "implementation", label: "What I built or designed", type: "textarea", rows: 6, help: BULLETS },
      { name: "architecture", label: "Architecture & workflow", type: "textarea", rows: 4, help: BULLETS },
      { name: "outcomes", label: "Outcomes & metrics", type: "textarea", rows: 4, help: "Only results you can support. Leave empty if none." },
      { name: "technologies", label: "Technologies", type: "tags" },
      { name: "media", label: "Screenshots & images", type: "images", help: "The first image is the card cover. JPEG, PNG or WebP, up to 15 MB each." },
      { name: "demo_url", label: "Demo URL", type: "url" },
      { name: "repo_url", label: "Source code URL", type: "url" },
      { name: "links", label: "Other links", type: "links" },
      { name: "related_architectures", label: "Related architectures", type: "refs", collection: "architectures" },
    ],
  },
  architectures: {
    name: "architectures",
    label: "Architectures",
    singular: "architecture",
    description: "Architecture diagrams with status, explanation, tags and related project.",
    titleField: "title",
    subtitleField: "status",
    publicPath: "architectures",
    defaults: { status: "Reference Architecture", visibility: "draft", tags: [], technologies: [], links: [], image: null, allow_download: false, related_project: "" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", help: "Leave blank to generate from the title." },
      {
        name: "status",
        label: "Type / status",
        type: "select",
        options: ARCHITECTURE_STATUSES,
        help: "Default to Reference Architecture or Proposed Design. A diagram that mentions “production” is not itself proof of a production system.",
      },
      { name: "tags", label: "Tags (filters)", type: "tags", suggestions: ARCHITECTURE_TAGS },
      visibility,
      { name: "image", label: "Diagram image", type: "image", help: "Uploaded at full resolution; a thumbnail is generated for the gallery." },
      { name: "allow_download", label: "Allow visitors to download the full-resolution image", type: "checkbox" },
      { name: "summary", label: "Short explanation", type: "textarea", rows: 3 },
      { name: "description", label: "Detailed description", type: "textarea", rows: 8, help: BULLETS },
      { name: "business_context", label: "Business use case", type: "textarea", rows: 3 },
      { name: "contribution", label: "My role", type: "textarea", rows: 3 },
      { name: "technologies", label: "Technologies", type: "tags" },
      { name: "related_project", label: "Related project", type: "ref", collection: "projects" },
      { name: "links", label: "Links", type: "links" },
    ],
  },
  current: {
    name: "current",
    label: "Current Projects",
    singular: "current project",
    description: "What you are working on now. Most recently updated appear first.",
    titleField: "title",
    subtitleField: "stage",
    publicPath: "current",
    defaults: { stage: "In Progress", visibility: "draft", technologies: [], media: [], diagrams: [], links: [], updated_on: "" },
    fields: [
      { name: "title", label: "Project title", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", help: "Leave blank to generate from the title." },
      { name: "stage", label: "Stage / status", type: "select", options: CURRENT_STAGES },
      { name: "updated_on", label: "Date updated", type: "date", help: "Shown publicly and used for ordering. Defaults to the last save." },
      visibility,
      { name: "summary", label: "Short description", type: "textarea", rows: 3 },
      { name: "objective", label: "Current objective", type: "textarea", rows: 3 },
      { name: "working_on", label: "What I am working on", type: "textarea", rows: 4, help: BULLETS },
      { name: "details", label: "Detailed text", type: "textarea", rows: 6, help: BULLETS },
      { name: "technologies", label: "Technologies", type: "tags" },
      { name: "media", label: "Screenshots", type: "images" },
      { name: "diagrams", label: "Architecture diagrams", type: "images" },
      { name: "links", label: "Links (demo, GitHub, docs…)", type: "links" },
    ],
  },
  experience: {
    name: "experience",
    label: "Experience",
    singular: "role",
    description: "Résumé timeline entries. Use the order arrows to arrange them (most recent first).",
    titleField: "company",
    subtitleField: "role",
    defaults: { visibility: "draft", bullets: [], links: [] },
    fields: [
      { name: "company", label: "Employer", type: "text", required: true },
      { name: "role", label: "Job title", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "start", label: "Start (as on résumé, e.g. 12/2024)", type: "text" },
      { name: "end", label: "End (e.g. Present)", type: "text" },
      { name: "region", label: "Timeline group", type: "text", help: "e.g. Vietnam or Europe. The first group in the list fills the main column." },
      visibility,
      { name: "summary", label: "Summary", type: "textarea", rows: 3 },
      { name: "bullets", label: "Bullets (one per line)", type: "lines", rows: 7 },
      { name: "links", label: "Links", type: "links" },
    ],
  },
  skills: {
    name: "skills",
    label: "Skills & Stacks",
    singular: "skill category",
    description: "Technical skill columns plus the Business and Human stacks.",
    titleField: "title",
    subtitleField: "group",
    defaults: { group: "technical", icon: "other", visibility: "draft", items: [], image: null },
    fields: [
      { name: "title", label: "Category title", type: "text", required: true },
      { name: "group", label: "Group", type: "select", options: SKILL_GROUPS, help: "technical = Skills columns; business / human = stack cards." },
      { name: "icon", label: "Category icon", type: "select", options: SKILL_ICONS },
      visibility,
      { name: "description", label: "Description", type: "textarea", rows: 2 },
      { name: "image", label: "Card image", type: "image", help: "Shown on Business and Human stack cards only, not on technical Skills columns. JPEG, PNG or WebP." },
      { name: "items", label: "Items (one per line)", type: "lines", rows: 12, help: "Recognised tool names get their logo automatically." },
    ],
  },
  certifications: {
    name: "certifications",
    label: "Certifications & Learning",
    singular: "entry",
    description: "Certifications, courses and education. Only label something a Certification if you earned it.",
    titleField: "title",
    subtitleField: "kind",
    defaults: { kind: "Course", status: "Completed", visibility: "draft" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "group", label: "Group", type: "text", help: "e.g. Cloud & infrastructure" },
      { name: "kind", label: "Kind", type: "select", options: CERT_KINDS, help: "Education entries also appear in the Résumé section." },
      { name: "status", label: "Status", type: "select", options: CERT_STATUSES },
      { name: "issuer", label: "Issuer / provider", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "url", label: "Verification or course URL", type: "url" },
      visibility,
    ],
  },
};
