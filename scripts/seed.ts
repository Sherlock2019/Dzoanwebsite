import { existsSync, readFileSync } from "fs";
import path from "path";
import { loadEnv } from "./env";

// Seeds the configured data provider (local or Supabase) from content/seed/seed.json and the
// private assets in content/seed/assets/. All seeded items are published.
//
//   npm run seed            — only when the database is empty
//   npm run seed -- --force — replace ALL existing content with the seed (asks nothing; be sure)

loadEnv();

type SeedMedia = { asset: string; alt: string; caption?: string };
type SeedProject = Record<string, unknown> & { key: string; media: SeedMedia[]; related: string[] };
type SeedArchitecture = Record<string, unknown> & { key: string; asset: string; alt: string; related_project: string };

async function main() {
  const { getRepo } = await import("@/lib/db/index");
  const { createEntity, deleteEntity, saveProfile, defaultProfile } = await import("@/lib/content");
  const { storeImage, storePdf, sniffType } = await import("@/lib/upload");
  const { profileSchema } = await import("@/lib/validation");
  const { COLLECTIONS } = await import("@/lib/types");

  const force = process.argv.includes("--force");
  const root = path.resolve(process.cwd(), "content/seed");
  const seed = JSON.parse(readFileSync(path.join(root, "seed.json"), "utf8"));
  const repo = await getRepo();

  const existing = (await Promise.all(COLLECTIONS.map((c) => repo.list(c)))).flat().length;
  if ((existing > 0 || (await repo.getProfile())) && !force) {
    console.error(`The database already has content (${existing} items). Re-run with --force to replace it.`);
    process.exit(1);
  }
  if (force) {
    for (const c of COLLECTIONS) for (const item of await repo.list(c)) await deleteEntity(c, item.id);
  }

  const uploaded = new Map<string, Awaited<ReturnType<typeof storeImage>>>();
  // The assets folder is private (not in git): on a fresh clone, items whose image is missing are skipped.
  const hasAsset = (asset: string) => existsSync(path.join(root, "assets", asset));
  const missing = new Set<string>();
  async function image(asset: string, alt: string, caption?: string) {
    if (!uploaded.has(asset)) {
      const buf = readFileSync(path.join(root, "assets", asset));
      const type = sniffType(buf);
      const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
      uploaded.set(asset, await storeImage(buf, mime, alt));
      console.log(`  uploaded ${asset}`);
    }
    return { ...uploaded.get(asset)!, alt, ...(caption ? { caption } : {}) };
  }

  // Profile
  const { resume: seedResume, ...profileFields } = seed.profile;
  let resume = null;
  if (seedResume?.asset) {
    try {
      const key = await storePdf(readFileSync(path.join(root, "assets", seedResume.asset)), "application/pdf");
      resume = { key, filename: seedResume.filename };
      console.log(`  uploaded ${seedResume.asset}`);
    } catch (err) {
      console.warn(`  résumé PDF skipped: ${(err as Error).message}`);
    }
  }
  const profile = profileSchema.parse({ ...defaultProfile(), ...profileFields, resume });
  await saveProfile(profile);
  console.log("Profile saved");

  // Simple collections
  for (const [collection, items] of [
    ["skills", seed.skills],
    ["experience", seed.experience],
    ["certifications", seed.certifications],
  ] as const) {
    for (const [i, item] of (items as Record<string, unknown>[]).entries()) {
      await createEntity(collection, { ...item, visibility: "published", sort_order: i });
    }
    console.log(`${collection}: ${items.length}`);
  }

  // Projects (without cross-links first)
  const projectIds = new Map<string, string>();
  for (const [i, p] of (seed.projects as SeedProject[]).entries()) {
    const { key, related: _related, media, ...rest } = p;
    void _related;
    const mediaItems = [];
    for (const m of media) {
      if (hasAsset(m.asset)) mediaItems.push(await image(m.asset, m.alt, m.caption));
      else missing.add(m.asset);
    }
    const created = await createEntity("projects", { ...rest, media: mediaItems, visibility: "published", sort_order: i });
    projectIds.set(key, created.id);
  }
  console.log(`projects: ${projectIds.size}`);

  // Architectures
  const archIds = new Map<string, string>();
  for (const [i, a] of (seed.architectures as SeedArchitecture[]).entries()) {
    const { key, asset, alt, related_project, ...rest } = a;
    if (!hasAsset(asset)) {
      missing.add(asset);
      continue;
    }
    const created = await createEntity("architectures", {
      ...rest,
      image: await image(asset, alt),
      related_project: related_project ? projectIds.get(related_project) || "" : "",
      allow_download: false,
      visibility: "published",
      sort_order: i,
    });
    archIds.set(key, created.id);
  }
  console.log(`architectures: ${archIds.size}`);

  // Link projects → related architectures
  for (const p of seed.projects as SeedProject[]) {
    if (!p.related.length) continue;
    const id = projectIds.get(p.key)!;
    const project = await repo.get("projects", id);
    if (!project) continue;
    project.related_architectures = p.related.map((k) => archIds.get(k)).filter((x): x is string => Boolean(x));
    await repo.save("projects", project);
  }
  if (missing.size) {
    console.warn(`  ${missing.size} image(s) not found in content/seed/assets/ (private, not in git) — those were skipped.`);
    console.warn("  To publish your full site, copy .data/ from the machine where you edit it (README → EC2).");
  }
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
