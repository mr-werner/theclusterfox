-- GrowFox: your place, yard spots, plants and finished garden jobs. One row
-- per signed-in user holding the app's data as a JSON document, the same
-- shape as the other per-app tables.
-- Additive only: no existing table changes.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.grow_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.grow_user_data enable row level security;

grant select, insert, update on public.grow_user_data to authenticated;

drop policy if exists "Users manage their own GrowFox data" on public.grow_user_data;
create policy "Users manage their own GrowFox data"
  on public.grow_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
