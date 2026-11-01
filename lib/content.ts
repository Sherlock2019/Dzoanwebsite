import { randomUUID } from "crypto";
import { getRepo } from "@/lib/db/index";
import { getStorage, isValidKey } from "@/lib/storage/index";
import { slugify } from "@/lib/text";
import { collectionSchemas, formatIssues } from "@/lib/validation";
import type {
  Architecture,
  Certification,
  CollectionName,
  CurrentProject,
  EntityMap,
  Experience,
  Profile,
  Project,
  SkillCategory,
} from "@/lib/types";
import { COLLECTIONS, SLUGGED } from "@/lib/types";

// ---------------------------------------------------------------------------------------------
// Public reads: only published content ever leaves this module for public pages.

export interface PublicContent {
  profile: Profile;
  projects: Project[];
  architectures: Architecture[];
  current: CurrentProject[];
  experience: Experience[];
  skills: SkillCategory[];
  certifications: Certification[];
}

export function defaultProfile(): Profile {
  return {
    id: "main",
    name: "Your Name",
    headline: "",
    tagline: "",
    value_proposition: "",
    hero_description: "",
    mission: "",
    how_i_work: "",
    bio_title: "",
    bio: "",
    positioning: "",
    invitation_title: "",
    invitation: "",
    booking_url: "",
    booking_label: "",
    about_title: "",
    about: "",
    current_role: "",
    current_company: "",
    current_company_url: "",
    location: "",
    languages: "",
    focus: "",
    approach: "",
    citizenship: "",
    email: "",
    linkedin: "",
    github: "",
    website: "",
    phone: "",
    show_phone: false,
    image: null,
    hero_image: null,
    resume: null,
    stats: [],
    seo_title: "",
    seo_description: "",
    updated_at: new Date(0).toISOString(),
  };
}

const published = <T extends { visibility: string }>(items: T[]) => items.filter((x) => x.visibility === "published");

function byRecent(a: CurrentProject, b: CurrentProject): number {
  const da = a.updated_on || a.updated_at;
  const db = b.updated_on || b.updated_at;
  return db.localeCompare(da);
}

export async function getProfile(): Promise<Profile> {
  const repo = await getRepo();
  return { ...defaultProfile(), ...((await repo.getProfile()) ?? {}) };
}

export async function getPublicContent(): Promise<PublicContent> {
  const repo = await getRepo();
  const [profile, projects, architectures, current, experience, skills, certifications] = await Promise.all([
    getProfile(),
    repo.list("projects"),
    repo.list("architectures"),
    repo.list("current"),
    repo.list("experience"),
    repo.list("skills"),
    repo.list("certifications"),
  ]);
  return {
    profile: publicProfile(profile),
    projects: published(projects),
    architectures: published(architectures),
    current: published(current).sort(byRecent),
    experience: published(experience),
    skills: published(skills),
    certifications: published(certifications),
  };
}

/** Strip fields the owner chose not to publish. */
export function publicProfile(profile: Profile): Profile {
  return profile.show_phone ? profile : { ...profile, phone: "" };
}

export async function getPublishedBySlug<C extends "projects" | "architectures" | "current">(
  collection: C,
  slug: string,
): Promise<EntityMap[C] | null> {
  const repo = await getRepo();
  const items = (await repo.list(collection)) as EntityMap[C][];
  return items.find((x) => (x as { slug: string }).slug === slug && x.visibility === "published") ?? null;
}

// ---------------------------------------------------------------------------------------------
// Media access: a file is public only if published content references it.

/** Collect every storage key referenced anywhere inside a value (deep walk). */
export function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (isValidKey(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectKeys(v, into);
  }
  return into;
}

export async function publicMediaKeys(): Promise<Set<string>> {
  const content = await getPublicContent();
  return collectKeys(content);
}

async function allReferencedKeys(): Promise<Set<string>> {
  const repo = await getRepo();
  const keys = collectKeys(await repo.getProfile());
  for (const c of COLLECTIONS) collectKeys(await repo.list(c), keys);
  return keys;
}

/** Delete stored files among `candidates` that nothing references any more. */
export async function deleteOrphans(candidates: Iterable<string>): Promise<void> {
  const list = [...candidates];
  if (list.length === 0) return;
  const inUse = await allReferencedKeys();
  const orphans = list.filter((k) => !inUse.has(k));
  if (orphans.length) await (await getStorage()).remove(orphans);
}

// ---------------------------------------------------------------------------------------------
// Owner writes (callers must have checked authorisation).

export class ValidationError extends Error {
  constructor(public issues: Record<string, string>) {
    super("Validation failed");
  }
}

async function uniqueSlug(collection: CollectionName, wanted: string, selfId?: string): Promise<string> {
  const repo = await getRepo();
  const taken = new Set(
    (await repo.list(collection)).filter((x) => x.id !== selfId).map((x) => (x as { slug?: string }).slug),
  );
  let slug = wanted;
  for (let i = 2; taken.has(slug); i++) slug = `${wanted}-${i}`;
  return slug;
}

function parse(collection: CollectionName, input: unknown) {
  const result = collectionSchemas[collection].safeParse(input);
  if (!result.success) throw new ValidationError(formatIssues(result.error));
  return result.data as Record<string, unknown>;
}

export async function createEntity<C extends CollectionName>(collection: C, input: unknown): Promise<EntityMap[C]> {
  const repo = await getRepo();
  const data = parse(collection, input);
  const now = new Date().toISOString();
  const existing = await repo.list(collection);
  const item: Record<string, unknown> = {
    ...data,
    id: randomUUID(),
    sort_order: typeof data.sort_order === "number" ? data.sort_order : existing.length,
    created_at: now,
    updated_at: now,
  };
  if (SLUGGED.includes(collection)) {
    item.slug = await uniqueSlug(collection, (data.slug as string) || slugify(String(data.title)));
  }
  return repo.save(collection, item as unknown as EntityMap[C]);
}

export async function updateEntity<C extends CollectionName>(
  collection: C,
  id: string,
  input: unknown,
): Promise<EntityMap[C] | null> {
  const repo = await getRepo();
  const existing = await repo.get(collection, id);
  if (!existing) return null;
  const data = parse(collection, input);
  const item: Record<string, unknown> = {
    ...existing,
    ...data,
    id,
    sort_order: typeof data.sort_order === "number" ? data.sort_order : existing.sort_order,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
  if (SLUGGED.includes(collection)) {
    item.slug = await uniqueSlug(collection, (data.slug as string) || slugify(String(data.title)), id);
  }
  const saved = await repo.save(collection, item as unknown as EntityMap[C]);
  const before = collectKeys(existing);
  const after = collectKeys(saved);
  await deleteOrphans([...before].filter((k) => !after.has(k)));
  return saved;
}

export async function deleteEntity(collection: CollectionName, id: string): Promise<boolean> {
  const repo = await getRepo();
  const existing = await repo.get(collection, id);
  if (!existing) return false;
  await repo.remove(collection, id);
  await deleteOrphans(collectKeys(existing));
  return true;
}

export async function saveProfile(data: Omit<Profile, "id" | "updated_at">): Promise<Profile> {
  const repo = await getRepo();
  const before = collectKeys(await repo.getProfile());
  const profile: Profile = { ...data, id: "main", updated_at: new Date().toISOString() };
  const saved = await repo.saveProfile(profile);
  const after = collectKeys(saved);
  await deleteOrphans([...before].filter((k) => !after.has(k)));
  return saved;
}
