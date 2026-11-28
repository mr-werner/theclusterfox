-- Fishbowl: live game rooms. One row per room, keyed by its name in lower
-- case, holding the whole game (players, words, teams, the turn) as a JSON
-- document. Only the site's server reads and writes it (api/apps/_fishbowl.js),
-- so no role outside the owner gets a grant, and row level security with no
-- policies keeps the Data API out. Rooms left idle for 12 hours can be taken
-- over by a new host with the same name.
-- Additive only: no existing table changes.

create table if not exists public.fishbowl_rooms (
  code text primary key,
  password_hash text not null,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fishbowl_rooms enable row level security;
