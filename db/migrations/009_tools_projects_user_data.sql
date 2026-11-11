-- Engineer ToolFox projects: named sets of saved calculations (inputs,
-- results and report snapshots) that can be reopened and printed as one
-- report. One row per signed-in user holding a JSON document, the same shape
-- as the other per-app tables. Kept apart from tools_user_data so saving a
-- project never rewrites unit preferences and favorites, and vice versa.
-- Additive only: no existing table changes.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.tools_projects_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tools_projects_user_data enable row level security;

grant select, insert, update on public.tools_projects_user_data to authenticated;

drop policy if exists "Users manage their own Engineer ToolFox projects" on public.tools_projects_user_data;
create policy "Users manage their own Engineer ToolFox projects"
  on public.tools_projects_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
