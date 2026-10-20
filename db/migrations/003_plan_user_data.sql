-- PlanFox: one row per signed-in user holding their calendar items, layer
-- choices, linked calendars and settings as a JSON document.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.plan_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plan_user_data enable row level security;

grant select, insert, update on public.plan_user_data to authenticated;

drop policy if exists "Users manage their own PlanFox data" on public.plan_user_data;
create policy "Users manage their own PlanFox data"
  on public.plan_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
