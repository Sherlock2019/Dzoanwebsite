// Controlled vocabularies. Client-safe (no server imports).

export const PROJECT_STATUSES = [
  "Production",
  "MVP",
  "POC",
  "Public demo",
  "Proposed design",
  "Internal tool",
  "Personal project",
] as const;

export const PROJECT_CATEGORIES = [
  "Agentic AI",
  "Banking / Finance",
  "Supply Chain",
  "AI Infrastructure / GPU",
  "Cloud / DevOps",
  "Internal Tools",
  "AI Research",
  "Other",
] as const;

export const ARCHITECTURE_STATUSES = [
  "Production",
  "POC",
  "Reference Architecture",
  "Proposed Design",
] as const;

export const ARCHITECTURE_TAGS = [
  "Banking AI",
  "Banking",
  "AWS",
  "Azure",
  "Google Cloud",
  "OpenStack / hybrid",
  "MLOps and CI/CD",
  "Data engineering",
  "Supply chain / SAP",
] as const;

export const CURRENT_STAGES = [
  "Idea",
  "In Progress",
  "POC",
  "MVP",
  "Production",
  "Paused",
  "Completed",
] as const;

export const SKILL_GROUPS = ["technical", "business", "human"] as const;

export const SKILL_ICONS = ["ai", "data", "cloud", "business", "human", "other"] as const;

export const CERT_KINDS = ["Certification", "Course", "Training", "Education"] as const;
export const CERT_STATUSES = ["Completed", "In progress"] as const;

export const SECTION_ICONS = ["trophy", "award", "quote", "star", "heart", "book", "file", "globe"] as const;

/** Anchor ids used by built-in parts of the home page; custom sections never take these. */
export const RESERVED_SECTION_SLUGS = [
  "home", "about", "skills", "stacks", "resume", "projects", "architectures", "current", "certifications", "contact", "main", "site-sidebar",
];

export const VISIBILITIES = ["published", "draft"] as const;

/** Visual tone per status — used for badges. */
export function statusTone(status: string): "green" | "blue" | "amber" | "violet" | "gray" {
  switch (status) {
    case "Production":
    case "Completed":
      return "green";
    case "MVP":
    case "POC":
    case "In Progress":
    case "Public demo":
      return "blue";
    case "Proposed design":
    case "Proposed Design":
    case "Idea":
      return "amber";
    case "Reference Architecture":
    case "Internal tool":
      return "violet";
    default:
      return "gray";
  }
}
