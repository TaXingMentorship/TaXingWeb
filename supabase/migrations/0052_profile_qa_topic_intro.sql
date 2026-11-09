-- Mentor Q&A group (答疑组) sharing: the topic a mentor will talk about and the
-- self-introduction they present. Both are filled in by the mentor on 我的资料
-- and imported once from the 2026秋季 答疑组活动汇总 sheet.
--
-- They live on `profiles`, not on `mentor_group_members`, so a returning mentor
-- sees what they wrote last season and only has to confirm or edit it. The
-- existing profiles RLS policies already scope them like the other mentor
-- fields: the owner edits, visible members read.
--
-- Separate from `bio` (the one-line directory blurb) and `topics` (擅长与不擅长).

alter table public.profiles
  add column if not exists qa_topic text,
  add column if not exists qa_intro text;

alter table public.profiles
  drop constraint if exists profiles_qa_topic_length,
  drop constraint if exists profiles_qa_intro_length;

alter table public.profiles
  add constraint profiles_qa_topic_length
    check (qa_topic is null or char_length(qa_topic) <= 1000),
  add constraint profiles_qa_intro_length
    check (qa_intro is null or char_length(qa_intro) <= 2000);
