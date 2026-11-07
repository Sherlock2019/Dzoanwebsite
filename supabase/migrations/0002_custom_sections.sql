-- Owner-defined home-page sections (e.g. Awards / Recommendations). Same shape and policies as
-- the collections in 0001_init.sql.

create table if not exists public.custom_sections (
  id text primary key,
  slug text,
  visibility text not null default 'draft' check (visibility in ('published','draft')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists custom_sections_sort_idx on public.custom_sections (sort_order);
create unique index if not exists custom_sections_slug_idx on public.custom_sections (slug) where slug is not null;
alter table public.custom_sections enable row level security;
drop policy if exists "public read published" on public.custom_sections;
create policy "public read published" on public.custom_sections
  for select to anon, authenticated using (visibility = 'published');
