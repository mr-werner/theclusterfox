-- Feedback, the developer area and developer notes.
--
-- site_admins:   who can open /dev. Rows are added by hand (see the bottom).
-- site_feedback: what visitors send from the Feedback form. Anyone can send
--                one through /api/site/feedback (the server writes it with
--                the database owner role); only admins can read or update.
-- dev_notes:     notes the developer leaves while looking at a page, and app
--                ideas. Claude sessions read the open ones and mark them
--                picked up or done (see CLAUDE.md).
--
-- Additive only: no existing table changes.
-- Requires the Neon Data API with Neon Auth (provides auth.user_id()).

create table if not exists public.site_admins (
  user_id text primary key,
  label text,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
grant select on public.site_admins to authenticated;

drop policy if exists "People can see whether they are an admin" on public.site_admins;
create policy "People can see whether they are an admin"
  on public.site_admins
  for select
  to authenticated
  using (user_id = auth.user_id());

-- Security definer so other tables' policies can check without exposing
-- the list of admins.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_admins where user_id = auth.user_id());
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create table if not exists public.site_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id text,
  user_name text,
  contact text,
  kind text not null default 'other' check (kind in ('bug', 'idea', 'praise', 'other')),
  app text,
  page text,
  message text not null check (char_length(message) between 1 and 4000),
  user_agent text,
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'seen', 'planned', 'fixed', 'closed')),
  dev_note text,
  updated_at timestamptz not null default now()
);

create index if not exists site_feedback_created_idx on public.site_feedback (created_at desc);
create index if not exists site_feedback_ip_idx on public.site_feedback (ip_hash, created_at desc);

alter table public.site_feedback enable row level security;
grant select, update on public.site_feedback to authenticated;

drop policy if exists "Admins read feedback" on public.site_feedback;
create policy "Admins read feedback"
  on public.site_feedback
  for select
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Admins update feedback" on public.site_feedback;
create policy "Admins update feedback"
  on public.site_feedback
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

create table if not exists public.dev_notes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id text not null default auth.user_id(),
  kind text not null default 'page' check (kind in ('page', 'idea', 'general')),
  app text,
  page text,
  title text,
  body text not null check (char_length(body) between 1 and 8000),
  status text not null default 'open' check (status in ('open', 'picked_up', 'done', 'dropped')),
  reply text
);

create index if not exists dev_notes_status_idx on public.dev_notes (status, created_at desc);

alter table public.dev_notes enable row level security;
grant select, insert, update, delete on public.dev_notes to authenticated;

drop policy if exists "Admins manage dev notes" on public.dev_notes;
create policy "Admins manage dev notes"
  on public.dev_notes
  for all
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

-- Make someone an admin (run once, by hand, with their Neon Auth user id):
--   insert into public.site_admins (user_id, label) values ('<user id>', 'Developer')
--   on conflict do nothing;
