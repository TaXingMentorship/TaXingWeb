-- 0054: the dashboard's volunteer block also reports the leadership group's
-- headcount including the leads who double up on it.
--
-- 战略组 is the leads of the working groups plus whoever belongs to it directly
-- (0013, `volunteer_groups.includes_leads`). `groups` stays a strict partition
-- (each volunteer in one bucket, summing to `total`) and is unchanged, so the
-- 战略组 slice there counts only its direct members. `leadership` is the
-- overlapping figure for a group flagged `includes_leads`: direct members plus
-- every lead, each person once. null when no group carries the flag.
--
-- Same function as 0047 with one extra key; read-only, re-runnable. Apply it
-- after 0047 (it replaces the function).

create or replace function public.season_dashboard_stats(p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
     or not (public.is_admin() or public.is_season_volunteer(p_cohort_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    -- Funnel, one object per role.
    'funnel', (
      select coalesce(jsonb_object_agg(r.role, jsonb_build_object(
        'expected', r.expected,
        'excluded', r.excluded,
        'activated', r.activated
      )), '{}'::jsonb)
      from (
        select ri.participant_role::text as role,
               count(*) as expected,
               count(*) filter (where ri.not_participating) as excluded,
               count(*) filter (
                 where not ri.not_participating and ri.claimed_user_id is not null
               ) as activated
        from public.roster_invites ri
        where ri.cohort_id = p_cohort_id
          and ri.participant_role is not null
        group by ri.participant_role
      ) r
    ),

    -- Accounts in the season, per role (independent of invites).
    'accounts', (
      select coalesce(jsonb_object_agg(a.role, a.n), '{}'::jsonb)
      from (
        select p.participant_role::text as role, count(*) as n
        from public.profiles p
        where p.cohort_ids @> array[p_cohort_id]
          and p.participant_role is not null
        group by p.participant_role
      ) a
    ),

    -- Volunteers: people, leads, unplaced, and headcount per group. Each
    -- volunteer sits in exactly one bucket (their own group, or no_group), so
    -- the group counts add up to `total`; `includes_leads` (0013) does not
    -- change them. `leadership` is the one figure that uses it: the flagged
    -- group's direct members plus every lead, overlapping the partition.
    'volunteers', jsonb_build_object(
      'total', (select count(*) from public.volunteer_seasons vs
                where vs.cohort_id = p_cohort_id),
      'leads', (select count(*) from public.volunteer_seasons vs
                where vs.cohort_id = p_cohort_id and vs.is_lead),
      'no_group', (select count(*) from public.volunteer_seasons vs
                   where vs.cohort_id = p_cohort_id and vs.group_id is null),
      'leadership', (
        select jsonb_build_object(
          'name', g.name,
          'count', (
            select count(*) from public.volunteer_seasons vs
            where vs.cohort_id = p_cohort_id and (vs.group_id = g.id or vs.is_lead)
          )
        )
        from public.volunteer_groups g
        where g.includes_leads
        order by g.sort_order, g.name
        limit 1
      ),
      'groups', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', g.name,
          'count', (
            select count(*) from public.volunteer_seasons vs
            where vs.cohort_id = p_cohort_id and vs.group_id = g.id
          )
        ) order by g.sort_order, g.name), '[]'::jsonb)
        from public.volunteer_groups g
      )
    ),

    -- Roundtable and Office Hour session totals (activity_items, 0038): every
    -- session added to the season, held or not.
    'activities', jsonb_build_object(
      'roundtable_total', (select count(*) from public.activity_items ai
                           where ai.cohort_id = p_cohort_id and ai.kind = 'session'
                             and ai.parent_key like 'roundtable%'),
      'office_hour_total', (select count(*) from public.activity_items ai
                            where ai.cohort_id = p_cohort_id and ai.kind = 'session'
                              and ai.parent_key = 'office_hour')
    ),

    -- Pairing progress, limited to people who have an account in the season so
    -- it is comparable with the `accounts` counts above. (1v1 session logs are not tallied: sessions_log is not
    -- used in practice, so "no sessions" would read as every mentee being idle.)
    'mentoring', jsonb_build_object(
      'paired_mentees', (select count(distinct m.mentee_id)
                         from public.matches m
                         join public.profiles pm on pm.id = m.mentee_id
                         where m.cohort_id = p_cohort_id
                           and pm.cohort_ids @> array[p_cohort_id]),
      'mentors_with_mentee', (select count(distinct m.mentor_id)
                              from public.matches m
                              join public.profiles pm on pm.id = m.mentor_id
                              where m.cohort_id = p_cohort_id
                                and pm.cohort_ids @> array[p_cohort_id])
    ),

    -- Bulletin board activity (visible content only).
    'board', jsonb_build_object(
      'posts', (select count(*) from public.bulletin_posts b
                where b.cohort_id = p_cohort_id and not b.hidden),
      'comments', (select count(*) from public.bulletin_comments c
                   where c.cohort_id = p_cohort_id and not c.hidden)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.season_dashboard_stats(uuid) from public, anon;
grant execute on function public.season_dashboard_stats(uuid) to authenticated;
