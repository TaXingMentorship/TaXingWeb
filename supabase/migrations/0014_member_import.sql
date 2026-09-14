-- One import for both kinds of "get these people into the system".
--
-- There were two upload forms: one wrote `roster_invites` (a portal account
-- invitation, keyed by email) and one wrote `volunteers` (who helped run a
-- season, and in which group). Admins could not tell which to use, and a
-- volunteer who also mentors had to be entered twice.
--
-- The tables stay separate — they must. `claim_roster_invite` matches the
-- signed-in user's email against `roster_invites.email`, so email is the
-- activation mechanism itself, not merely a required column; an invitation
-- without one can never be claimed. Meanwhile most volunteers have no email at
-- all, and neither `roster_invites` nor `profiles` has anywhere to put a group.
--
-- What merges is the *upload*. One file, one row per person, and the 身份
-- column decides where the row lands:
--
--   身份 contains 导师/学员/管理员  → a portal invitation (email required)
--   身份 contains 志愿者            → a volunteer roster record
--   both                            → both, from the one row
--
-- Granting portal access stays explicit. A volunteer-only row creates an
-- invitation only when `invite` is set, so filling in someone's email as a
-- contact detail never quietly hands them an account. Portal-only roles
-- (导师/学员/管理员) do imply an invitation — those identities have no meaning
-- outside the portal, so a row carrying one and no account would be inert.

create or replace function public.admin_import_members(
  p_rows jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item            jsonb;
  season          jsonb;
  idx             integer := 0;
  v_name          text;
  v_name_key      text;
  v_email         text;
  v_email_key     text;
  v_wechat        text;
  v_notes         text;
  v_is_public     boolean;
  v_role          public.participant_role;
  v_is_admin      boolean;
  v_is_volunteer  boolean;
  v_invite        boolean;
  v_seasons       jsonb;
  v_season_name   text;
  v_group_name    text;
  v_is_lead       boolean;
  v_cohort_id     uuid;
  v_group_id      uuid;
  v_id            uuid;
  v_volunteer_new boolean;
  v_actions       text[];
  e_id            uuid;
  e_full_name     text;
  e_name_key      text;
  e_email         text;
  e_email_key     text;
  e_claimed       uuid;
  errors          jsonb := '[]'::jsonb;
  planned         jsonb := '[]'::jsonb;
  invites_added   integer := 0;
  invites_updated integer := 0;
  vols_added      integer := 0;
  vols_updated    integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'EMPTY_IMPORT';
  end if;

  -- --- Phase 1: validate the whole file, write nothing ---------------------
  for item in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    v_name         := btrim(coalesce(item ->> 'full_name', ''));
    v_name_key     := lower(v_name);
    v_email        := btrim(coalesce(item ->> 'email', ''));
    v_email_key    := nullif(lower(v_email), '');
    v_role         := nullif(btrim(coalesce(item ->> 'participant_role', '')), '')::public.participant_role;
    v_is_admin     := coalesce((item ->> 'is_admin')::boolean, false);
    v_is_volunteer := coalesce((item ->> 'is_volunteer')::boolean, false);
    v_invite       := coalesce((item ->> 'invite')::boolean, false);
    v_seasons      := coalesce(item -> 'seasons', '[]'::jsonb);

    if v_name = '' then
      errors := errors || jsonb_build_object('row', idx, 'code', 'INVALID_NAME');
      continue;
    end if;

    if v_role is null and not v_is_admin and not v_is_volunteer then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'NO_IDENTITY', 'name', v_name);
    end if;

    if v_email <> '' and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'INVALID_EMAIL', 'name', v_name, 'value', v_email);
    end if;

    -- An invitation is delivered to, and claimed by, an email address.
    if v_invite and v_email_key is null then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'INVITE_WITHOUT_EMAIL', 'name', v_name);
    end if;

    if jsonb_typeof(v_seasons) <> 'array' or jsonb_array_length(v_seasons) = 0 then
      errors := errors || jsonb_build_object('row', idx, 'code', 'NO_SEASON', 'name', v_name);
    else
      for season in select value from jsonb_array_elements(v_seasons)
      loop
        v_season_name := btrim(coalesce(season ->> 'season', ''));
        v_group_name  := nullif(btrim(coalesce(season ->> 'group', '')), '');

        if v_season_name = '' then
          errors := errors || jsonb_build_object('row', idx, 'code', 'NO_SEASON', 'name', v_name);
        elsif not exists (
          select 1 from public.cohorts c
          where public.season_key(c.name) = public.season_key(v_season_name)
        ) then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'UNKNOWN_SEASON', 'name', v_name, 'value', v_season_name);
        end if;

        if v_group_name is not null and not exists (
          select 1 from public.volunteer_groups g
          where public.season_key(g.name) = public.season_key(v_group_name)
        ) then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'UNKNOWN_GROUP', 'name', v_name, 'value', v_group_name);
        end if;

        if coalesce((season ->> 'is_lead')::boolean, false) and v_group_name is null then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'LEAD_WITHOUT_GROUP', 'name', v_name, 'value', v_season_name);
        end if;

        -- Group and lead describe volunteering; without that identity they
        -- would be recorded nowhere.
        if (v_group_name is not null or coalesce((season ->> 'is_lead')::boolean, false))
           and not v_is_volunteer then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'GROUP_WITHOUT_VOLUNTEER', 'name', v_name, 'value', v_group_name);
        end if;
      end loop;
    end if;

    -- Conflicts inside the uploaded file.
    if v_email_key is not null and exists (
      select 1 from jsonb_array_elements(p_rows) other
      where nullif(lower(btrim(coalesce(other.value ->> 'email', ''))), '') = v_email_key
        and lower(btrim(coalesce(other.value ->> 'full_name', ''))) <> v_name_key
    ) then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'FILE_DUP_EMAIL', 'name', v_name, 'value', v_email_key);
    end if;

    if exists (
      select 1 from jsonb_array_elements(p_rows) other
      where lower(btrim(coalesce(other.value ->> 'full_name', ''))) = v_name_key
        and nullif(lower(btrim(coalesce(other.value ->> 'email', ''))), '')
            is distinct from v_email_key
    ) then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'FILE_DUP_NAME', 'name', v_name, 'value', v_name);
    end if;

    -- Conflicts against the stored volunteer roster (only when this row makes
    -- one). Same rule as before: email identifies first, name second.
    if v_is_volunteer then
      e_id := null; e_full_name := null; e_name_key := null;
      e_email := null; e_email_key := null;

      if v_email_key is not null then
        select v.id, v.full_name, v.name_key, v.email, v.email_key
          into e_id, e_full_name, e_name_key, e_email, e_email_key
          from public.volunteers v where v.email_key = v_email_key;
      end if;

      if e_id is not null then
        if e_name_key <> v_name_key then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'NAME_MISMATCH',
            'name', v_name, 'value', v_email_key, 'detail', e_full_name);
        end if;
      else
        select v.id, v.full_name, v.name_key, v.email, v.email_key
          into e_id, e_full_name, e_name_key, e_email, e_email_key
          from public.volunteers v where v.name_key = v_name_key;

        if e_id is not null and e_email_key is not null and v_email_key is not null
           and e_email_key <> v_email_key then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'EMAIL_MISMATCH',
            'name', v_name, 'value', v_email, 'detail', e_email);
        end if;
      end if;
    end if;
  end loop;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object(
      'ok', false, 'dry_run', p_dry_run, 'errors', errors, 'rows', '[]'::jsonb,
      'summary', jsonb_build_object(
        'invites_added', 0, 'invites_updated', 0,
        'volunteers_added', 0, 'volunteers_updated', 0));
  end if;

  -- --- Phase 2: plan each row, and write unless this is a dry run ----------
  idx := 0;
  for item in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    v_name         := btrim(coalesce(item ->> 'full_name', ''));
    v_name_key     := lower(v_name);
    v_email        := lower(nullif(btrim(coalesce(item ->> 'email', '')), ''));
    v_email_key    := v_email;
    v_wechat       := nullif(btrim(coalesce(item ->> 'wechat_number', '')), '');
    v_notes        := nullif(btrim(coalesce(item ->> 'notes', '')), '');
    v_is_public    := (item ->> 'is_public')::boolean;
    v_role         := nullif(btrim(coalesce(item ->> 'participant_role', '')), '')::public.participant_role;
    v_is_admin     := coalesce((item ->> 'is_admin')::boolean, false);
    v_is_volunteer := coalesce((item ->> 'is_volunteer')::boolean, false);
    v_invite       := coalesce((item ->> 'invite')::boolean, false);
    v_seasons      := coalesce(item -> 'seasons', '[]'::jsonb);
    v_actions      := array[]::text[];

    -- ---- volunteer roster ------------------------------------------------
    if v_is_volunteer then
      v_id := null;
      if v_email_key is not null then
        select v.id into v_id from public.volunteers v where v.email_key = v_email_key;
      end if;
      if v_id is null then
        select v.id into v_id from public.volunteers v where v.name_key = v_name_key;
      end if;
      v_volunteer_new := v_id is null;

      if v_volunteer_new then
        vols_added := vols_added + 1;
        v_actions := array_append(v_actions, 'VOLUNTEER_ADDED');
      else
        vols_updated := vols_updated + 1;
        v_actions := array_append(v_actions, 'VOLUNTEER_UPDATED');
      end if;

      if not p_dry_run then
        if v_volunteer_new then
          insert into public.volunteers (full_name, email, wechat_number, notes, is_public)
          values (v_name, v_email, v_wechat, v_notes, coalesce(v_is_public, true))
          returning id into v_id;
        else
          update public.volunteers v
             set full_name     = v_name,
                 email         = coalesce(v_email, v.email),
                 wechat_number = coalesce(v_wechat, v.wechat_number),
                 notes         = coalesce(v_notes, v.notes),
                 is_public     = coalesce(v_is_public, v.is_public)
           where v.id = v_id;
        end if;

        for season in select value from jsonb_array_elements(v_seasons)
        loop
          select c.id into v_cohort_id from public.cohorts c
           where public.season_key(c.name) = public.season_key(season ->> 'season') limit 1;

          v_group_id   := null;
          v_group_name := nullif(btrim(coalesce(season ->> 'group', '')), '');
          if v_group_name is not null then
            select g.id into v_group_id from public.volunteer_groups g
             where public.season_key(g.name) = public.season_key(v_group_name) limit 1;
          end if;
          v_is_lead := coalesce((season ->> 'is_lead')::boolean, false);

          insert into public.volunteer_seasons (volunteer_id, cohort_id, group_id, is_lead)
          values (v_id, v_cohort_id, v_group_id, v_is_lead)
          on conflict (volunteer_id, cohort_id) do update
            set group_id = coalesce(excluded.group_id, volunteer_seasons.group_id),
                is_lead  = excluded.is_lead;
        end loop;
      end if;
    end if;

    -- ---- portal invitation ------------------------------------------------
    -- One invitation per season on the row: claim_roster_invite aggregates
    -- every invite matching the address, which is how a member ends up in
    -- several cohorts.
    if v_invite and v_email_key is not null then
      for season in select value from jsonb_array_elements(v_seasons)
      loop
        select c.id into v_cohort_id from public.cohorts c
         where public.season_key(c.name) = public.season_key(season ->> 'season') limit 1;

        select ri.id, ri.claimed_user_id into e_id, e_claimed
          from public.roster_invites ri
         where ri.cohort_id = v_cohort_id
           and lower(btrim(ri.email)) = v_email_key;

        if e_id is null then
          invites_added := invites_added + 1;
          v_actions := array_append(v_actions, 'INVITE_ADDED');
          if not p_dry_run then
            insert into public.roster_invites
              (cohort_id, email, full_name, participant_role, is_admin, is_volunteer)
            values (v_cohort_id, v_email, v_name, v_role, v_is_admin, v_is_volunteer)
            on conflict (cohort_id, email) do nothing;
          end if;
        elsif e_claimed is not null then
          -- Already activated: the profile, not the invitation, now carries
          -- their identity. Rewriting the invite would change nothing, so say
          -- so rather than reporting a phantom update.
          v_actions := array_append(v_actions, 'INVITE_ALREADY_CLAIMED');
        else
          invites_updated := invites_updated + 1;
          v_actions := array_append(v_actions, 'INVITE_UPDATED');
          if not p_dry_run then
            update public.roster_invites
               set full_name        = v_name,
                   participant_role = v_role,
                   is_admin         = v_is_admin,
                   is_volunteer     = v_is_volunteer
             where id = e_id;
          end if;
        end if;
      end loop;
    end if;

    planned := planned || jsonb_build_object(
      'row', idx,
      'full_name', v_name,
      'email', v_email,
      'actions', to_jsonb(v_actions),
      'seasons', (
        select coalesce(jsonb_agg(s.value ->> 'season'), '[]'::jsonb)
        from jsonb_array_elements(v_seasons) s
      )
    );
  end loop;

  return jsonb_build_object(
    'ok', true, 'dry_run', p_dry_run, 'errors', '[]'::jsonb, 'rows', planned,
    'summary', jsonb_build_object(
      'invites_added', invites_added, 'invites_updated', invites_updated,
      'volunteers_added', vols_added, 'volunteers_updated', vols_updated));
end;
$$;

revoke all on function public.admin_import_members(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_import_members(jsonb, boolean) to service_role;
