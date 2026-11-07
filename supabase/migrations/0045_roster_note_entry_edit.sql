-- 0045: authors can edit their own roster note entries; edits are marked.
--
-- Adds roster_note_entries.edited_at and update_roster_note_entry. Since
-- list_roster_note_entries now also returns edited_at, it is dropped and
-- recreated (a function's return type cannot be changed in place).
-- Same boundary as 0043: only the author, while they still staff a season of
-- that member. Admins can delete any entry (0043) but not rewrite others'.

begin;

alter table public.roster_note_entries add column edited_at timestamptz;

drop function public.list_roster_note_entries(uuid);

create function public.list_roster_note_entries(p_cohort_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_roster_staff(p_cohort_id);
  return query
    select e.id, e.profile_id, e.author_id, a.full_name, e.body, e.created_at, e.edited_at
    from public.roster_note_entries e
    join public.profiles p on p.id = e.profile_id
    left join public.profiles a on a.id = e.author_id
    where p_cohort_id = any(p.cohort_ids)
    order by e.created_at, e.id;
end;
$$;

create function public.update_roster_note_entry(p_entry_id uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  entry public.roster_note_entries;
begin
  select * into entry from public.roster_note_entries where id = p_entry_id;
  if not found then
    raise exception 'ROSTER_NOTE_NOT_FOUND';
  end if;
  if auth.uid() is null
    or entry.author_id is distinct from auth.uid()
    or not public.can_manage_roster_member(entry.profile_id) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'ROSTER_NOTE_EMPTY';
  end if;
  if char_length(p_body) > 2000 then
    raise exception 'ROSTER_NOTE_TOO_LONG';
  end if;
  update public.roster_note_entries
    set body = btrim(p_body), edited_at = now()
    where id = p_entry_id and body is distinct from btrim(p_body);
end;
$$;

revoke all on function public.list_roster_note_entries(uuid) from public, anon;
revoke all on function public.update_roster_note_entry(uuid, text) from public, anon;
grant execute on function public.list_roster_note_entries(uuid) to authenticated;
grant execute on function public.update_roster_note_entry(uuid, text) to authenticated;

commit;
