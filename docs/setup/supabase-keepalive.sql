-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase keep-alive (free tier anti-pause) — Option B: scheduled SQL only.
-- pg_cron runs a tiny query on a schedule. No pg_net, no HTTP, no anon key.
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Extension (or enable via Dashboard → Database → Extensions)
create extension if not exists pg_cron;

-- 2) A tiny heartbeat table (a real write leaves a visible timestamp)
create table if not exists public.keepalive (
  id        int primary key default 1,
  last_ping timestamptz not null default now()
);
insert into public.keepalive (id) values (1) on conflict do nothing;

-- 3) Schedule it — Mon / Wed / Fri at 09:00 UTC (well inside the 7-day idle window)
select cron.schedule(
  'keepalive',
  '0 9 * * 1,3,5',
  $$ insert into public.keepalive (id, last_ping) values (1, now())
     on conflict (id) do update set last_ping = now(); $$
);

-- (Absolute minimal alternative — a pure no-op instead of a write:)
--   select cron.schedule('keepalive', '0 9 * * 1,3,5', $$ select 1; $$);

-- ── Manage / verify ──────────────────────────────────────────────────────────
-- List jobs:            select jobid, jobname, schedule, active from cron.job;
-- Confirm it ran:       select * from public.keepalive;   -- last_ping should update
-- Job run history:      select * from cron.job_run_details order by start_time desc limit 5;
-- Remove it:            select cron.unschedule('keepalive');
