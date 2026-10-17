-- CloCast: one row per signed-in user holding their saved places, body
-- details, units, and last activity as a JSON document.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.clocast_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.clocast_user_data enable row level security;

grant select, insert, update on public.clocast_user_data to authenticated;

drop policy if exists "Users manage their own CloCast data" on public.clocast_user_data;
create policy "Users manage their own CloCast data"
  on public.clocast_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
