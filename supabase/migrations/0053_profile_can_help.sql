-- 「我能帮上什么」 — what a mentor can help mentees with. A required mentor
-- field on 我的资料, separate from the 答疑组 self-introduction (qa_intro, 0052),
-- which now covers 「我是谁」 only. Like the other mentor fields it is scoped by
-- the existing profiles RLS policies: the owner edits, visible members read.

alter table public.profiles
  add column if not exists can_help text;

alter table public.profiles
  drop constraint if exists profiles_can_help_length;

alter table public.profiles
  add constraint profiles_can_help_length
    check (can_help is null or char_length(can_help) <= 1500);
