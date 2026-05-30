-- ─────────────────────────────────────────────────────────────────────────────
-- Kindl Inbox — initial schema
-- Run this in Supabase Dashboard → SQL Editor, or via the Supabase CLI.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users — one row per registered user.
-- Tier defaults to 'free'; Stripe webhook upgrades it to 'pro'.

create table if not exists public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  email             text,
  tier              text        not null default 'free'
                                check (tier in ('free', 'pro')),
  stripe_customer_id text       unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Usage tracking ────────────────────────────────────────────────────────────
-- One row per (user, calendar day). Incremented atomically via SQL function.

create table if not exists public.usage (
  user_id uuid  not null references public.profiles(id) on delete cascade,
  date    date  not null default current_date,
  count   int   not null default 0 check (count >= 0),
  primary key (user_id, date)
);

-- ── Magic-link relay sessions ─────────────────────────────────────────────────
-- Short-lived tokens (5 min TTL) stored by the relay page after a magic-link
-- click. The extension popup polls /api/auth/pending and deletes after reading.

create table if not exists public.auth_pending (
  state         text        primary key,
  user_id       uuid        references auth.users(id) on delete cascade,
  access_token  text        not null,
  refresh_token text,
  expires_at    timestamptz not null
);

-- ── Trigger: auto-create profile on sign-up ───────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Atomic usage increment ────────────────────────────────────────────────────
-- Inserts a usage row for today if absent, otherwise increments count by 1.
-- Called by backend/src/lib/usage.ts via supabase.rpc('increment_usage', …).

create or replace function public.increment_usage(p_user_id uuid, p_date date)
returns void
language plpgsql
as $$
begin
  insert into public.usage (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set count = public.usage.count + 1;
end;
$$;

-- ── Row-level security ────────────────────────────────────────────────────────
-- The backend always uses the service-role key (bypasses RLS).
-- RLS is enabled to prevent direct anon/authenticated access to raw data.

alter table public.profiles   enable row level security;
alter table public.usage       enable row level security;
alter table public.auth_pending enable row level security;

-- Users can read their own profile
create policy "users_read_own_profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can read their own usage
create policy "users_read_own_usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- auth_pending is service-role only (no user-facing policies)
