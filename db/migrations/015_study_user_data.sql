-- StudyFox: the decks you added from other apps (as links), your review
-- schedule and study log. One row per signed-in user holding the app's data as a JSON document, the same
-- shape as the other per-app tables.
-- Additive only: no existing table changes.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.study_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.study_user_data enable row level security;

grant select, insert, update on public.study_user_data to authenticated;

drop policy if exists "Users manage their own StudyFox data" on public.study_user_data;
create policy "Users manage their own StudyFox data"
  on public.study_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
