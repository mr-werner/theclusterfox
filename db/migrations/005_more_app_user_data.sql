-- WatchFox, CalmFox, MathFox, CookFox and Engineer ToolFox: one row per
-- signed-in user holding that app's settings as a JSON document, the same
-- shape as the earlier per-app tables. Additive only: no existing table changes.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

-- WatchFox: services, leagues, favorites, watchlist and seen list.
create table if not exists public.watch_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.watch_user_data enable row level security;

grant select, insert, update on public.watch_user_data to authenticated;

drop policy if exists "Users manage their own WatchFox data" on public.watch_user_data;
create policy "Users manage their own WatchFox data"
  on public.watch_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- CalmFox: favorites, custom breathing rhythm, theme and session journal.
create table if not exists public.calm_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.calm_user_data enable row level security;

grant select, insert, update on public.calm_user_data to authenticated;

drop policy if exists "Users manage their own CalmFox data" on public.calm_user_data;
create policy "Users manage their own CalmFox data"
  on public.calm_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- MathFox: recent problems.
create table if not exists public.math_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.math_user_data enable row level security;

grant select, insert, update on public.math_user_data to authenticated;

drop policy if exists "Users manage their own MathFox data" on public.math_user_data;
create policy "Users manage their own MathFox data"
  on public.math_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- CookFox: saved recipes, pantry and shopping list.
create table if not exists public.cook_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cook_user_data enable row level security;

grant select, insert, update on public.cook_user_data to authenticated;

drop policy if exists "Users manage their own CookFox data" on public.cook_user_data;
create policy "Users manage their own CookFox data"
  on public.cook_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- Engineer ToolFox: favorite tools, recent tools and preferred units.
create table if not exists public.tools_user_data (
  user_id text primary key default auth.user_id(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tools_user_data enable row level security;

grant select, insert, update on public.tools_user_data to authenticated;

drop policy if exists "Users manage their own Engineer ToolFox data" on public.tools_user_data;
create policy "Users manage their own Engineer ToolFox data"
  on public.tools_user_data
  for all
  to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());
