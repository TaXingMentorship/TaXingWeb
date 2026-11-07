-- 0044: who wrote the notes / recommendations shown on a season's roster, for
-- the 备注人 filter and the author hover card. Read-only and additive.
--
-- Same boundary as 0042/0043 (assert_roster_staff). Only people who authored
-- a note entry on a member of the season, or recommended one of its mentors,
-- are returned, and only the fields the card shows.

begin;

create function public.list_roster_staff_authors(p_cohort_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  email text,
  wechat_number text,
  participant_role text,
  is_admin boolean,
  is_volunteer boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_roster_staff(p_cohort_id);
  return query
    select a.id, a.full_name, a.avatar_url, a.email, a.wechat_number,
      a.participant_role::text, a.is_admin, a.is_volunteer
    from public.profiles a
    where a.id in (
      select e.author_id
      from public.roster_note_entries e
      join public.profiles p on p.id = e.profile_id
      where p_cohort_id = any(p.cohort_ids) and e.author_id is not null
      union
      select r.recommender_id
      from public.mentor_recommendations r
      join public.profiles m on m.id = r.mentor_id
      where p_cohort_id = any(m.cohort_ids)
    );
end;
$$;

revoke all on function public.list_roster_staff_authors(uuid) from public, anon;
grant execute on function public.list_roster_staff_authors(uuid) to authenticated;

commit;
