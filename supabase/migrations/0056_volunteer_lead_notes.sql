-- 0056: lead-only notes about volunteers.
--
-- Group leads (volunteer_seasons.is_lead) and admins can write notes about a
-- volunteer that nobody else can read: not the volunteer, not mentors or
-- mentees, not ordinary volunteers. Notes belong to the volunteer
-- (volunteers.id), not to a season, so they follow the person into later
-- seasons, including people with no portal account.
--
-- Access rule (can_lead_note_volunteer): admin, or a lead in at least one
-- season in which the target volunteer is also on the roster. A lead who is
-- blacklisted (0055) is refused here, so a still-valid token cannot read notes.
--
-- Additive only. The table has RLS on and no client grants; every read/write
-- goes through the security-definer RPCs below. It is deliberately NOT part of
-- volunteers_resolved or volunteers_public.

begin;

create table public.volunteer_lead_notes (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (btrim(body) <> '' and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index volunteer_lead_notes_volunteer_idx
  on public.volunteer_lead_notes (volunteer_id, created_at);

alter table public.volunteer_lead_notes enable row level security;
revoke all on public.volunteer_lead_notes from anon, authenticated;

-- Is the caller a lead in any season? (Gate for the list RPC and the UI.)
create function public.is_any_season_lead()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
    and exists (
      select 1
      from public.volunteers v
      join public.volunteer_seasons vs on vs.volunteer_id = v.id
      where v.profile_id = auth.uid() and vs.is_lead
    );
$$;

-- May the caller read/write lead notes about this volunteer?
create function public.can_lead_note_volunteer(p_volunteer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.volunteers me
        join public.volunteer_seasons mine on mine.volunteer_id = me.id and mine.is_lead
        join public.volunteer_seasons theirs
          on theirs.cohort_id = mine.cohort_id and theirs.volunteer_id = p_volunteer_id
        where me.profile_id = auth.uid()
      )
    );
$$;

revoke all on function public.is_any_season_lead() from public, anon;
revoke all on function public.can_lead_note_volunteer(uuid) from public, anon;
grant execute on function public.is_any_season_lead() to authenticated;
grant execute on function public.can_lead_note_volunteer(uuid) to authenticated;

-- Every note about the volunteers the caller may see notes for.
create function public.list_volunteer_lead_notes()
returns table (
  id uuid,
  volunteer_id uuid,
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
  if auth.uid() is null
     or exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
     or not (public.is_admin() or public.is_any_season_lead()) then
    raise exception 'LEAD_NOTES_FORBIDDEN';
  end if;
  return query
    select n.id, n.volunteer_id, n.author_id, a.full_name, n.body, n.created_at, n.edited_at
    from public.volunteer_lead_notes n
    left join public.profiles a on a.id = n.author_id
    where public.can_lead_note_volunteer(n.volunteer_id)
    order by n.created_at, n.id;
end;
$$;

create function public.add_volunteer_lead_note(p_volunteer_id uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.can_lead_note_volunteer(p_volunteer_id) then
    raise exception 'LEAD_NOTES_FORBIDDEN';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'LEAD_NOTE_EMPTY';
  end if;
  if char_length(p_body) > 2000 then
    raise exception 'LEAD_NOTE_TOO_LONG';
  end if;
  insert into public.volunteer_lead_notes (volunteer_id, author_id, body)
    values (p_volunteer_id, auth.uid(), btrim(p_body))
    returning id into new_id;
  return new_id;
end;
$$;

-- Authors edit their own notes (while they still have access to the
-- volunteer). Admins never reword someone else's note, only delete it.
create function public.update_volunteer_lead_note(p_note_id uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  note public.volunteer_lead_notes;
begin
  select * into note from public.volunteer_lead_notes where id = p_note_id;
  if not found then
    raise exception 'LEAD_NOTE_NOT_FOUND';
  end if;
  if note.author_id is distinct from auth.uid()
     or not public.can_lead_note_volunteer(note.volunteer_id) then
    raise exception 'LEAD_NOTES_FORBIDDEN';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'LEAD_NOTE_EMPTY';
  end if;
  if char_length(p_body) > 2000 then
    raise exception 'LEAD_NOTE_TOO_LONG';
  end if;
  if btrim(p_body) is distinct from note.body then
    update public.volunteer_lead_notes
      set body = btrim(p_body), edited_at = now()
      where id = p_note_id;
  end if;
end;
$$;

create function public.delete_volunteer_lead_note(p_note_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  note public.volunteer_lead_notes;
begin
  select * into note from public.volunteer_lead_notes where id = p_note_id;
  if not found then
    return;
  end if;
  if auth.uid() is null
     or exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
     or not (
       public.is_admin()
       or (note.author_id = auth.uid() and public.can_lead_note_volunteer(note.volunteer_id))
     ) then
    raise exception 'LEAD_NOTES_FORBIDDEN';
  end if;
  delete from public.volunteer_lead_notes where id = p_note_id;
end;
$$;

revoke all on function public.list_volunteer_lead_notes() from public, anon;
revoke all on function public.add_volunteer_lead_note(uuid, text) from public, anon;
revoke all on function public.update_volunteer_lead_note(uuid, text) from public, anon;
revoke all on function public.delete_volunteer_lead_note(uuid) from public, anon;
grant execute on function public.list_volunteer_lead_notes() to authenticated;
grant execute on function public.add_volunteer_lead_note(uuid, text) to authenticated;
grant execute on function public.update_volunteer_lead_note(uuid, text) to authenticated;
grant execute on function public.delete_volunteer_lead_note(uuid) to authenticated;

commit;
