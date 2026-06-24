-- Mentorship Portal — Phase 1 schema
-- Tables: cohorts, profiles, roster_invites, bulletin_posts, sessions_log
-- Includes indexes and Row Level Security (RLS) policies.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'mentor', 'mentee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bulletin_category as enum ('wish', 'thanks', 'growth', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.cohorts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  starts_at     date,
  ends_at       date,
  bulletin_open boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role not null,
  cohort_id   uuid references public.cohorts (id) on delete set null,
  full_name   text,
  email       text,
  bio         text,
  background  text,
  interests   text[] not null default '{}',
  goals       text,
  linkedin    text,
  avatar_url  text,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.roster_invites (
  id              uuid primary key default gen_random_uuid(),
  cohort_id       uuid not null references public.cohorts (id) on delete cascade,
  email           text not null,
  full_name       text,
  role            user_role not null,
  invited_at      timestamptz not null default now(),
  claimed_user_id uuid references auth.users (id) on delete set null,
  unique (cohort_id, email)
);

create table if not exists public.bulletin_posts (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  category   bulletin_category not null default 'other',
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions_log (
  id           uuid primary key default gen_random_uuid(),
  cohort_id    uuid not null references public.cohorts (id) on delete cascade,
  mentor_id    uuid not null references public.profiles (id) on delete cascade,
  mentee_id    uuid not null references public.profiles (id) on delete cascade,
  session_date date not null,
  notes        text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_cohort_id        on public.profiles (cohort_id);
create index if not exists idx_bulletin_cohort_created   on public.bulletin_posts (cohort_id, created_at desc);
create index if not exists idx_sessions_mentor_id        on public.sessions_log (mentor_id);
create index if not exists idx_sessions_mentee_id        on public.sessions_log (mentee_id);
create index if not exists idx_roster_invites_email      on public.roster_invites (lower(email));

-- ---------------------------------------------------------------------------
-- Helper functions (security definer to avoid recursive RLS lookups)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.current_cohort_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cohort_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cohorts        enable row level security;
alter table public.profiles       enable row level security;
alter table public.roster_invites enable row level security;
alter table public.bulletin_posts enable row level security;
alter table public.sessions_log   enable row level security;

-- cohorts: members can read their own cohort; admins manage all.
drop policy if exists cohorts_select_member on public.cohorts;
create policy cohorts_select_member on public.cohorts
  for select using (id = public.current_cohort_id() or public.is_admin());

drop policy if exists cohorts_admin_all on public.cohorts;
create policy cohorts_admin_all on public.cohorts
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: same-cohort members see visible profiles; users see/update own row; admins do anything.
drop policy if exists profiles_select_cohort on public.profiles;
create policy profiles_select_cohort on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or (cohort_id = public.current_cohort_id() and visible = true)
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- roster_invites: admin only (service role bypasses RLS for the import handler).
drop policy if exists roster_invites_admin_all on public.roster_invites;
create policy roster_invites_admin_all on public.roster_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- bulletin_posts: same-cohort read of non-hidden rows; authenticated insert as self; author/admin update/delete.
drop policy if exists bulletin_select_cohort on public.bulletin_posts;
create policy bulletin_select_cohort on public.bulletin_posts
  for select using (
    public.is_admin()
    or (cohort_id = public.current_cohort_id() and hidden = false)
    or author_id = auth.uid()
  );

drop policy if exists bulletin_insert_self on public.bulletin_posts;
create policy bulletin_insert_self on public.bulletin_posts
  for insert with check (
    author_id = auth.uid() and cohort_id = public.current_cohort_id()
  );

drop policy if exists bulletin_update_author_admin on public.bulletin_posts;
create policy bulletin_update_author_admin on public.bulletin_posts
  for update using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists bulletin_delete_author_admin on public.bulletin_posts;
create policy bulletin_delete_author_admin on public.bulletin_posts
  for delete using (author_id = auth.uid() or public.is_admin());

-- sessions_log: read by the involved mentor/mentee or admin; writes only by admins (service role for handler).
drop policy if exists sessions_select_involved on public.sessions_log;
create policy sessions_select_involved on public.sessions_log
  for select using (
    public.is_admin() or mentor_id = auth.uid() or mentee_id = auth.uid()
  );

drop policy if exists sessions_admin_write on public.sessions_log;
create policy sessions_admin_write on public.sessions_log
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- updated_at trigger for profiles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
