-- Email-gated "Full project details" files on current projects (see lib/gated.ts).
alter table current_projects add column if not exists downloads jsonb not null default '[]'::jsonb;
