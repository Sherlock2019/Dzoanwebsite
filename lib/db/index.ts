import { dataProvider } from "@/lib/config";
import type { CollectionName, EntityMap, Profile } from "@/lib/types";

/**
 * Storage-agnostic repository. Swap providers with DATA_PROVIDER without touching pages or routes.
 * Implementations must return copies (callers may mutate results).
 */
export interface Repository {
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<Profile>;
  list<C extends CollectionName>(collection: C): Promise<EntityMap[C][]>;
  get<C extends CollectionName>(collection: C, id: string): Promise<EntityMap[C] | null>;
  save<C extends CollectionName>(collection: C, item: EntityMap[C]): Promise<EntityMap[C]>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Persist sort_order = index for the given ids (others keep their order after them). */
  reorder(collection: CollectionName, ids: string[]): Promise<void>;
}

let repo: Promise<Repository> | null = null;

export function getRepo(): Promise<Repository> {
  if (!repo) {
    repo =
      dataProvider() === "supabase"
        ? import("./supabase").then((m) => m.createSupabaseRepository())
        : import("./local").then((m) => m.createLocalRepository());
  }
  return repo;
}

export function bySortOrder<T extends { sort_order: number }>(a: T, b: T): number {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
}
