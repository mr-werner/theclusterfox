-- CribFox: a two-phone baby monitor. The phones send each other a few small
-- WebRTC setup messages through the site's server, then stream video and
-- sound straight to each other. One row per monitor in crib_rooms, keyed by
-- a hash of its pairing code (the code itself is never stored), with the
-- monitor's last check-in, sound level and battery, and, only when a viewer
-- can't get a live stream, its latest still picture. crib_signals holds the
-- setup messages for a few minutes. Only the site's server reads and writes
-- these (api/apps/_crib.js): no grants, and row level security with no
-- policies keeps the Data API out.
-- Additive only: no existing table changes.

create table if not exists public.crib_rooms (
  code_hash text primary key,
  monitor_peer text not null,
  monitor_seen timestamptz not null default now(),
  status jsonb not null default '{}'::jsonb,
  snap text,
  snap_at timestamptz,
  snap_wanted timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crib_signals (
  id bigserial primary key,
  code_hash text not null,
  to_peer text not null,
  from_peer text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists crib_signals_inbox on public.crib_signals (code_hash, to_peer, id);
create index if not exists crib_signals_age on public.crib_signals (created_at);

alter table public.crib_rooms enable row level security;
alter table public.crib_signals enable row level security;
