-- Portfolio schema for DATA_PROVIDER=supabase.
-- Each collection stores the full document in `data` (jsonb) plus indexed columns used for
-- ordering, slugs and the public-read policy.
--
-- Security model:
--   * The Next.js server talks to Supabase with the service-role key (bypasses RLS) and enforces
--     owner authorisation itself (signed session, see lib/auth).
--   * RLS is enabled on every table. anon/authenticated roles may only READ published rows and
--     can never write. So even a leaked anon key cannot change content or read drafts.
--   * Media lives in a PRIVATE bucket; the app serves files after checking they belong to
--     published content.

create table if not exists public.profile (
  id text primary key check (id = 'main'),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['projects','architectures','current_projects','experience','skill_categories','certifications']
  loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        slug text,
        visibility text not null default 'draft' check (visibility in ('published','draft')),
        sort_order integer not null default 0,
        updated_at timestamptz not null default now(),
        data jsonb not null
      );
      create index if not exists %1$s_sort_idx on public.%1$I (sort_order);
      create unique index if not exists %1$s_slug_idx on public.%1$I (slug) where slug is not null;
      alter table public.%1$I enable row level security;
      drop policy if exists "public read published" on public.%1$I;
      create policy "public read published" on public.%1$I
        for select to anon, authenticated using (visibility = 'published');
    $f$, t);
  end loop;
end $$;

-- The profile document can contain an unpublished phone number, so it has no public policy at
-- all: only the server (service role) reads it and strips hidden fields before rendering.
alter table public.profile enable row level security;

-- No insert/update/delete policies exist, so only the service role (server) can write.

-- Private storage bucket for images, the résumé PDF and documents uploaded for AI ingestion
-- (20 MB limit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', false, 20971520,
        array['image/png','image/jpeg','image/webp','application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain','text/markdown'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
