-- Google accounts are organizers. Every other account is staff: created by an organizer for an event, never
-- self-declared. The provider comes from app_metadata, which Supabase Auth sets and a client cannot edit
-- (unlike user_metadata, which sign-up lets the caller choose freely).

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, account_type)
  values (new.id, case when new.raw_app_meta_data ->> 'provider' = 'google' then 'organizer' else 'staff' end);
  return new;
end;
$$;

-- Google users who signed in before this change and never picked a type become organizers.
update profiles p set account_type = 'organizer'
from auth.users u
where p.user_id = u.id and not p.type_confirmed and u.raw_app_meta_data ->> 'provider' = 'google';

drop function set_account_type(text);
alter table profiles drop column type_confirmed;

-- Staff logins can only be created while the event is not completed.
create or replace function add_event_member(
  p_event_id uuid,
  p_email text,
  p_role text,
  p_tatami_id uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can manage staff' using errcode = '42501';
  end if;
  if exists (select 1 from public.events where id = p_event_id and status = 'completed') then
    raise exception 'This event is completed, so staff can no longer be added.';
  end if;
  if p_role not in ('tournament_director', 'scorekeeper') then
    raise exception 'Role must be tournament_director or scorekeeper';
  end if;
  if p_role = 'scorekeeper'
     and not exists (select 1 from public.tatamis where id = p_tatami_id and event_id = p_event_id) then
    raise exception 'A scorekeeper needs a tatami from this event';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account with that email.';
  end if;
  if exists (select 1 from public.event_members where event_id = p_event_id and user_id = v_user and role = p_role) then
    raise exception 'That person already has this role on the event.';
  end if;
  insert into public.event_members (event_id, user_id, role, tatami_id)
  values (p_event_id, v_user, p_role, case when p_role = 'scorekeeper' then p_tatami_id end);
end;
$$;
