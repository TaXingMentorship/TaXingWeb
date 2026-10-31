-- Let members add an optional guide so others can pronounce their name.
-- The existing profiles RLS policies already scope this field like the rest
-- of the member profile: the owner can edit it and visible members can read it.

alter table public.profiles
  add column if not exists name_pronunciation text;

alter table public.profiles
  drop constraint if exists profiles_name_pronunciation_length;

alter table public.profiles
  add constraint profiles_name_pronunciation_length
  check (name_pronunciation is null or length(name_pronunciation) <= 200);
