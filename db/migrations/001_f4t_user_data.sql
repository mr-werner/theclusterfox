-- Fuel 4 Thought: one row per signed-in user holding their saved meals,
-- favorite activities, adjustments, and weight as a JSON document.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.f4t_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.f4t_user_data enable row level security;

grant select, insert, update on public.f4t_user_data to authenticated;

drop policy if exists "Users manage their own F4T data" on public.f4t_user_data;
create policy "Users manage their own F4T data"
  on public.f4t_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
