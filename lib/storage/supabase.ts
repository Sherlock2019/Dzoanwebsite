import { getSupabaseAdmin, supabaseBucket } from "@/lib/supabase-admin";
import { contentTypeForKey, isValidKey, type ObjectStorage } from "./index";

// Supabase Storage provider. The bucket must be PRIVATE: files are only reachable through
// app/media/[...key], which checks that the file belongs to published content (or the owner).

export async function createSupabaseStorage(): Promise<ObjectStorage> {
  const db = await getSupabaseAdmin();
  const bucket = db.storage.from(supabaseBucket());

  return {
    async put(key, body, contentType) {
      if (!isValidKey(key)) throw new Error("Invalid storage key");
      const { error } = await bucket.upload(key, body, { contentType, upsert: true });
      if (error) throw new Error(`Supabase storage: ${error.message}`);
    },
    async get(key) {
      if (!isValidKey(key)) return null;
      const { data, error } = await bucket.download(key);
      if (error || !data) return null;
      return { body: Buffer.from(await data.arrayBuffer()), contentType: contentTypeForKey(key) };
    },
    async remove(keys) {
      const valid = keys.filter(isValidKey);
      if (valid.length) await bucket.remove(valid);
    },
  };
}
