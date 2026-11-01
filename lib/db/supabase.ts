import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollectionName, Profile } from "@/lib/types";
import type { Repository } from "./index";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Supabase provider. Each collection is a table with indexed columns (id, slug, visibility,
// sort_order, updated_at) and the full document in `data` (jsonb). See supabase/migrations.
// Uses the service-role key on the server only; RLS blocks all direct writes from anon/auth roles.

const TABLE: Record<CollectionName, string> = {
  projects: "projects",
  architectures: "architectures",
  current: "current_projects",
  experience: "experience",
  skills: "skill_categories",
  certifications: "certifications",
};

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.data;
}

export async function createSupabaseRepository(): Promise<Repository> {
  const db: SupabaseClient = await getSupabaseAdmin();

  function row(item: { id: string; sort_order: number; visibility: string; updated_at: string; slug?: string }) {
    return {
      id: item.id,
      slug: item.slug ?? null,
      visibility: item.visibility,
      sort_order: item.sort_order ?? 0,
      updated_at: item.updated_at,
      data: item,
    };
  }

  const repo: Repository = {
    async getProfile() {
      const data = check(await db.from("profile").select("data").eq("id", "main").maybeSingle());
      return (data?.data as Profile) ?? null;
    },
    async saveProfile(profile) {
      check(await db.from("profile").upsert({ id: "main", data: profile, updated_at: profile.updated_at }));
      return profile;
    },
    async list(collection) {
      const rows = check(await db.from(TABLE[collection]).select("data").order("sort_order", { ascending: true }));
      return (rows ?? []).map((r: { data: unknown }) => r.data) as never;
    },
    async get(collection, id) {
      const data = check(await db.from(TABLE[collection]).select("data").eq("id", id).maybeSingle());
      return (data?.data as never) ?? null;
    },
    async save(collection, item) {
      check(await db.from(TABLE[collection]).upsert(row(item as never)));
      return item;
    },
    async remove(collection, id) {
      check(await db.from(TABLE[collection]).delete().eq("id", id));
    },
    async reorder(collection, ids) {
      const all = (await repo.list(collection)) as { id: string; sort_order: number; visibility: string; updated_at: string }[];
      const rest = all.filter((x) => !ids.includes(x.id));
      const ordered = ids.map((id) => all.find((x) => x.id === id)).filter(Boolean) as typeof all;
      const rows = [...ordered, ...rest].map((x, i) => row({ ...x, sort_order: i }));
      if (rows.length) check(await db.from(TABLE[collection]).upsert(rows));
    },
  };
  return repo;
}
