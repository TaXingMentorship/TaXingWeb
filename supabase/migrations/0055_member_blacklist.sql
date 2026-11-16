-- Blacklist details are available only to the service-role admin endpoint.
create table public.member_blacklist (
  profile_id uuid primary key references public.profiles(id),
  previous_visible boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

alter table public.member_blacklist enable row level security;
revoke all on public.member_blacklist from anon, authenticated;

-- Change the record and directory visibility together. Only the server endpoint
-- may call this, after it has changed the account's Supabase Auth ban.
create function public.set_member_blacklist(
  p_profile_id uuid,
  p_actor_id uuid,
  p_blacklisted boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
  old_visible boolean;
begin
  select * into target from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if p_blacklisted and (p_profile_id = p_actor_id or target.is_admin) then
    raise exception 'ADMIN_CANNOT_BE_BLACKLISTED';
  end if;

  if p_blacklisted then
    insert into public.member_blacklist(profile_id, previous_visible, created_by)
    values (p_profile_id, target.visible, p_actor_id)
    on conflict (profile_id) do nothing;
    update public.profiles set visible = false where id = p_profile_id;
  else
    delete from public.member_blacklist
      where profile_id = p_profile_id returning previous_visible into old_visible;
    if not found then
      raise exception 'NOT_BLACKLISTED';
    end if;
    update public.profiles set visible = old_visible where id = p_profile_id;
  end if;
end;
$$;

revoke all on function public.set_member_blacklist(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_member_blacklist(uuid, uuid, boolean) to service_role;

-- A still-valid access token must not make a blacklisted profile visible again.
create function public.protect_blacklisted_visibility()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.visible and exists (
    select 1 from public.member_blacklist where profile_id = new.id
  ) then
    raise exception 'BLACKLISTED_PROFILE_CANNOT_BE_VISIBLE';
  end if;
  return new;
end;
$$;

create trigger protect_blacklisted_visibility
before update of visible on public.profiles
for each row execute function public.protect_blacklisted_visibility();
