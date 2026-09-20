-- Only organizer accounts can create events. Staff accounts (tournament directors, scorekeepers)
-- get their access from an organizer adding them to an event.
--
-- The type is chosen at sign-up and is self-declared: there is no admin to verify it. It is
-- written once, by the sign-up trigger, and cannot be changed by the account afterwards.

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'staff' check (account_type in ('organizer', 'staff')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated
  using (user_id = (select auth.uid()));

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, account_type)
  values (new.id, case when new.raw_user_meta_data ->> 'account_type' = 'organizer' then 'organizer' else 'staff' end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts: whoever already owns an event is an organizer.
insert into profiles (user_id, account_type)
select u.id, case when exists (select 1 from events e where e.organizer_id = u.id) then 'organizer' else 'staff' end
from auth.users u
on conflict (user_id) do nothing;

create function is_organizer_account() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where user_id = (select auth.uid()) and account_type = 'organizer');
$$;

drop policy events_insert on events;
create policy events_insert on events for insert to authenticated
  with check (organizer_id = (select auth.uid()) and is_organizer_account());

-- Adding the same person to the same role twice now says so, instead of a constraint error.
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
  if p_role not in ('tournament_director', 'scorekeeper') then
    raise exception 'Role must be tournament_director or scorekeeper';
  end if;
  if p_role = 'scorekeeper'
     and not exists (select 1 from public.tatamis where id = p_tatami_id and event_id = p_event_id) then
    raise exception 'A scorekeeper needs a tatami from this event';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account with that email. Ask them to sign up as Staff first.';
  end if;
  if exists (select 1 from public.event_members where event_id = p_event_id and user_id = v_user and role = p_role) then
    raise exception 'That person already has this role on the event.';
  end if;
  insert into public.event_members (event_id, user_id, role, tatami_id)
  values (p_event_id, v_user, p_role, case when p_role = 'scorekeeper' then p_tatami_id end);
end;
$$;
