-- Padlet-style bulletin board: post titles, anonymity, card colors, pinning,
-- a resolved flag for the Q&A wall, per-board configuration, plus comments
-- and emoji reactions.
--
-- Requires 0005_bulletin_categories.sql to have been applied and committed.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type bulletin_color as enum
    ('default', 'yellow', 'pink', 'blue', 'green', 'purple', 'orange');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- bulletin_posts — title, anonymity, color, admin flags
-- ---------------------------------------------------------------------------
alter table public.bulletin_posts
  add column if not exists title        text,
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists color        bulletin_color not null default 'default',
  add column if not exists pinned       boolean not null default false,
  add column if not exists resolved     boolean not null default false;

alter table public.bulletin_posts
  drop constraint if exists bulletin_posts_title_length;
alter table public.bulletin_posts
  add constraint bulletin_posts_title_length
  check (title is null or char_length(title) <= 60);

alter table public.bulletin_posts
  drop constraint if exists bulletin_posts_body_length;
alter table public.bulletin_posts
  add constraint bulletin_posts_body_length
  check (char_length(body) <= 2000);

create index if not exists idx_bulletin_board_pinned
  on public.bulletin_posts (board_id, pinned desc, created_at desc);

-- ---------------------------------------------------------------------------
-- bulletin_boards — per-board configuration
-- ---------------------------------------------------------------------------
alter table public.bulletin_boards
  add column if not exists allowed_categories bulletin_category[],
  add column if not exists allow_anonymous    boolean not null default true,
  add column if not exists allow_comments     boolean not null default true,
  add column if not exists prompt             text,
  add column if not exists sort_order         int not null default 0;

create index if not exists idx_boards_cohort_sort
  on public.bulletin_boards (cohort_id, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- bulletin_comments
-- ---------------------------------------------------------------------------
create table if not exists public.bulletin_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.bulletin_posts (id) on delete cascade,
  cohort_id    uuid not null references public.cohorts (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  is_anonymous boolean not null default false,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_bulletin_comments_post
  on public.bulletin_comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- bulletin_reactions
-- ---------------------------------------------------------------------------
create table if not exists public.bulletin_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.bulletin_posts (id) on delete cascade,
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('❤️', '👍', '🎉', '🤝', '💡', '🥺')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create index if not exists idx_bulletin_reactions_post
  on public.bulletin_reactions (post_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — mirrors the bulletin_posts policies in 0001/0004
-- ---------------------------------------------------------------------------
alter table public.bulletin_comments  enable row level security;
alter table public.bulletin_reactions enable row level security;

-- comments: same-cohort read of non-hidden rows; author sees own; admin sees all.
drop policy if exists bulletin_comments_select_cohort on public.bulletin_comments;
create policy bulletin_comments_select_cohort on public.bulletin_comments
  for select using (
    public.is_admin()
    or (cohort_id = any(public.current_cohort_ids()) and hidden = false)
    or author_id = auth.uid()
  );

drop policy if exists bulletin_comments_insert_self on public.bulletin_comments;
create policy bulletin_comments_insert_self on public.bulletin_comments
  for insert with check (
    (public.is_admin() or public.is_participant())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists bulletin_comments_update_author_admin on public.bulletin_comments;
create policy bulletin_comments_update_author_admin on public.bulletin_comments
  for update using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists bulletin_comments_delete_author_admin on public.bulletin_comments;
create policy bulletin_comments_delete_author_admin on public.bulletin_comments
  for delete using (author_id = auth.uid() or public.is_admin());

-- reactions: same-cohort read; a user may only add or remove their own.
drop policy if exists bulletin_reactions_select_cohort on public.bulletin_reactions;
create policy bulletin_reactions_select_cohort on public.bulletin_reactions
  for select using (
    public.is_admin() or cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists bulletin_reactions_insert_self on public.bulletin_reactions;
create policy bulletin_reactions_insert_self on public.bulletin_reactions
  for insert with check (
    (public.is_admin() or public.is_participant())
    and user_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists bulletin_reactions_delete_self on public.bulletin_reactions;
create policy bulletin_reactions_delete_self on public.bulletin_reactions
  for delete using (user_id = auth.uid() or public.is_admin());
