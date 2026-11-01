import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. Never import from client components.

let client: Promise<SupabaseClient> | null = null;

export function getSupabaseAdmin(): Promise<SupabaseClient> {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DATA_PROVIDER=supabase");
    }
    client = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }
  return client;
}

export function supabaseBucket(): string {
  return process.env.SUPABASE_BUCKET || "portfolio-media";
}
