import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "@/lib/config";
import type { CollectionName, EntityMap, Profile } from "@/lib/types";
import { COLLECTIONS } from "@/lib/types";
import { bySortOrder, type Repository } from "./index";

// Local provider: a single JSON document on disk, written atomically (temp file + rename).
// Durable as long as DATA_DIR lives on a persistent disk or volume.

type DbFile = { version: 1; profile: Profile | null } & { [K in CollectionName]: EntityMap[K][] };

function emptyDb(): DbFile {
  const db = { version: 1, profile: null } as DbFile;
  for (const c of COLLECTIONS) (db as Record<string, unknown>)[c] = [];
  return db;
}

export function createLocalRepository(dir = dataDir()): Repository {
  const file = path.join(dir, "db.json");
  let cache: { mtimeMs: number; data: DbFile } | null = null;
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<DbFile> {
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      return emptyDb();
    }
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as DbFile;
      const db = { ...emptyDb(), ...parsed };
      cache = { mtimeMs: stat.mtimeMs, data: db };
    }
    return structuredClone(cache.data);
  }

  async function write(db: DbFile): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, file);
    const stat = await fs.stat(file);
    cache = { mtimeMs: stat.mtimeMs, data: structuredClone(db) };
  }

  function mutate<T>(fn: (db: DbFile) => T): Promise<T> {
    const run = writeQueue.then(async () => {
      const db = await read();
      const result = fn(db);
      await write(db);
      return result;
    });
    writeQueue = run.catch(() => undefined);
    return run;
  }

  return {
    async getProfile() {
      return (await read()).profile;
    },
    saveProfile(profile) {
      return mutate((db) => {
        db.profile = profile;
        return structuredClone(profile);
      });
    },
    async list(collection) {
      const db = await read();
      return [...db[collection]].sort(bySortOrder) as never;
    },
    async get(collection, id) {
      const db = await read();
      return (db[collection] as { id: string }[]).find((x) => x.id === id) as never ?? null;
    },
    save(collection, item) {
      return mutate((db) => {
        const list = db[collection] as { id: string }[];
        const index = list.findIndex((x) => x.id === item.id);
        if (index >= 0) list[index] = item;
        else list.push(item);
        return structuredClone(item);
      });
    },
    async remove(collection, id) {
      await mutate((db) => {
        (db as Record<string, unknown>)[collection] = (db[collection] as { id: string }[]).filter(
          (x) => x.id !== id,
        );
      });
    },
    async reorder(collection, ids) {
      await mutate((db) => {
        const list = [...(db[collection] as { id: string; sort_order: number }[])].sort(bySortOrder);
        const rest = list.filter((x) => !ids.includes(x.id));
        const ordered = ids
          .map((id) => list.find((x) => x.id === id))
          .filter((x): x is { id: string; sort_order: number } => Boolean(x));
        [...ordered, ...rest].forEach((x, i) => (x.sort_order = i));
      });
    },
  };
}
